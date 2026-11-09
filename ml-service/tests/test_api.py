import math
from datetime import datetime, timezone, timedelta
from pathlib import Path
import pytest
import pandas as pd
import numpy as np
from fastapi.testclient import TestClient

from api.main import app
from api.predictor import predictor, ModelPredictor
from api.feature_builder import build_features_from_observations, EXPECTED_FEATURES
from api.schemas import HourlyObservation, PredictionRequest


@pytest.fixture(scope="session", autouse=True)
def setup_models():
    """Ensure models are loaded once for the test session."""
    predictor.load_models()


@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def sample_valid_observations():
    """Generates 3 valid sequential hourly observations ending at recent UTC time."""
    base_time = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    obs_list = [
        HourlyObservation(
            timestamp_utc=base_time - timedelta(hours=2),
            temperature_2m=22.5,
            relative_humidity_2m=55.0,
            dew_point_2m=13.0,
            precipitation=0.0,
            wind_speed_10m=8.5,
            wind_direction_10m=180.0,
            surface_pressure=950.0,
            cloud_cover=20.0
        ),
        HourlyObservation(
            timestamp_utc=base_time - timedelta(hours=1),
            temperature_2m=23.0,
            relative_humidity_2m=53.0,
            dew_point_2m=12.8,
            precipitation=0.0,
            wind_speed_10m=9.0,
            wind_direction_10m=190.0,
            surface_pressure=949.5,
            cloud_cover=25.0
        ),
        HourlyObservation(
            timestamp_utc=base_time,
            temperature_2m=23.8,
            relative_humidity_2m=50.0,
            dew_point_2m=12.5,
            precipitation=0.2,
            wind_speed_10m=10.0,
            wind_direction_10m=195.0,
            surface_pressure=949.0,
            cloud_cover=40.0
        )
    ]
    return obs_list


def test_health_endpoint(client):
    """Test GET /health returns service status, model loading status, and versions."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["temperature_model_loaded"] is True
    assert data["rain_model_loaded"] is True
    assert "temperature_model" in data["model_versions"]
    assert "rain_model" in data["model_versions"]


def test_models_info_endpoint(client):
    """Test GET /models/info returns target horizons, feature count, and selected rain threshold."""
    response = client.get("/models/info")
    assert response.status_code == 200
    data = response.json()
    
    # Temperature model metadata
    temp_info = data["temperature_model"]
    assert temp_info["target_horizon"] == "1h"
    assert temp_info["feature_count"] == 32
    assert len(temp_info["features"]) == 32
    
    # Rain model metadata
    rain_info = data["rain_model"]
    assert rain_info["target_horizon"] == "1h"
    assert rain_info["feature_count"] == 32
    assert rain_info["selected_rain_threshold"] == pytest.approx(0.7425, rel=1e-3)


def test_model_loading_and_unloaded_state():
    """Verify that an unloaded ModelPredictor raises error and reports unready."""
    unloaded_predictor = ModelPredictor()
    assert unloaded_predictor.is_loaded is False
    assert unloaded_predictor.get_info() == {"status": "unloaded"}


def test_valid_prediction(client, sample_valid_observations):
    """Test valid POST /predict payload returns structured prediction response."""
    payload = {
        "observations": [obs.model_dump(mode="json") for obs in sample_valid_observations]
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    # Check fields
    assert "target_lead_time_utc" in data
    assert "temperature_celsius_prediction" in data
    assert "rain_probability" in data
    assert "rain_classification" in data
    assert "selected_rain_threshold" in data
    assert "prediction_timestamp_utc" in data
    assert "model_version" in data
    
    # Verify values and types
    assert isinstance(data["temperature_celsius_prediction"], float)
    assert 0.0 <= data["rain_probability"] <= 1.0
    assert isinstance(data["rain_classification"], bool)
    assert data["selected_rain_threshold"] == pytest.approx(0.7425, rel=1e-3)
    # Check threshold logic
    expected_class = data["rain_probability"] >= data["selected_rain_threshold"]
    assert data["rain_classification"] == expected_class


def test_invalid_payload_count(client, sample_valid_observations):
    """Reject request with fewer or more than 3 observations."""
    # Only 2 observations
    payload_2 = {
        "observations": [obs.model_dump(mode="json") for obs in sample_valid_observations[:2]]
    }
    res_2 = client.post("/predict", json=payload_2)
    assert res_2.status_code == 422
    
    # 4 observations
    extra_obs = sample_valid_observations[0].model_copy()
    payload_4 = {
        "observations": [obs.model_dump(mode="json") for obs in sample_valid_observations] + [extra_obs.model_dump(mode="json")]
    }
    res_4 = client.post("/predict", json=payload_4)
    assert res_4.status_code == 422


def test_missing_required_variables(client, sample_valid_observations):
    """Reject payload when any required meteorological variable is missing."""
    obs_dicts = [obs.model_dump(mode="json") for obs in sample_valid_observations]
    # Delete precipitation from index 1
    del obs_dicts[1]["precipitation"]
    res = client.post("/predict", json={"observations": obs_dicts})
    assert res.status_code == 422
    data = res.json()
    assert data["error"] == "ValidationError"


def test_timestamp_gaps(client, sample_valid_observations):
    """Reject observation sequence with non-1-hour timestamp gaps or wrong order."""
    obs_dicts = [obs.model_dump(mode="json") for obs in sample_valid_observations]
    # Introduce 2-hour gap between obs 1 and 2
    obs_dicts[2]["timestamp_utc"] = (
        datetime.fromisoformat(obs_dicts[2]["timestamp_utc"]) + timedelta(hours=1)
    ).isoformat()
    res = client.post("/predict", json={"observations": obs_dicts})
    assert res.status_code == 422
    assert "Interval between observation" in str(res.json())


def test_future_timestamp_rejected(client, sample_valid_observations):
    """Reject observations from future timestamps."""
    obs_dicts = [obs.model_dump(mode="json") for obs in sample_valid_observations]
    future_time = datetime.now(timezone.utc) + timedelta(days=5)
    obs_dicts[2]["timestamp_utc"] = future_time.isoformat()
    obs_dicts[1]["timestamp_utc"] = (future_time - timedelta(hours=1)).isoformat()
    obs_dicts[0]["timestamp_utc"] = (future_time - timedelta(hours=2)).isoformat()
    res = client.post("/predict", json={"observations": obs_dicts})
    assert res.status_code == 422
    assert "future timestamp" in str(res.json())


def test_non_finite_values_rejected(client, sample_valid_observations):
    """Reject payload containing NaN or infinite values."""
    obs_dicts = [obs.model_dump(mode="json") for obs in sample_valid_observations]
    # Serialize with raw json containing NaN or string NaN or post raw text
    import json
    raw_payload = json.dumps({"observations": obs_dicts}, allow_nan=True)
    # Inject NaN into temperature_2m
    raw_payload_nan = raw_payload.replace(
        f'"temperature_2m": {obs_dicts[0]["temperature_2m"]}',
        '"temperature_2m": NaN'
    )
    res = client.post(
        "/predict",
        content=raw_payload_nan,
        headers={"Content-Type": "application/json"}
    )
    assert res.status_code == 422
    assert "ValidationError" in res.json().get("error", "")


def test_out_of_bounds_physical_limits(client, sample_valid_observations):
    """Reject values outside physical limits."""
    # Temperature > 60 C
    obs_dicts = [obs.model_dump(mode="json") for obs in sample_valid_observations]
    obs_dicts[0]["temperature_2m"] = 85.0
    res = client.post("/predict", json={"observations": obs_dicts})
    assert res.status_code == 422
    assert "physical limits" in str(res.json())

    # Humidity < 0 %
    obs_dicts2 = [obs.model_dump(mode="json") for obs in sample_valid_observations]
    obs_dicts2[1]["relative_humidity_2m"] = -5.0
    res2 = client.post("/predict", json={"observations": obs_dicts2})
    assert res2.status_code == 422
    assert "physical limits" in str(res2.json())


def test_feature_parity_with_training_pipeline():
    """
    Automated Parity Test:
    - Reconstruct features from the first row of processed training_dataset.parquet.
    - Compare generated values against original 32 feature values from training row.
    - Verify identical feature ordering.
    - Verify zero NWP features in generated features.
    """
    train_path = Path("ml-service/data/processed/training_dataset.parquet")
    obs_path = Path("ml-service/data/processed/historical_observations.parquet")
    
    assert train_path.exists(), "training_dataset.parquet not found"
    assert obs_path.exists(), "historical_observations.parquet not found"
    
    train_df = pd.read_parquet(train_path)
    obs_df = pd.read_parquet(obs_path)
    
    # In training_dataset, row 0 corresponds to t0 = obs_df.iloc[2]
    # and lag1h = obs_df.iloc[1], lag2h = obs_df.iloc[0]
    first_3_obs = []
    for i in range(3):
        row = obs_df.iloc[i]
        first_3_obs.append(
            HourlyObservation(
                timestamp_utc=row["timestamp_utc"],
                temperature_2m=float(row["temperature_2m"]),
                relative_humidity_2m=float(row["relative_humidity_2m"]),
                dew_point_2m=float(row["dew_point_2m"]),
                precipitation=float(row["precipitation"]),
                wind_speed_10m=float(row["wind_speed_10m"]),
                wind_direction_10m=float(row["wind_direction_10m"]),
                surface_pressure=float(row["surface_pressure"]),
                cloud_cover=float(row["cloud_cover"])
            )
        )
    
    # Generate features using API feature builder
    generated_features = build_features_from_observations(
        first_3_obs,
        expected_feature_order=EXPECTED_FEATURES
    )
    
    # Original training row
    original_row = train_df.iloc[0]
    
    # 1. Verify exact 32 features and identical order
    assert list(generated_features.columns) == EXPECTED_FEATURES
    assert len(generated_features.columns) == 32
    
    # 2. Verify no NWP feature enters inference
    for col in generated_features.columns:
        assert not col.startswith("feat_nwp_"), f"NWP feature {col} found in generated features!"
    
    # 3. Verify feature parity for all 32 features
    for col in EXPECTED_FEATURES:
        gen_val = generated_features[col].iloc[0]
        orig_val = original_row[col]
        np.testing.assert_allclose(
            gen_val,
            orig_val,
            rtol=1e-5,
            atol=1e-5,
            err_msg=f"Feature disparity on column: {col} (gen: {gen_val}, orig: {orig_val})"
        )


def test_cors_middleware(client):
    """Verify CORS headers are present on OPTIONS preflight."""
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST"
    }
    response = client.options("/predict", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
