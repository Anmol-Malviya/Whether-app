"""
train_rain.py - Offline ML Baseline for Lead-1h Rain Occurrence Prediction.

Predicts target_obs_rain_occurrence_lead1h (binary classification: precip >= 0.1mm).
Uses XGBoost Classifier with class-imbalance weighting (scale_pos_weight).
Selects probability threshold on validation set only.
Evaluates Precision, Recall, F1, PR-AUC, ROC-AUC, Brier score, and Confusion Matrix.
Compares against the persistence baseline.
Saves model artifact to ml-service/models/rain_model.joblib.
"""

import sys
from pathlib import Path
import json
import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
import sklearn

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from dataset_loader import load_and_split_data, OPTION_A_FEATURES
from baseline import (
    get_rain_occurrence_persistence_predictions,
    get_rain_probability_persistence,
)
from evaluate import (
    find_best_rain_threshold,
    evaluate_rain_predictions,
    analyze_rainfall_distribution,
)


TARGET_COL = "target_obs_rain_occurrence_lead1h"
MODEL_DIR = Path("ml-service/models")
MODEL_PATH = MODEL_DIR / "rain_model.joblib"


def train_rain_model(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    test_df: pd.DataFrame,
    random_state: int = 42
) -> dict:
    """
    Trains XGBoost Classifier on train_df, tunes probability threshold on val_df,
    evaluates on test_df, and compares directly with persistence baseline.
    """
    X_train = train_df[OPTION_A_FEATURES]
    y_train = train_df[TARGET_COL].to_numpy().astype(int)

    X_val = val_df[OPTION_A_FEATURES]
    y_val = val_df[TARGET_COL].to_numpy().astype(int)

    X_test = test_df[OPTION_A_FEATURES]
    y_test = test_df[TARGET_COL].to_numpy().astype(int)

    # Class imbalance weight: count(negative) / count(positive)
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

    # Fit with early stopping on validation
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

    # Threshold selection using VALIDATION DATA ONLY
    selected_threshold, val_best_f1 = find_best_rain_threshold(y_val, val_probs, metric="f1")

    # Binary predictions using selected validation threshold
    train_preds = (train_probs >= selected_threshold).astype(int)
    val_preds = (val_probs >= selected_threshold).astype(int)
    test_preds = (test_probs >= selected_threshold).astype(int)

    # Persistence predictions
    pers_train = get_rain_occurrence_persistence_predictions(train_df)
    pers_val = get_rain_occurrence_persistence_predictions(val_df)
    pers_test = get_rain_occurrence_persistence_predictions(test_df)

    # Climatology probability for Brier score baseline
    train_rain_prevalence = float(np.mean(y_train))
    pers_train_prob = get_rain_probability_persistence(train_df, train_rain_prevalence)
    pers_val_prob = get_rain_probability_persistence(val_df, train_rain_prevalence)
    pers_test_prob = get_rain_probability_persistence(test_df, train_rain_prevalence)

    metrics = {
        "train": {
            "model": evaluate_rain_predictions(y_train, train_preds, train_probs),
            "persistence": evaluate_rain_predictions(y_train, pers_train, pers_train_prob),
        },
        "validation": {
            "model": evaluate_rain_predictions(y_val, val_preds, val_probs),
            "persistence": evaluate_rain_predictions(y_val, pers_val, pers_val_prob),
        },
        "test": {
            "model": evaluate_rain_predictions(y_test, test_preds, test_probs),
            "persistence": evaluate_rain_predictions(y_test, pers_test, pers_test_prob),
        },
    }

    # Rainfall distribution analysis on total, train, val, and test
    precip_target_col = "target_obs_precipitation_lead1h"
    rainfall_stats = {
        "overall": analyze_rainfall_distribution(
            pd.concat([train_df[precip_target_col], val_df[precip_target_col], test_df[precip_target_col]]).to_numpy()
        ),
        "train": analyze_rainfall_distribution(train_df[precip_target_col].to_numpy()),
        "validation": analyze_rainfall_distribution(val_df[precip_target_col].to_numpy()),
        "test": analyze_rainfall_distribution(test_df[precip_target_col].to_numpy()),
    }

    # Save artifact
    artifact = {
        "model_type": "XGBClassifier",
        "target": TARGET_COL,
        "features": OPTION_A_FEATURES,
        "feature_count": len(OPTION_A_FEATURES),
        "model_params": {k: v for k, v in model_params.items() if k != "eval_metric"},
        "best_iteration": best_iteration,
        "random_state": random_state,
        "selected_threshold": selected_threshold,
        "scale_pos_weight": scale_pos_weight,
        "versions": {
            "python": sys.version,
            "xgboost": xgb.__version__,
            "scikit_learn": sklearn.__version__,
            "joblib": joblib.__version__,
        },
        "metrics": metrics,
        "rainfall_stats": rainfall_stats,
        "model": classifier,
    }

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, MODEL_PATH)

    # Verification: test loading artifact
    loaded = joblib.load(MODEL_PATH)
    test_load_prob = loaded["model"].predict_proba(X_test.iloc[:5])[:, 1]
    np.testing.assert_allclose(test_load_prob, test_probs[:5], rtol=1e-5)
    print(f"[Rain] Model saved and verified at: {MODEL_PATH}")

    return {
        "model_path": str(MODEL_PATH),
        "selected_threshold": selected_threshold,
        "metrics": metrics,
        "best_iteration": best_iteration,
        "rainfall_stats": rainfall_stats,
    }


if __name__ == "__main__":
    train_df, val_df, test_df, meta = load_and_split_data()
    print("Loaded data splits:")
    for split_name, s_meta in meta["splits"].items():
        print(f"  {split_name.capitalize()}: {s_meta['rows']} rows ({s_meta['start_utc']} -> {s_meta['end_utc']})")

    results = train_rain_model(train_df, val_df, test_df)
    print(f"\n--- Rain Occurrence Evaluation Summary (Selected Threshold: {results['selected_threshold']}) ---")
    print("Validation Model:", results["metrics"]["validation"]["model"])
    print("Validation Persistence:", results["metrics"]["validation"]["persistence"])
    print("Test Model:", results["metrics"]["test"]["model"])
    print("Test Persistence:", results["metrics"]["test"]["persistence"])

