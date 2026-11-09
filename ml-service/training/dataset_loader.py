"""
dataset_loader.py - Option A Dataset Loading and Chronological Split Utility.

Enforces:
- 48 features (strictly Option A, no GFS features)
- 35,061 rows
- Chronological splitting: 70% Train, 15% Validation, 15% Test
- Fail-fast verification of feature and target columns
"""

from typing import Tuple, List, Dict, Any
from pathlib import Path
import pandas as pd
import numpy as np

# Exact 48 features for Option A
OPTION_A_FEATURES: List[str] = [
    # Diurnal / Calendar features (8)
    "feat_hour",
    "feat_day_of_week",
    "feat_month",
    "feat_day_of_year",
    "feat_sin_hour",
    "feat_cos_hour",
    "feat_sin_month",
    "feat_cos_month",
    # Observation lags: 8 variables x 3 lags (t0, lag1h, lag2h) = 24
    "feat_obs_temperature_2m_t0",
    "feat_obs_temperature_2m_lag1h",
    "feat_obs_temperature_2m_lag2h",
    "feat_obs_relative_humidity_2m_t0",
    "feat_obs_relative_humidity_2m_lag1h",
    "feat_obs_relative_humidity_2m_lag2h",
    "feat_obs_dew_point_2m_t0",
    "feat_obs_dew_point_2m_lag1h",
    "feat_obs_dew_point_2m_lag2h",
    "feat_obs_precipitation_t0",
    "feat_obs_precipitation_lag1h",
    "feat_obs_precipitation_lag2h",
    "feat_obs_wind_speed_10m_t0",
    "feat_obs_wind_speed_10m_lag1h",
    "feat_obs_wind_speed_10m_lag2h",
    "feat_obs_wind_direction_10m_t0",
    "feat_obs_wind_direction_10m_lag1h",
    "feat_obs_wind_direction_10m_lag2h",
    "feat_obs_surface_pressure_t0",
    "feat_obs_surface_pressure_lag1h",
    "feat_obs_surface_pressure_lag2h",
    "feat_obs_cloud_cover_t0",
    "feat_obs_cloud_cover_lag1h",
    "feat_obs_cloud_cover_lag2h",
    # NWP Best Match features (8)
    "feat_nwp_cloud_cover_best_match",
    "feat_nwp_dew_point_2m_best_match",
    "feat_nwp_precipitation_best_match",
    "feat_nwp_relative_humidity_2m_best_match",
    "feat_nwp_surface_pressure_best_match",
    "feat_nwp_temperature_2m_best_match",
    "feat_nwp_wind_direction_10m_best_match",
    "feat_nwp_wind_speed_10m_best_match",
    # NWP ECMWF IFS features (8)
    "feat_nwp_cloud_cover_ecmwf_ifs",
    "feat_nwp_dew_point_2m_ecmwf_ifs",
    "feat_nwp_precipitation_ecmwf_ifs",
    "feat_nwp_relative_humidity_2m_ecmwf_ifs",
    "feat_nwp_surface_pressure_ecmwf_ifs",
    "feat_nwp_temperature_2m_ecmwf_ifs",
    "feat_nwp_wind_direction_10m_ecmwf_ifs",
    "feat_nwp_wind_speed_10m_ecmwf_ifs",
]

TARGET_COLUMNS: List[str] = [
    "target_obs_temperature_2m_lead1h",
    "target_obs_rain_occurrence_lead1h",
    "target_obs_precipitation_lead1h",
]

DEFAULT_DATASET_PATH = Path("ml-service/data/processed/training_dataset.csv")


def load_and_split_data(
    dataset_path: Path = DEFAULT_DATASET_PATH,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, Dict[str, Any]]:
    """
    Loads training dataset, verifies integrity and column presence,
    sorts chronologically, and performs 70/15/15 split.

    Returns:
        (train_df, val_df, test_df, metadata_dict)
    """
    if not dataset_path.exists():
        raise FileNotFoundError(f"Training dataset not found at {dataset_path}")

    # Load dataset
    df = pd.read_csv(dataset_path)

    # 1. Verify row count
    if len(df) != 35061:
        raise ValueError(
            f"Expected exactly 35,061 rows in training dataset, but found {len(df)}."
        )

    # 2. Verify all targets are present
    missing_targets = [col for col in TARGET_COLUMNS if col not in df.columns]
    if missing_targets:
        raise KeyError(f"Missing required target column(s): {missing_targets}")

    # 3. Verify all Option A features are present
    missing_features = [col for col in OPTION_A_FEATURES if col not in df.columns]
    if missing_features:
        raise KeyError(f"Missing required Option A feature column(s): {missing_features}")

    # 4. Ensure no GFS features are included in Option A feature set
    gfs_in_features = [col for col in OPTION_A_FEATURES if "gfs" in col.lower()]
    if gfs_in_features:
        raise ValueError(f"Option A features must exclude GFS columns, found: {gfs_in_features}")

    # 5. Verify no NaNs in Option A features or targets
    null_counts = df[OPTION_A_FEATURES + TARGET_COLUMNS].isnull().sum()
    if null_counts.sum() > 0:
        cols_with_nulls = null_counts[null_counts > 0].to_dict()
        raise ValueError(f"Option A features or targets contain unexpected NaNs: {cols_with_nulls}")

    # 6. Chronological ordering
    if "timestamp_utc" not in df.columns:
        raise KeyError("timestamp_utc column is required for chronological splitting.")
    
    df["timestamp_utc"] = pd.to_datetime(df["timestamp_utc"])
    df = df.sort_values("timestamp_utc").reset_index(drop=True)

    # 7. Chronological split: 70% Train, 15% Validation, 15% Test
    n = len(df)
    n_train = int(n * 0.70)
    n_val = int(n * 0.15)
    n_test = n - n_train - n_val

    train_df = df.iloc[:n_train].copy().reset_index(drop=True)
    val_df = df.iloc[n_train : n_train + n_val].copy().reset_index(drop=True)
    test_df = df.iloc[n_train + n_val :].copy().reset_index(drop=True)

    # Verify no temporal overlap
    assert train_df["timestamp_utc"].max() < val_df["timestamp_utc"].min(), "Train-Val temporal overlap detected!"
    assert val_df["timestamp_utc"].max() < test_df["timestamp_utc"].min(), "Val-Test temporal overlap detected!"

    metadata = {
        "dataset_path": str(dataset_path),
        "total_rows": n,
        "feature_count": len(OPTION_A_FEATURES),
        "features": list(OPTION_A_FEATURES),
        "targets": list(TARGET_COLUMNS),
        "splits": {
            "train": {
                "rows": len(train_df),
                "fraction": round(len(train_df) / n, 4),
                "start_utc": str(train_df["timestamp_utc"].min()),
                "end_utc": str(train_df["timestamp_utc"].max()),
            },
            "validation": {
                "rows": len(val_df),
                "fraction": round(len(val_df) / n, 4),
                "start_utc": str(val_df["timestamp_utc"].min()),
                "end_utc": str(val_df["timestamp_utc"].max()),
            },
            "test": {
                "rows": len(test_df),
                "fraction": round(len(test_df) / n, 4),
                "start_utc": str(test_df["timestamp_utc"].min()),
                "end_utc": str(test_df["timestamp_utc"].max()),
            },
        },
    }

    return train_df, val_df, test_df, metadata

