import pytest
import numpy as np
import pandas as pd
from pathlib import Path

PROCESSED_DIR = Path(__file__).resolve().parent.parent / "data" / "processed"
RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"

@pytest.fixture(scope="module")
def processed_data():
    obs = pd.read_parquet(PROCESSED_DIR / "historical_observations.parquet")
    fc = pd.read_parquet(PROCESSED_DIR / "historical_forecasts.parquet")
    train = pd.read_parquet(PROCESSED_DIR / "training_dataset.parquet")
    return {"obs": obs, "fc": fc, "train": train}

def test_january_2024_pilot_vs_annual_duplicate_precedence(processed_data):
    """
    Test 1: Verify January 2024 duplicate precedence and exact superseded pilot counts.
    Annual 2024 partition must take precedence over pilot partition,
    ensuring zero missing metadata values for 2024-01-01 to 2024-01-31.
    Additionally, verify that exact superseded pilot row counts (744 observation rows,
    2,232 forecast rows) are correctly audited using source partition identity.
    """
    fc = processed_data["fc"]
    jan_2024 = fc[(fc["timestamp_utc"] >= "2024-01-01T00:00:00+00:00") & 
                  (fc["timestamp_utc"] <= "2024-01-31T23:00:00+00:00")]
    
    # 744 hours * 3 models = 2,232 rows
    assert len(jan_2024) == 2232, f"Expected 2232 rows for Jan 2024, got {len(jan_2024)}"
    assert jan_2024["initialization_time_utc"].isna().sum() == 0, "Missing initialization_time_utc in Jan 2024"
    assert jan_2024["lead_time_status"].isna().sum() == 0, "Missing lead_time_status in Jan 2024"
    assert jan_2024["retrieval_timestamp_utc"].isna().sum() == 0, "Missing retrieval_timestamp_utc in Jan 2024"
    assert (jan_2024["initialization_time_utc"] == "UNKNOWN_FROM_OPEN_METEO_API").all()
    assert (jan_2024["lead_time_status"] == "NOMINAL_UNKNOWN_CYCLE").all()

    # Verify exact superseded pilot counts by partition identity matching against raw files
    pilot_obs_file = RAW_DIR / "indore_historical_obs_2024-01-01_to_2024-01-31.csv"
    annual_obs_file = RAW_DIR / "indore_historical_obs_2024.csv"
    if pilot_obs_file.exists() and annual_obs_file.exists():
        df_p_obs = pd.read_csv(pilot_obs_file)
        df_a_obs = pd.read_csv(annual_obs_file)
        # Pilot contains 744 rows
        assert len(df_p_obs) == 744, f"Expected 744 raw pilot obs, got {len(df_p_obs)}"
        t_col_p = "time" if "time" in df_p_obs.columns else "time_utc"
        t_col_a = "time" if "time" in df_a_obs.columns else "time_utc"
        superseded_obs = df_p_obs.merge(df_a_obs, left_on=["location_id", t_col_p], right_on=["location_id", t_col_a])
        assert len(superseded_obs) == 744, f"Expected exactly 744 superseded pilot obs, got {len(superseded_obs)}"

    pilot_fc_file = RAW_DIR / "indore_historical_forecast_2024-01-01_to_2024-01-31.csv"
    annual_fc_file = RAW_DIR / "indore_historical_forecast_2024.csv"
    if pilot_fc_file.exists() and annual_fc_file.exists():
        df_p_fc = pd.read_csv(pilot_fc_file)
        df_a_fc = pd.read_csv(annual_fc_file)
        # Pilot contains 2232 rows
        assert len(df_p_fc) == 2232, f"Expected 2232 raw pilot fc, got {len(df_p_fc)}"
        t_col_p = "valid_time_utc" if "valid_time_utc" in df_p_fc.columns else "time"
        t_col_a = "valid_time_utc" if "valid_time_utc" in df_a_fc.columns else "time"
        superseded_fc = df_p_fc.merge(df_a_fc, left_on=["location_id", "model_id", t_col_p], right_on=["location_id", "model_id", t_col_a])
        assert len(superseded_fc) == 2232, f"Expected exactly 2232 superseded pilot fc, got {len(superseded_fc)}"

def test_forecast_metadata_contract(processed_data):
    """
    Test 2: Verify forecast metadata contract.
    - initialization_time_utc must never silently become null across the entire dataset.
    - lead_time_hours must remain NaN (not fabricated with 0).
    - lead_time_status and retrieval_timestamp_utc must be 100% populated.
    """
    fc = processed_data["fc"]
    assert fc["initialization_time_utc"].isna().sum() == 0, "Silent nulls found in initialization_time_utc"
    assert fc["lead_time_status"].isna().sum() == 0, "Silent nulls found in lead_time_status"
    assert fc["retrieval_timestamp_utc"].isna().sum() == 0, "Silent nulls found in retrieval_timestamp_utc"
    assert fc["lead_time_hours"].isna().all(), "lead_time_hours was fabricated instead of NaN"

def test_gfs_coverage_boundaries_and_missingness(processed_data):
    """
    Test 3: Verify GFS coverage boundaries and strict missingness across all 8 variables.
    GFS seamless coverage begins March 23, 2021.
    Verify that:
    1. All 8 GFS variables have exactly expected pre-coverage gaps (1,941 samples).
    2. GFS cloud cover has exactly 1 missing value (at boundary timestamp 2021-03-23 00:00:00+00:00).
    3. GFS precipitation has exactly 346 missing values in historical coverage.
    4. GFS other 6 continuous atmospheric variables have exactly 0 internal nulls.
    5. GFS nulls are not zero-filled.
    """
    train = processed_data["train"]
    fc = processed_data["fc"]

    gfs_fc = fc[fc["model_id"] == "gfs_seamless"]
    gfs_start = gfs_fc["timestamp_utc"].min()
    assert str(gfs_start).startswith("2021-03-23"), f"Unexpected GFS start date: {gfs_start}"

    expected_pre_coverage_gap = (train["target_valid_time_utc"] < gfs_start).sum()
    assert expected_pre_coverage_gap == 1941, f"Expected 1941 pre-coverage gap rows, got {expected_pre_coverage_gap}"

    # Verify all eight GFS variables in forecast table and training features
    all_8_gfs_vars = [
        "temperature_2m", "relative_humidity_2m", "dew_point_2m", "surface_pressure",
        "wind_speed_10m", "wind_direction_10m", "cloud_cover", "precipitation"
    ]
    expected_internal_nulls = {
        "temperature_2m": 0,
        "relative_humidity_2m": 0,
        "dew_point_2m": 0,
        "surface_pressure": 0,
        "wind_speed_10m": 0,
        "wind_direction_10m": 0,
        "cloud_cover": 1,
        "precipitation": 346
    }

    for var in all_8_gfs_vars:
        # Forecast table check
        fc_nulls = gfs_fc[var].isna().sum()
        assert fc_nulls == expected_internal_nulls[var], f"GFS forecast {var} nulls ({fc_nulls}) != expected ({expected_internal_nulls[var]})"

        # Training dataset feature check
        feat_col = f"feat_nwp_{var}_gfs_seamless"
        train_nulls = train[feat_col].isna().sum()
        expected_total = expected_pre_coverage_gap + expected_internal_nulls[var]
        assert train_nulls == expected_total, f"{feat_col} total nulls ({train_nulls}) != expected ({expected_total})"

    # Verify exact cloud-cover missing timestamp (2021-03-23 00:00:00+00:00)
    cc_missing_ts = gfs_fc[gfs_fc["cloud_cover"].isna()]["timestamp_utc"].tolist()
    assert len(cc_missing_ts) == 1
    assert str(cc_missing_ts[0]).startswith("2021-03-23")

    # Verify exact precipitation missing timestamps (1 at start, 345 in Nov-Dec 2022)
    p_missing = gfs_fc[gfs_fc["precipitation"].isna()]
    assert len(p_missing) == 346
    p_ts = pd.to_datetime(p_missing["timestamp_utc"], utc=True)
    assert (p_ts == "2021-03-23T00:00:00+00:00").sum() == 1
    assert ((p_ts >= "2022-11-29T20:00:00+00:00") & (p_ts <= "2022-12-14T04:00:00+00:00")).sum() == 345

    # Verify that missing values were NOT filled with zero
    # For instance, at 2022-12-01 00:00:00, precipitation feature must be NaN, NOT 0.0
    nan_sample_row = train[train["target_valid_time_utc"] == "2022-12-01 00:00:00+00:00"]
    if not nan_sample_row.empty:
        val = nan_sample_row["feat_nwp_precipitation_gfs_seamless"].iloc[0]
        assert np.isnan(val), f"GFS precip missing value was improperly filled with: {val}"

def test_rainfall_target_threshold(processed_data):
    """
    Test 4: Verify rainfall target threshold.
    Rain occurrence target must equal 1 if and only if precipitation >= 0.1 mm.
    """
    train = processed_data["train"]
    rain_occ = train["target_obs_rain_occurrence_lead1h"]
    rain_amt = train["target_obs_precipitation_lead1h"]

    mismatch = (rain_occ == 1) != (rain_amt >= 0.1)
    assert mismatch.sum() == 0, f"Found {mismatch.sum()} rows violating binary rain threshold rule"
    assert set(rain_occ.unique()).issubset({0, 1}), f"Non-binary values in rain occurrence: {rain_occ.unique()}"

def test_exact_plus_1h_target_alignment(processed_data):
    """
    Test 5: Verify exact +1h prediction target alignment.
    target_valid_time_utc must equal timestamp_utc + 1 hour for every single row.
    """
    train = processed_data["train"]
    t_ref = pd.to_datetime(train["timestamp_utc"], utc=True)
    t_tgt = pd.to_datetime(train["target_valid_time_utc"], utc=True)
    step_hours = (t_tgt - t_ref).dt.total_seconds() / 3600.0

    assert (step_hours == 1.0).all(), "Prediction horizon is not strictly +1 hour"

def test_feature_null_reporting(processed_data):
    """
    Test 6: Verify feature null reporting.
    Only GFS features should contain nulls in the 56 features; all diurnal and observation
    lag features must have 0 nulls.
    """
    train = processed_data["train"]
    feat_cols = [c for c in train.columns if c.startswith("feat_")]
    assert len(feat_cols) == 56, f"Expected 56 features, got {len(feat_cols)}"

    non_gfs_feats = [c for c in feat_cols if "gfs_seamless" not in c]
    for c in non_gfs_feats:
        assert train[c].isna().sum() == 0, f"Feature {c} unexpectedly contains nulls"

def test_feature_target_leakage(processed_data):
    """
    Test 7: Verify feature / target leakage barrier.
    1. No target columns in feature list.
    2. Observation lag t0 features must strictly match observations at reference time t (not t+1h).
    3. Target values must match observations at t+1h.
    """
    train = processed_data["train"]
    obs = processed_data["obs"]

    target_cols = [c for c in train.columns if c.startswith("target_")]
    feat_cols = [c for c in train.columns if c.startswith("feat_")]
    assert set(target_cols).isdisjoint(set(feat_cols)), "Namespace collision between features and targets"

    # Merge on reference timestamp t
    m = train.merge(obs, on="timestamp_utc")
    assert np.isclose(m["feat_obs_temperature_2m_t0"], m["temperature_2m"]).all(), "feat_obs_temperature_2m_t0 leaked!"
    assert np.isclose(m["feat_obs_precipitation_t0"], m["precipitation"]).all(), "feat_obs_precipitation_t0 leaked!"

    # Check target matches t+1h observation
    obs_lead1 = obs.copy()
    obs_lead1["timestamp_utc_ref"] = obs_lead1["timestamp_utc"] - pd.Timedelta(hours=1)
    m_lead = train.merge(obs_lead1, left_on="timestamp_utc", right_on="timestamp_utc_ref")
    assert np.isclose(m_lead["target_obs_temperature_2m_lead1h"], m_lead["temperature_2m"]).all(), "Target temp does not match t+1h!"
    assert np.isclose(m_lead["target_obs_precipitation_lead1h"], m_lead["precipitation"]).all(), "Target precip does not match t+1h!"

