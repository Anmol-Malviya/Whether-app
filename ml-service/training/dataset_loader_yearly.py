"""
dataset_loader_yearly.py - Yearly Chronological Split & Leakage-Safe Feature Loader.

Phase 4.1 Specification:
- Features: Exactly 32 features (8 calendar/diurnal + 24 historical observation lag features)
- Strictly Excludes: All best_match, ecmwf_ifs, and gfs NWP features
- Yearly chronological split:
    - Train: 2021-01-01 to 2022-12-31 (17,518 rows)
    - Validation: 2023-01-01 to 2023-12-31 (8,760 rows)
    - Test: 2024-01-01 to 2024-12-31 (8,783 rows)
    - Total: 35,061 rows
- Target Horizon: exactly t + 1 hour
- Comprehensive leakage assertion checks
"""

from typing import Tuple, List, Dict, Any
from pathlib import Path
import pandas as pd
import numpy as np

# 8 Calendar / Diurnal Features
CALENDAR_FEATURES: List[str] = [
    "feat_hour",
    "feat_day_of_week",
    "feat_month",
    "feat_day_of_year",
    "feat_sin_hour",
    "feat_cos_hour",
    "feat_sin_month",
    "feat_cos_month",
]

# 24 Historical Observation Lag Features (8 variables x 3 lags: t0, lag1h, lag2h)
OBSERVATION_LAG_FEATURES: List[str] = [
    # Temperature 2m
    "feat_obs_temperature_2m_t0",
    "feat_obs_temperature_2m_lag1h",
    "feat_obs_temperature_2m_lag2h",
    # Relative Humidity 2m
    "feat_obs_relative_humidity_2m_t0",
    "feat_obs_relative_humidity_2m_lag1h",
    "feat_obs_relative_humidity_2m_lag2h",
    # Dew Point 2m
    "feat_obs_dew_point_2m_t0",
    "feat_obs_dew_point_2m_lag1h",
    "feat_obs_dew_point_2m_lag2h",
    # Precipitation
    "feat_obs_precipitation_t0",
    "feat_obs_precipitation_lag1h",
    "feat_obs_precipitation_lag2h",
    # Wind Speed 10m
    "feat_obs_wind_speed_10m_t0",
    "feat_obs_wind_speed_10m_lag1h",
    "feat_obs_wind_speed_10m_lag2h",
    # Wind Direction 10m
    "feat_obs_wind_direction_10m_t0",
    "feat_obs_wind_direction_10m_lag1h",
    "feat_obs_wind_direction_10m_lag2h",
    # Surface Pressure
    "feat_obs_surface_pressure_t0",
    "feat_obs_surface_pressure_lag1h",
    "feat_obs_surface_pressure_lag2h",
    # Cloud Cover
    "feat_obs_cloud_cover_t0",
    "feat_obs_cloud_cover_lag1h",
    "feat_obs_cloud_cover_lag2h",
]

OBS_ONLY_FEATURES: List[str] = CALENDAR_FEATURES + OBSERVATION_LAG_FEATURES

TARGET_COLUMNS: List[str] = [
    "target_obs_temperature_2m_lead1h",
    "target_obs_rain_occurrence_lead1h",
]

DEFAULT_DATASET_PATH = Path("ml-service/data/processed/training_dataset.csv")


def load_and_split_yearly_data(
    dataset_path: Path = DEFAULT_DATASET_PATH,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, Dict[str, Any]]:
    """
    Loads dataset, verifies strictly 32 leakage-safe features,
    sorts by timestamp, and splits by calendar year:
      Train: 2021-01-01 to 2022-12-31
      Validation: 2023-01-01 to 2023-12-31
      Test: 2024-01-01 to 2024-12-31

    Returns:
        (train_df, val_df, test_df, metadata_dict)
    """
    if not dataset_path.exists():
        raise FileNotFoundError(f"Training dataset not found at {dataset_path}")

    df = pd.read_csv(dataset_path)

    # 1. Row count check
    if len(df) != 35061:
        raise ValueError(f"Expected 35,061 rows in training dataset, found {len(df)}.")

    # 2. Verify targets exist
    for target in TARGET_COLUMNS:
        if target not in df.columns:
            raise KeyError(f"Required target column missing: {target}")

    # 3. Verify exactly 32 features
    if len(OBS_ONLY_FEATURES) != 32:
        raise ValueError(f"Expected exactly 32 features, got {len(OBS_ONLY_FEATURES)}")

    missing_features = [f for f in OBS_ONLY_FEATURES if f not in df.columns]
    if missing_features:
        raise KeyError(f"Missing required feature columns: {missing_features}")

    # 4. Leakage Rule: Zero NWP columns allowed
    nwp_in_features = [f for f in OBS_ONLY_FEATURES if "nwp" in f.lower() or "gfs" in f.lower() or "best_match" in f.lower() or "ecmwf" in f.lower()]
    if nwp_in_features:
        raise ValueError(f"Leakage violation: NWP columns found in feature set: {nwp_in_features}")

    # 5. Leakage Rule: Zero target columns in feature set
    target_in_features = [f for f in OBS_ONLY_FEATURES if "target" in f.lower() or "lead" in f.lower()]
    if target_in_features:
        raise ValueError(f"Leakage violation: Target columns found in feature set: {target_in_features}")

    # 6. Verify zero NaNs in selected 32 features and targets
    null_counts = df[OBS_ONLY_FEATURES + TARGET_COLUMNS].isnull().sum()
    if null_counts.sum() > 0:
        raise ValueError(f"Unexpected NaNs in feature/target columns: {null_counts[null_counts > 0].to_dict()}")

    # 7. Chronological ordering & timestamp typing
    df["timestamp_utc"] = pd.to_datetime(df["timestamp_utc"])
    df["target_valid_time_utc"] = pd.to_datetime(df["target_valid_time_utc"])
    df = df.sort_values("timestamp_utc").reset_index(drop=True)

    # 8. Yearly Splitting with Strict 1-Hour Temporal Purge
    # Because target valid time is t + 1 hour:
    # - The sample at 2022-12-31 23:00 has target at 2023-01-01 00:00, which is the first feature timestamp of Validation.
    #   To ensure last training target < first validation feature, we purge the 2022-12-31 23:00 row (1 sample removed).
    # - Similarly, the sample at 2023-12-31 23:00 has target at 2024-01-01 00:00, which is the first feature timestamp of Test.
    #   To ensure last validation target < first test feature, we purge the 2023-12-31 23:00 row (1 sample removed).
    train_mask = (df["timestamp_utc"] >= "2021-01-01") & (df["timestamp_utc"] <= "2022-12-31 22:00:00")
    val_mask = (df["timestamp_utc"] >= "2023-01-01") & (df["timestamp_utc"] <= "2023-12-31 22:00:00")
    test_mask = (df["timestamp_utc"] >= "2024-01-01") & (df["timestamp_utc"] <= "2024-12-31 23:59:59")

    train_df = df[train_mask].copy().reset_index(drop=True)
    val_df = df[val_mask].copy().reset_index(drop=True)
    test_df = df[test_mask].copy().reset_index(drop=True)

    total_partitioned = len(train_df) + len(val_df) + len(test_df)
    purged_rows_count = len(df) - total_partitioned  # Exactly 2 boundary rows purged

    # Strict temporal purge assertions:
    # 1. Last training target timestamp is strictly earlier than first validation feature timestamp
    assert train_df["target_valid_time_utc"].max() < val_df["timestamp_utc"].min(), (
        f"Temporal purge violation: Train target max ({train_df['target_valid_time_utc'].max()}) "
        f"is not strictly earlier than Val feature min ({val_df['timestamp_utc'].min()})"
    )
    # 2. Last validation target timestamp is strictly earlier than first test feature timestamp
    assert val_df["target_valid_time_utc"].max() < test_df["timestamp_utc"].min(), (
        f"Temporal purge violation: Val target max ({val_df['target_valid_time_utc'].max()}) "
        f"is not strictly earlier than Test feature min ({test_df['timestamp_utc'].min()})"
    )

    metadata = {
        "dataset_path": str(dataset_path),
        "total_rows": len(df),
        "purged_boundary_rows": purged_rows_count,
        "purged_row_details": [
            "2022-12-31 23:00:00+00:00 (target valid at 2023-01-01 00:00:00+00:00, boundary of validation features)",
            "2023-12-31 23:00:00+00:00 (target valid at 2024-01-01 00:00:00+00:00, boundary of test features)"
        ],
        "feature_count": len(OBS_ONLY_FEATURES),
        "features": list(OBS_ONLY_FEATURES),
        "targets": list(TARGET_COLUMNS),
        "splits": {
            "train": {
                "years": "2021-2022",
                "rows": len(train_df),
                "fraction": round(len(train_df) / len(df), 4),
                "start_utc": str(train_df["timestamp_utc"].min()),
                "end_utc": str(train_df["timestamp_utc"].max()),
                "target_max_utc": str(train_df["target_valid_time_utc"].max()),
                "rain_events": int(train_df["target_obs_rain_occurrence_lead1h"].sum()),
                "rain_prevalence": round(float(train_df["target_obs_rain_occurrence_lead1h"].mean()), 4),
            },
            "validation": {
                "years": "2023",
                "rows": len(val_df),
                "fraction": round(len(val_df) / len(df), 4),
                "start_utc": str(val_df["timestamp_utc"].min()),
                "end_utc": str(val_df["timestamp_utc"].max()),
                "target_max_utc": str(val_df["target_valid_time_utc"].max()),
                "rain_events": int(val_df["target_obs_rain_occurrence_lead1h"].sum()),
                "rain_prevalence": round(float(val_df["target_obs_rain_occurrence_lead1h"].mean()), 4),
            },
            "test": {
                "years": "2024",
                "rows": len(test_df),
                "fraction": round(len(test_df) / len(df), 4),
                "start_utc": str(test_df["timestamp_utc"].min()),
                "end_utc": str(test_df["timestamp_utc"].max()),
                "target_max_utc": str(test_df["target_valid_time_utc"].max()),
                "rain_events": int(test_df["target_obs_rain_occurrence_lead1h"].sum()),
                "rain_prevalence": round(float(test_df["target_obs_rain_occurrence_lead1h"].mean()), 4),
            },
        },
    }

    return train_df, val_df, test_df, metadata

