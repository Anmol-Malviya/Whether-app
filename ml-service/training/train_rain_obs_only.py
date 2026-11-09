"""
train_rain_obs_only.py - Phase 4.1 Leakage-Safe Rain Occurrence Model.

Predicts target_obs_rain_occurrence_lead1h using strictly 32 calendar and observation lag features.
Excludes all NWP / reanalysis features.
Trains on 2021-2022 data with class imbalance weighting.
Tunes optimal probability threshold on 2023 Validation data only (sweeps 0.01 to 0.99 for F1).
Performs final unbiased evaluation on untouched 2024 Test data.
Compares against Persistence baseline and Training-Set Climatology.
Saves artifact to ml-service/models/rain_model_obs_only.joblib.
"""

import sys
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
import sklearn

sys.path.insert(0, str(Path(__file__).parent))

from dataset_loader_yearly import load_and_split_yearly_data, OBS_ONLY_FEATURES
from baseline import (
    get_rain_occurrence_persistence_predictions,
    get_rain_probability_persistence,
)
from evaluate import (
    find_best_rain_threshold,
    evaluate_rain_predictions,
    analyze_rainfall_distribution,
    analyze_rain_calibration,
)


TARGET_COL = "target_obs_rain_occurrence_lead1h"
MODEL_DIR = Path("ml-service/models")
MODEL_PATH = MODEL_DIR / "rain_model_obs_only.joblib"


def train_rain_obs_only(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    test_df: pd.DataFrame,
    meta: dict,
    random_state: int = 42
) -> dict:
    """
    Trains XGBoost Classifier with scale_pos_weight on 2021-2022,
    selects probability threshold on 2023 validation,
    and evaluates on 2024 test data.
    """
    X_train = train_df[OBS_ONLY_FEATURES]
    y_train = train_df[TARGET_COL].to_numpy().astype(int)

    X_val = val_df[OBS_ONLY_FEATURES]
    y_val = val_df[TARGET_COL].to_numpy().astype(int)

    X_test = test_df[OBS_ONLY_FEATURES]
    y_test = test_df[TARGET_COL].to_numpy().astype(int)

    # Class imbalance weight derived strictly from training set
    neg_count = int(np.sum(y_train == 0))
    pos_count = int(np.sum(y_train == 1))
    scale_pos_weight = float(neg_count / pos_count) if pos_count > 0 else 1.0

    model_params = {
        "n_estimators": 150,
        "max_depth": 5,
        "learning_rate": 0.08,
        "scale_pos_weight": scale_pos_weight,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "random_state": random_state,
        "n_jobs": -1,
        "early_stopping_rounds": 15,
        "eval_metric": "logloss",
    }

    classifier = xgb.XGBClassifier(**model_params)

    classifier.fit(
        X_train,
        y_train,
        eval_set=[(X_train, y_train), (X_val, y_val)],
        verbose=False,
    )

    best_iteration = int(classifier.best_iteration) if hasattr(classifier, "best_iteration") else model_params["n_estimators"]

    # Predict probabilities
    train_probs = classifier.predict_proba(X_train)[:, 1]
    val_probs = classifier.predict_proba(X_val)[:, 1]
    test_probs = classifier.predict_proba(X_test)[:, 1]

    # Select threshold using VALIDATION DATA (2023) ONLY
    selected_threshold, val_best_f1 = find_best_rain_threshold(y_val, val_probs, metric="f1")

    # Binary predictions using selected validation threshold
    train_preds = (train_probs >= selected_threshold).astype(int)
    val_preds = (val_probs >= selected_threshold).astype(int)
    test_preds = (test_probs >= selected_threshold).astype(int)

    # Baseline 1: Persistence (binary predictions and probabilities)
    pers_train = get_rain_occurrence_persistence_predictions(train_df)
    pers_val = get_rain_occurrence_persistence_predictions(val_df)
    pers_test = get_rain_occurrence_persistence_predictions(test_df)

    # Persistence probability: deterministic 0.0 or 1.0 based on current observation
    pers_train_prob = pers_train.astype(float)
    pers_val_prob = pers_val.astype(float)
    pers_test_prob = pers_test.astype(float)

    # Baseline 2: Training set climatology probability
    train_rain_prevalence = float(np.mean(y_train))
    climatology_train_prob = get_rain_probability_persistence(train_df, train_rain_prevalence)
    climatology_val_prob = get_rain_probability_persistence(val_df, train_rain_prevalence)
    climatology_test_prob = get_rain_probability_persistence(test_df, train_rain_prevalence)

    metrics = {
        "train": {
            "model": evaluate_rain_predictions(y_train, train_preds, train_probs),
            "persistence": evaluate_rain_predictions(y_train, pers_train, pers_train_prob),
            "climatology": evaluate_rain_predictions(y_train, (climatology_train_prob >= 0.5).astype(int), climatology_train_prob),
        },
        "validation": {
            "model": evaluate_rain_predictions(y_val, val_preds, val_probs),
            "persistence": evaluate_rain_predictions(y_val, pers_val, pers_val_prob),
            "climatology": evaluate_rain_predictions(y_val, (climatology_val_prob >= 0.5).astype(int), climatology_val_prob),
        },
        "test": {
            "model": evaluate_rain_predictions(y_test, test_preds, test_probs),
            "persistence": evaluate_rain_predictions(y_test, pers_test, pers_test_prob),
            "climatology": evaluate_rain_predictions(y_test, (climatology_test_prob >= 0.5).astype(int), climatology_test_prob),
        },
    }

    # Seasonal rainfall distribution across years
    precip_target_col = "target_obs_precipitation_lead1h"
    seasonal_rain_stats = {
        "overall": analyze_rainfall_distribution(
            pd.concat([train_df[precip_target_col], val_df[precip_target_col], test_df[precip_target_col]]).to_numpy()
        ),
        "train_2021_2022": analyze_rainfall_distribution(train_df[precip_target_col].to_numpy()),
        "validation_2023": analyze_rainfall_distribution(val_df[precip_target_col].to_numpy()),
        "test_2024": analyze_rainfall_distribution(test_df[precip_target_col].to_numpy()),
    }

    # Rain calibration and reliability diagram analysis
    calibration_analysis = {
        "validation_2023": analyze_rain_calibration(y_val, val_probs),
        "test_2024": analyze_rain_calibration(y_test, test_probs),
    }

    # Save artifact
    artifact = {
        "model_type": "XGBClassifier",
        "target": TARGET_COL,
        "features": OBS_ONLY_FEATURES,
        "feature_count": len(OBS_ONLY_FEATURES),
        "model_params": {k: v for k, v in model_params.items() if k != "eval_metric"},
        "best_iteration": best_iteration,
        "random_state": random_state,
        "scale_pos_weight": scale_pos_weight,
        "selected_threshold": selected_threshold,
        "validation_f1_at_threshold": val_best_f1,
        "training_set_climatology_prevalence": train_rain_prevalence,
        "training_date_range": {
            "start_utc": meta["splits"]["train"]["start_utc"],
            "end_utc": meta["splits"]["train"]["end_utc"],
            "rows": meta["splits"]["train"]["rows"],
        },
        "validation_date_range": {
            "start_utc": meta["splits"]["validation"]["start_utc"],
            "end_utc": meta["splits"]["validation"]["end_utc"],
            "rows": meta["splits"]["validation"]["rows"],
        },
        "dataset_version": meta["dataset_path"],
        "versions": {
            "python": sys.version,
            "xgboost": xgb.__version__,
            "scikit_learn": sklearn.__version__,
            "joblib": joblib.__version__,
        },
        "metrics": metrics,
        "calibration_analysis": calibration_analysis,
        "seasonal_rain_stats": seasonal_rain_stats,
        "model": classifier,
    }

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, MODEL_PATH)

    # Verification: test loading artifact
    loaded = joblib.load(MODEL_PATH)
    test_load_prob = loaded["model"].predict_proba(X_test.iloc[:5])[:, 1]
    np.testing.assert_allclose(test_load_prob, test_probs[:5], rtol=1e-5)
    print(f"[Rain Obs-Only] Model saved and verified at: {MODEL_PATH}")

    return {
        "model_path": str(MODEL_PATH),
        "selected_threshold": selected_threshold,
        "validation_f1_at_threshold": val_best_f1,
        "metrics": metrics,
        "best_iteration": best_iteration,
        "calibration_analysis": calibration_analysis,
        "seasonal_rain_stats": seasonal_rain_stats,
        "climatology_prevalence": train_rain_prevalence,
    }


if __name__ == "__main__":
    train_df, val_df, test_df, meta = load_and_split_yearly_data()
    print("Yearly Chronological Splits:")
    for split_name, s_meta in meta["splits"].items():
        print(f"  {split_name.capitalize()} ({s_meta['years']}): {s_meta['rows']} rows ({s_meta['start_utc']} -> {s_meta['end_utc']})")

    results = train_rain_obs_only(train_df, val_df, test_df, meta)
    print(f"\n--- Rain (Obs-Only) Evaluation Summary (Selected Threshold: {results['selected_threshold']}) ---")
    print("Validation Model:", results["metrics"]["validation"]["model"])
    print("Validation Persistence:", results["metrics"]["validation"]["persistence"])
    print("Validation Climatology:", results["metrics"]["validation"]["climatology"])
    print("Test Model:", results["metrics"]["test"]["model"])
    print("Test Persistence:", results["metrics"]["test"]["persistence"])
    print("Test Climatology:", results["metrics"]["test"]["climatology"])
