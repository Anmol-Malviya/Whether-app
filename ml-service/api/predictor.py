import logging
import json
from pathlib import Path
from typing import Dict, Any, Optional
import xgboost as xgb
import numpy as np
from api.config import settings
from api.schemas import PredictionRequest, PredictionResponse
from api.feature_builder import build_features_from_observations
from datetime import datetime, timezone, timedelta

logger = logging.getLogger("ml_service.predictor")


class ModelPredictor:
    """
    Manages loading and inference for the VayuDrishti observation-only ML models
    using pure native XGBoost Booster & NumPy (zero scikit-learn, scipy, or pandas bloat).
    """

    def __init__(self):
        self.temp_artifact: Optional[Dict[str, Any]] = None
        self.rain_artifact: Optional[Dict[str, Any]] = None
        self._temp_booster: Optional[xgb.Booster] = None
        self._rain_booster: Optional[xgb.Booster] = None
        self.temp_best_iteration: Optional[int] = None
        self.rain_best_iteration: Optional[int] = None
        self.features = []
        self.rain_threshold: float = 0.5
        self.is_loaded: bool = False

    @property
    def temp_model(self):
        return self._temp_booster

    @property
    def rain_model(self):
        return self._rain_booster

    @property
    def temp_booster(self):
        return self._temp_booster

    @temp_booster.setter
    def temp_booster(self, val):
        self._temp_booster = val

    @property
    def rain_booster(self):
        return self._rain_booster

    @rain_booster.setter
    def rain_booster(self, val):
        self._rain_booster = val

    def _resolve_path(self, filename: str) -> Path:
        """Resolves path across different runtimes and deployment structures."""
        candidates = [
            Path("ml-service/models") / filename,
            Path("models") / filename,
            Path(__file__).resolve().parent.parent / "models" / filename,
        ]
        for p in candidates:
            if p.exists():
                return p
        return candidates[0]

    def load_models(self) -> None:
        """Loads native XGBoost booster models and JSON metadata."""
        temp_json = self._resolve_path("temperature_booster.json")
        rain_json = self._resolve_path("rain_booster.json")
        temp_meta_path = self._resolve_path("temperature_meta.json")
        rain_meta_path = self._resolve_path("rain_meta.json")

        if temp_json.exists() and rain_json.exists():
            logger.info(f"Loading native XGBoost boosters from {temp_json} and {rain_json}")
            self.temp_booster = xgb.Booster()
            self.temp_booster.load_model(str(temp_json))

            self.rain_booster = xgb.Booster()
            self.rain_booster.load_model(str(rain_json))

            with open(temp_meta_path, "r", encoding="utf-8") as f:
                self.temp_artifact = json.load(f)
            with open(rain_meta_path, "r", encoding="utf-8") as f:
                self.rain_artifact = json.load(f)

            self.temp_best_iteration = self.temp_artifact.get("best_iteration")
            self.rain_best_iteration = self.rain_artifact.get("best_iteration")
            self.features = self.temp_artifact.get("features", [])
            self.rain_threshold = float(self.rain_artifact.get("selected_threshold", 0.5))

            logger.info(
                f"Successfully loaded native boosters. Feature count: {len(self.features)}, "
                f"Rain threshold: {self.rain_threshold}"
            )
            self.is_loaded = True
            return

        raise FileNotFoundError(f"Native model boosters not found at {temp_json} or {rain_json}")

    def get_info(self) -> Dict[str, Any]:
        """Returns model info, target horizons, feature count, and selected rain threshold."""
        if not self.is_loaded or not self.temp_artifact or not self.rain_artifact:
            return {"status": "unloaded"}

        return {
            "temperature_model": {
                "model_type": self.temp_artifact.get("model_type", "XGBRegressor"),
                "target_horizon": "1h",
                "target_variable": self.temp_artifact.get("target", "temperature"),
                "feature_count": len(self.features),
                "features": self.features,
                "dataset_version": self.temp_artifact.get("dataset_version", "1.0"),
                "versions": self.temp_artifact.get("versions", {}),
                "metrics": self.temp_artifact.get("metrics", {})
            },
            "rain_model": {
                "model_type": self.rain_artifact.get("model_type", "XGBClassifier"),
                "target_horizon": "1h",
                "target_variable": self.rain_artifact.get("target", "rain_occurrence"),
                "feature_count": len(self.features),
                "features": self.features,
                "selected_rain_threshold": self.rain_threshold,
                "dataset_version": self.rain_artifact.get("dataset_version", "1.0"),
                "versions": self.rain_artifact.get("versions", {}),
                "metrics": self.rain_artifact.get("metrics", {})
            }
        }

    def predict(self, request: PredictionRequest) -> PredictionResponse:
        """
        Executes prediction pipeline using pure native XGBoost Booster & NumPy:
        1. Builds 32 model features from 3 hourly observations as numpy array
        2. Wraps in DMatrix with feature_names
        3. Predicts next-hour temperature and rain occurrence
        """
        if not self.is_loaded or self.temp_booster is None or self.rain_booster is None:
            raise RuntimeError("ML models are not loaded or currently unavailable.")

        # Build exactly the 32 model features in the saved order as (1, 32) numpy float32 array
        X = build_features_from_observations(
            observations=request.observations,
            expected_feature_order=self.features,
            timezone_str=settings.LOCAL_TIMEZONE
        )

        dmatrix = xgb.DMatrix(X, feature_names=self.features)

        # Temperature prediction (Celsius)
        temp_iter = (0, self.temp_best_iteration + 1) if self.temp_best_iteration is not None else (0, 0)
        temp_pred = float(self.temp_booster.predict(dmatrix, iteration_range=temp_iter)[0])

        # Rain prediction (Probability + Classification)
        rain_iter = (0, self.rain_best_iteration + 1) if self.rain_best_iteration is not None else (0, 0)
        rain_prob = float(self.rain_booster.predict(dmatrix, iteration_range=rain_iter)[0])
        rain_class = bool(rain_prob >= self.rain_threshold)

        # Timestamps
        t0 = request.observations[2].timestamp_utc
        target_lead_time_utc = t0 + timedelta(hours=1)
        prediction_timestamp_utc = datetime.now(timezone.utc)

        model_version = {
            "temperature_model_type": self.temp_artifact.get("model_type", "XGBRegressor"),
            "rain_model_type": self.rain_artifact.get("model_type", "XGBClassifier"),
            "dataset_version": self.temp_artifact.get("dataset_version", "1.0"),
            "system_versions": self.temp_artifact.get("versions", {}),
        }

        return PredictionResponse(
            target_lead_time_utc=target_lead_time_utc,
            temperature_celsius_prediction=round(temp_pred, 2),
            rain_probability=round(rain_prob, 4),
            rain_classification=rain_class,
            selected_rain_threshold=self.rain_threshold,
            prediction_timestamp_utc=prediction_timestamp_utc,
            model_version=model_version
        )


predictor = ModelPredictor()
