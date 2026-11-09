"""
train_temperature.py - Offline ML Baseline for Lead-1h Temperature Prediction.

Predicts target_obs_temperature_2m_lead1h using XGBoost Regressor.
Compares against the persistence baseline (current_observed_temperature at t0).
Saves trained model artifact to ml-service/models/temperature_model.joblib.
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
from baseline import get_temperature_persistence_predictions
from evaluate import evaluate_temperature_predictions


TARGET_COL = "target_obs_temperature_2m_lead1h"
CURRENT_TEMP_COL = "feat_obs_temperature_2m_t0"
MODEL_DIR = Path("ml-service/models")
MODEL_PATH = MODEL_DIR / "temperature_model.joblib"


def train_temperature_model(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    test_df: pd.DataFrame,
    random_state: int = 42
) -> dict:
    """
    Trains XGBoost Regressor on train_df, evaluates on validation and test,
    and compares directly with the persistence baseline.
    """
    X_train = train_df[OPTION_A_FEATURES]
    y_train = train_df[TARGET_COL]

    X_val = val_df[OPTION_A_FEATURES]
    y_val = val_df[TARGET_COL]

    X_test = test_df[OPTION_A_FEATURES]
    y_test = test_df[TARGET_COL]

    # Model configuration
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

    # Fit model with early stopping on validation set
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

    # Relative improvement on test set
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
        "features": OPTION_A_FEATURES,
        "feature_count": len(OPTION_A_FEATURES),
        "model_params": {k: v for k, v in model_params.items() if k != "eval_metric"},
        "best_iteration": best_iteration,
        "random_state": random_state,
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
    print(f"[Temperature] Model saved and verified at: {MODEL_PATH}")

    return {
        "model_path": str(MODEL_PATH),
        "metrics": metrics,
        "best_iteration": best_iteration,
        "test_improvement": metrics["test_improvement"],
    }


if __name__ == "__main__":
    train_df, val_df, test_df, meta = load_and_split_data()
    print("Loaded data splits:")
    for split_name, s_meta in meta["splits"].items():
        print(f"  {split_name.capitalize()}: {s_meta['rows']} rows ({s_meta['start_utc']} -> {s_meta['end_utc']})")
    
    results = train_temperature_model(train_df, val_df, test_df)
    print("\n--- Temperature Evaluation Summary ---")
    print("Validation Model:", results["metrics"]["validation"]["model"])
    print("Validation Persistence:", results["metrics"]["validation"]["persistence"])
    print("Test Model:", results["metrics"]["test"]["model"])
    print("Test Persistence:", results["metrics"]["test"]["persistence"])
    print("Test Improvement vs Persistence:", results["test_improvement"])

