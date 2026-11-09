import logging
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
import joblib
import pandas as pd
from api.config import settings
from api.schemas import PredictionRequest, PredictionResponse
from api.feature_builder import build_features_from_observations
from datetime import datetime, timezone, timedelta

logger = logging.getLogger("ml_service.predictor")


class ModelPredictor:
    """
    Manages loading and inference for the WeatherPulse observation-only ML models:
    - Temperature regression model (lead 1h)
    - Rain occurrence classification model (lead 1h)
    """

    def __init__(self):
        self.temp_artifact: Optional[Dict[str, Any]] = None
        self.rain_artifact: Optional[Dict[str, Any]] = None
        self.temp_model = None
        self.rain_model = None
        self.features = []
        self.rain_threshold: float = 0.5
        self.is_loaded: bool = False

    def load_models(self) -> None:
        """
        Loads models from disk configured in settings.
        Maintains model configuration, versions, and validation-selected rain threshold.
        """
        temp_path = Path(settings.TEMPERATURE_MODEL_PATH)
        rain_path = Path(settings.RAIN_MODEL_PATH)

        if not temp_path.exists():
            raise FileNotFoundError(f"Temperature model artifact not found at {temp_path.resolve()}")
        if not rain_path.exists():
            raise FileNotFoundError(f"Rain model artifact not found at {rain_path.resolve()}")

        logger.info(f"Loading temperature model from {temp_path}")
        self.temp_artifact = joblib.load(temp_path)
        self.temp_model = self.temp_artifact["model"]

        logger.info(f"Loading rain model from {rain_path}")
        self.rain_artifact = joblib.load(rain_path)
        self.rain_model = self.rain_artifact["model"]

        # Features and threshold
        self.features = self.temp_artifact.get("features", [])
        self.rain_threshold = float(self.rain_artifact.get("selected_threshold", 0.5))

        logger.info(
            f"Successfully loaded models. Feature count: {len(self.features)}, "
            f"Rain threshold: {self.rain_threshold}"
        )
        self.is_loaded = True

    def get_info(self) -> Dict[str, Any]:
        """Returns model info, target horizons, feature count, and selected rain threshold."""
        if not self.is_loaded:
            return {"status": "unloaded"}

        return {
            "temperature_model": {
                "model_type": self.temp_artifact.get("model_type"),
                "target_horizon": "1h",
                "target_variable": self.temp_artifact.get("target"),
                "feature_count": len(self.temp_artifact.get("features", [])),
                "features": self.temp_artifact.get("features", []),
                "dataset_version": self.temp_artifact.get("dataset_version"),
                "versions": self.temp_artifact.get("versions", {}),
                "metrics": self.temp_artifact.get("metrics", {})
            },
            "rain_model": {
                "model_type": self.rain_artifact.get("model_type"),
                "target_horizon": "1h",
                "target_variable": self.rain_artifact.get("target"),
                "feature_count": len(self.rain_artifact.get("features", [])),
                "features": self.rain_artifact.get("features", []),
                "selected_rain_threshold": self.rain_threshold,
                "dataset_version": self.rain_artifact.get("dataset_version"),
                "versions": self.rain_artifact.get("versions", {}),
                "metrics": self.rain_artifact.get("metrics", {})
            }
        }

    def predict(self, request: PredictionRequest) -> PredictionResponse:
        """
        Executes prediction pipeline:
        1. Verifies models are loaded
        2. Builds 32 model features from 3 hourly observations
        3. Predicts next-hour temperature
        4. Predicts rain occurrence probability and evaluates against validation threshold
        """
        if not self.is_loaded or self.temp_model is None or self.rain_model is None:
            raise RuntimeError("ML models are not loaded or currently unavailable.")

        # Build exactly the 32 model features in the saved order
        X = build_features_from_observations(
            observations=request.observations,
            expected_feature_order=self.features,
            timezone_str=settings.LOCAL_TIMEZONE
        )

        # Temperature prediction (Celsius)
        temp_pred = float(self.temp_model.predict(X)[0])

        # Rain prediction (Probability + Classification)
        proba = self.rain_model.predict_proba(X)
        # Class 1 is rain occurrence
        rain_prob = float(proba[0][1])
        rain_class = bool(rain_prob >= self.rain_threshold)

        # Timestamps
        # latest observation is index 2 (t0)
        t0 = request.observations[2].timestamp_utc
        target_lead_time_utc = t0 + timedelta(hours=1)
        prediction_timestamp_utc = datetime.now(timezone.utc)

        model_version = {
            "temperature_model_type": self.temp_artifact.get("model_type"),
            "rain_model_type": self.rain_artifact.get("model_type"),
            "dataset_version": self.temp_artifact.get("dataset_version"),
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

