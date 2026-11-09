"""
train_temperature_obs_only.py - Phase 4.1 Leakage-Safe Temperature Model.

Predicts target_obs_temperature_2m_lead1h using strictly 32 calendar and observation lag features.
Excludes all NWP / reanalysis features.
Evaluates on Train (2021-2022), Validation (2023), and Test (2024).
Compares directly against the persistence baseline (current observed temperature at t0).
Saves artifact to ml-service/models/temperature_model_obs_only.joblib.
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
from baseline import get_temperature_persistence_predictions
from evaluate import evaluate_temperature_predictions


TARGET_COL = "target_obs_temperature_2m_lead1h"
CURRENT_TEMP_COL = "feat_obs_temperature_2m_t0"
MODEL_DIR = Path("ml-service/models")
MODEL_PATH = MODEL_DIR / "temperature_model_obs_only.joblib"


def train_temperature_obs_only(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    test_df: pd.DataFrame,
    meta: dict,
    random_state: int = 42
) -> dict:
    """
    Trains XGBoost Regressor on 2021-2022, uses 2023 validation for early stopping,
    and performs unbiased final evaluation on 2024 test data.
    """
    X_train = train_df[OBS_ONLY_FEATURES]
    y_train = train_df[TARGET_COL]

    X_val = val_df[OBS_ONLY_FEATURES]
    y_val = val_df[TARGET_COL]

    X_test = test_df[OBS_ONLY_FEATURES]
    y_test = test_df[TARGET_COL]

    model_params = {
        "n_estimators": 150,
        "max_depth": 5,
        "learning_rate": 0.08,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "random_state": random_state,
        "n_jobs": -1,
        "early_stopping_rounds": 15,
        "eval_metric": "rmse",
    }

    regressor = xgb.XGBRegressor(**model_params)

    regressor.fit(
        X_train,
        y_train,
        eval_set=[(X_train, y_train), (X_val, y_val)],
        verbose=False,
    )

    best_iteration = int(regressor.best_iteration) if hasattr(regressor, "best_iteration") else model_params["n_estimators"]

    # Predictions
    y_train_pred = regressor.predict(X_train)
    y_val_pred = regressor.predict(X_val)
    y_test_pred = regressor.predict(X_test)

    # Persistence predictions
    pers_train = get_temperature_persistence_predictions(train_df, CURRENT_TEMP_COL)
    pers_val = get_temperature_persistence_predictions(val_df, CURRENT_TEMP_COL)
    pers_test = get_temperature_persistence_predictions(test_df, CURRENT_TEMP_COL)

    # Metrics
    metrics = {
        "train": {
            "model": evaluate_temperature_predictions(y_train.to_numpy(), y_train_pred),
            "persistence": evaluate_temperature_predictions(y_train.to_numpy(), pers_train),
        },
        "validation": {
            "model": evaluate_temperature_predictions(y_val.to_numpy(), y_val_pred),
            "persistence": evaluate_temperature_predictions(y_val.to_numpy(), pers_val),
        },
        "test": {
            "model": evaluate_temperature_predictions(y_test.to_numpy(), y_test_pred),
            "persistence": evaluate_temperature_predictions(y_test.to_numpy(), pers_test),
        },
    }

    test_model_mae = metrics["test"]["model"]["mae"]
    test_pers_mae = metrics["test"]["persistence"]["mae"]
    test_model_rmse = metrics["test"]["model"]["rmse"]
    test_pers_rmse = metrics["test"]["persistence"]["rmse"]

    metrics["test_improvement"] = {
        "mae_improvement_pct": round(((test_pers_mae - test_model_mae) / test_pers_mae) * 100, 2),
        "rmse_improvement_pct": round(((test_pers_rmse - test_model_rmse) / test_pers_rmse) * 100, 2),
    }

    # Artifact payload
    artifact = {
        "model_type": "XGBRegressor",
        "target": TARGET_COL,
        "features": OBS_ONLY_FEATURES,
        "feature_count": len(OBS_ONLY_FEATURES),
        "model_params": {k: v for k, v in model_params.items() if k != "eval_metric"},
        "best_iteration": best_iteration,
        "random_state": random_state,
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
        "model": regressor,
    }

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, MODEL_PATH)

    # Verification: test loading artifact
    loaded = joblib.load(MODEL_PATH)
    test_load_pred = loaded["model"].predict(X_test.iloc[:5])
    np.testing.assert_allclose(test_load_pred, y_test_pred[:5], rtol=1e-5)
    print(f"[Temperature Obs-Only] Model saved and verified at: {MODEL_PATH}")

    return {
        "model_path": str(MODEL_PATH),
        "metrics": metrics,
        "best_iteration": best_iteration,
        "test_improvement": metrics["test_improvement"],
    }


if __name__ == "__main__":
    train_df, val_df, test_df, meta = load_and_split_yearly_data()
    print("Yearly Chronological Splits:")
    for split_name, s_meta in meta["splits"].items():
        print(f"  {split_name.capitalize()} ({s_meta['years']}): {s_meta['rows']} rows ({s_meta['start_utc']} -> {s_meta['end_utc']})")

    results = train_temperature_obs_only(train_df, val_df, test_df, meta)
    print("\n--- Temperature (Obs-Only) Evaluation Summary ---")
    print("Train Model:", results["metrics"]["train"]["model"])
    print("Validation Model:", results["metrics"]["validation"]["model"])
    print("Validation Persistence:", results["metrics"]["validation"]["persistence"])
    print("Test Model:", results["metrics"]["test"]["model"])
    print("Test Persistence:", results["metrics"]["test"]["persistence"])
    print("Test Improvement vs Persistence:", results["test_improvement"])

