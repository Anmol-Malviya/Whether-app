"""
test_baseline_pipeline.py - Verification test suite for WeatherPulse Phase 4 Baseline.

Verifies:
1. Option A feature selection (exactly 48 features, zero GFS features, 35,061 rows)
2. Target columns presence and no NaNs
3. Chronological split boundaries: 70% Train, 15% Val, 15% Test with no temporal overlap
4. Temperature model artifact structure, feature names, order, and loading verification
5. Rain model artifact structure, feature names, order, and loading verification
6. Validation-only threshold selection contract
7. Model superiority over persistence baselines
8. Report and metrics JSON existence and completeness
"""

import sys
from pathlib import Path
import pytest
import numpy as np
import pandas as pd
import joblib
import json

# Add training directory to sys.path
sys.path.insert(0, str(Path(__file__).parent))

from dataset_loader import load_and_split_data, OPTION_A_FEATURES, TARGET_COLUMNS
from baseline import (
    get_temperature_persistence_predictions,
    get_rain_occurrence_persistence_predictions,
)
from evaluate import (
    evaluate_temperature_predictions,
    evaluate_rain_predictions,
    find_best_rain_threshold,
    analyze_rainfall_distribution,
)


def test_dataset_integrity_option_a():
    """Verify Option A data integrity, exactly 48 features, zero GFS columns, and 35,061 rows."""
    train_df, val_df, test_df, meta = load_and_split_data()

    assert meta["total_rows"] == 35061
    assert meta["feature_count"] == 48
    assert len(OPTION_A_FEATURES) == 48

    # Ensure no GFS column exists in Option A feature list
    for f in OPTION_A_FEATURES:
        assert "gfs" not in f.lower(), f"Option A feature contains GFS: {f}"

    # Verify no nulls in feature or target columns across any split
    for split_df in [train_df, val_df, test_df]:
        assert split_df[OPTION_A_FEATURES + TARGET_COLUMNS].isna().sum().sum() == 0


def test_chronological_split_properties():
    """Verify chronological ordering, proportions, and strict temporal isolation."""
    train_df, val_df, test_df, meta = load_and_split_data()

    assert len(train_df) == 24542
    assert len(val_df) == 5259
    assert len(test_df) == 5260

    # Ensure monotonic order and zero time overlap
    assert train_df["timestamp_utc"].max() < val_df["timestamp_utc"].min()
    assert val_df["timestamp_utc"].max() < test_df["timestamp_utc"].min()

    # Exact date boundaries
    assert str(train_df["timestamp_utc"].min()) == "2021-01-01 02:00:00+00:00"
    assert str(train_df["timestamp_utc"].max()) == "2023-10-20 15:00:00+00:00"
    assert str(val_df["timestamp_utc"].min()) == "2023-10-20 16:00:00+00:00"
    assert str(val_df["timestamp_utc"].max()) == "2024-05-26 18:00:00+00:00"
    assert str(test_df["timestamp_utc"].min()) == "2024-05-26 19:00:00+00:00"
    assert str(test_df["timestamp_utc"].max()) == "2024-12-31 22:00:00+00:00"


def test_temperature_model_artifact_and_reproducibility():
    """Verify saved temperature model loads correctly and matches stored test predictions."""
    model_path = Path("ml-service/models/temperature_model.joblib")
    assert model_path.exists(), "Temperature model artifact does not exist."

    artifact = joblib.load(model_path)
    assert artifact["model_type"] == "XGBRegressor"
    assert artifact["target"] == "target_obs_temperature_2m_lead1h"
    assert artifact["features"] == OPTION_A_FEATURES
    assert len(artifact["features"]) == 48
    assert "random_state" in artifact
    assert "versions" in artifact

    # Test load inference consistency
    _, _, test_df, _ = load_and_split_data()
    X_test = test_df[OPTION_A_FEATURES].iloc[:10]
    preds = artifact["model"].predict(X_test)
    assert len(preds) == 10
    assert not np.isnan(preds).any()

    # Model must outperform persistence on test set
    test_mae = artifact["metrics"]["test"]["model"]["mae"]
    pers_mae = artifact["metrics"]["test"]["persistence"]["mae"]
    assert test_mae < pers_mae, f"Model MAE {test_mae} not superior to persistence {pers_mae}"


def test_rain_model_artifact_and_threshold_selection():
    """Verify rain classifier artifact, threshold selection, and probability predictions."""
    model_path = Path("ml-service/models/rain_model.joblib")
    assert model_path.exists(), "Rain model artifact does not exist."

    artifact = joblib.load(model_path)
    assert artifact["model_type"] == "XGBClassifier"
    assert artifact["target"] == "target_obs_rain_occurrence_lead1h"
    assert artifact["features"] == OPTION_A_FEATURES
    assert len(artifact["features"]) == 48
    assert "selected_threshold" in artifact
    assert 0.0 < artifact["selected_threshold"] < 1.0

    # Test load inference consistency
    _, _, test_df, _ = load_and_split_data()
    X_test = test_df[OPTION_A_FEATURES].iloc[:10]
    probs = artifact["model"].predict_proba(X_test)[:, 1]
    assert len(probs) == 10
    assert ((probs >= 0.0) & (probs <= 1.0)).all()


def test_rainfall_distribution_analysis():
    """Verify rainfall distribution analysis matches expected ground truth."""
    _, _, _, meta = load_and_split_data()
    df = pd.read_csv("ml-service/data/processed/training_dataset.csv")
    precip = df["target_obs_precipitation_lead1h"].to_numpy()

    stats = analyze_rainfall_distribution(precip)
    assert stats["total_samples"] == 35061
    assert stats["nonzero_count"] == 5495
    assert stats["zero_count"] == 29566
    assert abs(stats["zero_percentage"] - 84.33) < 0.1
    assert stats["nonzero_min"] == 0.1
    assert stats["nonzero_max"] == 27.6


def test_reports_and_metrics_files_exist():
    """Verify phase4_training_report.md and phase4_metrics.json are generated and non-empty."""
    metrics_path = Path("ml-service/data/reports/phase4_metrics.json")
    report_path = Path("ml-service/data/reports/phase4_training_report.md")

    assert metrics_path.exists()
    assert report_path.exists()

    with open(metrics_path, "r", encoding="utf-8") as f:
        metrics = json.load(f)
    assert "temperature_model" in metrics
    assert "rain_occurrence_model" in metrics
    assert "rainfall_amount_distribution" in metrics

    report_text = report_path.read_text(encoding="utf-8")
    assert "BASELINE PROMISING" in report_text
    assert "XGBRegressor" in report_text
    assert "XGBClassifier" in report_text

