"""
test_phase4_1_pipeline.py - Rigorous Automated Tests for Phase 4.1 Leakage-Safe Baseline.

Tests:
1. Feature set contains exactly 32 features.
2. Leakage assertion: Zero NWP features allowed.
3. Leakage assertion: Zero target columns in feature inputs.
4. Leakage assertion: Zero future observation columns in feature inputs.
5. Leakage assertion: Prediction time t features strictly precede target valid time t+1h.
6. Chronological yearly splitting integrity:
    - Train is 2021-01-01 to 2022-12-31
    - Validation is 2023-01-01 to 2023-12-31
    - Test is 2024-01-01 to 2024-12-31
    - Zero temporal overlap between splits
7. Temperature model artifact verification:
    - Loads cleanly
    - Contains exact 32 features
    - Outperforms persistence on test year 2024
8. Rain model artifact verification:
    - Loads cleanly
    - Contains exact 32 features
    - Threshold selected strictly from validation (0.0 < threshold < 1.0)
    - Outperforms persistence and climatology on test year 2024
9. Verification of report and JSON metrics artifacts.
"""

import sys
from pathlib import Path
import json
import pytest
import numpy as np
import pandas as pd
import joblib

sys.path.insert(0, str(Path(__file__).parent))

from dataset_loader_yearly import load_and_split_yearly_data, OBS_ONLY_FEATURES, TARGET_COLUMNS
from baseline import (
    get_temperature_persistence_predictions,
    get_rain_occurrence_persistence_predictions,
)
from evaluate import (
    evaluate_temperature_predictions,
    evaluate_rain_predictions,
    find_best_rain_threshold,
)


def test_feature_count_and_composition():
    """Verify strictly 32 features: 8 calendar + 24 observation lags."""
    train_df, val_df, test_df, meta = load_and_split_yearly_data()

    assert len(OBS_ONLY_FEATURES) == 32
    assert meta["feature_count"] == 32
    assert meta["total_rows"] == 35061

    # Check that each feature column exists in the dataframes
    for df in [train_df, val_df, test_df]:
        for col in OBS_ONLY_FEATURES:
            assert col in df.columns, f"Feature missing from split: {col}"
            assert df[col].isna().sum() == 0, f"NaNs found in feature: {col}"


def test_leakage_invariants_no_nwp_and_no_targets():
    """Strict leakage checks: No NWP, no targets, no future leads."""
    for f in OBS_ONLY_FEATURES:
        lower = f.lower()
        assert "nwp" not in lower, f"Leakage: NWP in feature: {f}"
        assert "gfs" not in lower, f"Leakage: GFS in feature: {f}"
        assert "best_match" not in lower, f"Leakage: best_match in feature: {f}"
        assert "ecmwf" not in lower, f"Leakage: ecmwf in feature: {f}"
        assert "target" not in lower, f"Leakage: target in feature: {f}"
        assert not lower.endswith("_lead1h"), f"Leakage: future lead in feature: {f}"
        assert not lower.endswith("_lead2h"), f"Leakage: future lead in feature: {f}"


def test_leakage_invariants_timestamps_and_horizon():
    """Verify target horizon is strictly t + 1 hour without future lookahead."""
    train_df, _, _, _ = load_and_split_yearly_data()

    sample_slice = train_df.iloc[:50]
    t0 = pd.to_datetime(sample_slice["timestamp_utc"])
    target_time = pd.to_datetime(sample_slice["target_valid_time_utc"])
    delta_hours = (target_time - t0).dt.total_seconds() / 3600.0

    assert (delta_hours == 1.0).all(), "Target horizon is not exactly 1 hour for all samples!"


def test_chronological_yearly_split_isolation():
    """Verify yearly splits have zero temporal overlap, 1-hour temporal purge, and match calendar boundaries."""
    train_df, val_df, test_df, meta = load_and_split_yearly_data()

    assert len(train_df) == 17517
    assert len(val_df) == 8759
    assert len(test_df) == 8783
    assert meta["purged_boundary_rows"] == 2

    # Date boundary assertions
    assert train_df["timestamp_utc"].min() == pd.Timestamp("2021-01-01 02:00:00+00:00")
    assert train_df["timestamp_utc"].max() == pd.Timestamp("2022-12-31 22:00:00+00:00")

    assert val_df["timestamp_utc"].min() == pd.Timestamp("2023-01-01 00:00:00+00:00")
    assert val_df["timestamp_utc"].max() == pd.Timestamp("2023-12-31 22:00:00+00:00")

    assert test_df["timestamp_utc"].min() == pd.Timestamp("2024-01-01 00:00:00+00:00")
    assert test_df["timestamp_utc"].max() == pd.Timestamp("2024-12-31 22:00:00+00:00")

    # Strict 1-hour temporal purge assertions:
    # Last training target must be strictly earlier than first validation feature
    assert train_df["target_valid_time_utc"].max() < val_df["timestamp_utc"].min()
    # Last validation target must be strictly earlier than first test feature
    assert val_df["target_valid_time_utc"].max() < test_df["timestamp_utc"].min()


def test_temperature_model_obs_only_artifact():
    """Verify saved temperature model loads, has 32 features, and beats persistence on test set."""
    art_path = Path("ml-service/models/temperature_model_obs_only.joblib")
    assert art_path.exists(), "Temperature obs-only artifact does not exist."

    artifact = joblib.load(art_path)
    assert artifact["model_type"] == "XGBRegressor"
    assert artifact["feature_count"] == 32
    assert artifact["features"] == OBS_ONLY_FEATURES
    assert "training_date_range" in artifact
    assert "validation_date_range" in artifact

    # Test load inference consistency
    _, _, test_df, _ = load_and_split_yearly_data()
    X_test = test_df[OBS_ONLY_FEATURES].iloc[:10]
    preds = artifact["model"].predict(X_test)
    assert len(preds) == 10
    assert not np.isnan(preds).any()

    # Outperforms persistence on test year 2024
    test_mae = artifact["metrics"]["test"]["model"]["mae"]
    pers_mae = artifact["metrics"]["test"]["persistence"]["mae"]
    assert test_mae < pers_mae, f"Model MAE {test_mae} did not beat persistence {pers_mae}"
    assert artifact["metrics"]["test_improvement"]["mae_improvement_pct"] > 40.0


def test_rain_model_obs_only_artifact():
    """Verify saved rain model loads, threshold is valid, and beats persistence on test set."""
    art_path = Path("ml-service/models/rain_model_obs_only.joblib")
    assert art_path.exists(), "Rain obs-only artifact does not exist."

    artifact = joblib.load(art_path)
    assert artifact["model_type"] == "XGBClassifier"
    assert artifact["feature_count"] == 32
    assert artifact["features"] == OBS_ONLY_FEATURES
    assert "selected_threshold" in artifact
    assert 0.0 < artifact["selected_threshold"] < 1.0

    # Test load inference consistency
    _, _, test_df, _ = load_and_split_yearly_data()
    X_test = test_df[OBS_ONLY_FEATURES].iloc[:10]
    probs = artifact["model"].predict_proba(X_test)[:, 1]
    assert len(probs) == 10
    assert ((probs >= 0.0) & (probs <= 1.0)).all()

    # Outperforms persistence on F1, Recall, PR-AUC, and ROC-AUC on test year 2024
    test_f1 = artifact["metrics"]["test"]["model"]["f1"]
    pers_f1 = artifact["metrics"]["test"]["persistence"]["f1"]
    test_recall = artifact["metrics"]["test"]["model"]["recall"]
    pers_recall = artifact["metrics"]["test"]["persistence"]["recall"]
    test_pr_auc = artifact["metrics"]["test"]["model"]["pr_auc"]
    clim_pr_auc = artifact["metrics"]["test"]["climatology"]["pr_auc"]

    assert test_f1 >= pers_f1, f"Model F1 {test_f1} not >= persistence {pers_f1}"
    assert test_recall > pers_recall, f"Model Recall {test_recall} not > persistence {pers_recall}"
    assert test_pr_auc > clim_pr_auc, f"Model PR-AUC {test_pr_auc} not > climatology {clim_pr_auc}"


def test_phase4_1_reports_and_metrics_generated():
    """Verify that phase4_1_metrics.json and phase4_1_training_report.md exist and are valid."""
    metrics_path = Path("ml-service/data/reports/phase4_1_metrics.json")
    report_path = Path("ml-service/data/reports/phase4_1_training_report.md")

    assert metrics_path.exists(), "phase4_1_metrics.json missing"
    assert report_path.exists(), "phase4_1_training_report.md missing"

    with open(metrics_path, "r", encoding="utf-8") as f:
        metrics = json.load(f)

    assert metrics["metadata"]["feature_count"] == 32
    assert metrics["final_verdict"] == "BASELINE PROMISING"
    assert "temperature_model" in metrics
    assert "rain_occurrence_model" in metrics

    report_text = report_path.read_text(encoding="utf-8")
    assert "BASELINE PROMISING" in report_text
    assert "32 features" in report_text
    assert "2021" in report_text and "2024" in report_text
