"""
Tests for /health, /health/ready, /inference/metrics, and /predict metric recording.

Uses FastAPI's TestClient (httpx-backed) with unittest.mock.patch so that no real
ML model files are required.
"""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Shared helper: build a mock predictor with configurable state
# ---------------------------------------------------------------------------

def _make_mock_predictor(
    is_loaded: bool = True,
    temp_model: object = object(),
    rain_model: object = object(),
    features: list | None = None,
    temp_artifact: dict | None = None,
    rain_artifact: dict | None = None,
) -> MagicMock:
    mock = MagicMock()
    mock.is_loaded = is_loaded
    mock.temp_model = temp_model
    mock.rain_model = rain_model
    mock.features = features if features is not None else ["f1", "f2", "f3"]
    mock.temp_artifact = temp_artifact or {}
    mock.rain_artifact = rain_artifact or {}
    return mock


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def client_loaded():
    """TestClient with both models loaded."""
    mock_predictor = _make_mock_predictor()
    with patch("api.main.predictor", mock_predictor):
        from api.main import app
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c, mock_predictor


@pytest.fixture()
def client_degraded():
    """TestClient with rain_model deliberately unloaded (None)."""
    mock_predictor = _make_mock_predictor(rain_model=None)
    with patch("api.main.predictor", mock_predictor):
        from api.main import app
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c, mock_predictor


@pytest.fixture()
def client_not_loaded():
    """TestClient with predictor entirely not loaded."""
    mock_predictor = _make_mock_predictor(
        is_loaded=False,
        temp_model=None,
        rain_model=None,
        features=[],
    )
    with patch("api.main.predictor", mock_predictor):
        from api.main import app
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c, mock_predictor


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------

class TestHealthEndpoint:
    def test_health_returns_healthy_when_models_loaded(self, client_loaded):
        client, _ = client_loaded
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "healthy"
        assert body["temperature_model_loaded"] is True
        assert body["rain_model_loaded"] is True
        # New optional fields must be present
        assert "inference_metrics" in body
        assert "service_uptime_s" in body

    def test_health_returns_degraded_when_model_missing(self, client_degraded):
        client, _ = client_degraded
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "degraded"
        assert body["temperature_model_loaded"] is True
        assert body["rain_model_loaded"] is False


# ---------------------------------------------------------------------------
# /health/ready
# ---------------------------------------------------------------------------

class TestHealthReadyEndpoint:
    def test_health_ready_returns_true_when_loaded(self, client_loaded):
        client, _ = client_loaded
        resp = client.get("/health/ready")
        assert resp.status_code == 200
        body = resp.json()
        assert body["ready"] is True
        assert body["message"] == "All models loaded and ready"
        assert isinstance(body["feature_count"], int)

    def test_health_ready_returns_false_when_not_loaded(self, client_not_loaded):
        client, _ = client_not_loaded
        resp = client.get("/health/ready")
        assert resp.status_code == 200
        body = resp.json()
        assert body["ready"] is False
        assert "not ready" in body["message"].lower()


# ---------------------------------------------------------------------------
# /inference/metrics — authentication
# ---------------------------------------------------------------------------

class TestInferenceMetricsAuth:
    def test_inference_metrics_forbidden_without_key(self, client_loaded):
        client, _ = client_loaded
        # No X-Admin-Key header
        resp = client.get("/inference/metrics")
        assert resp.status_code == 403
        assert resp.json() == {"error": "Forbidden"}

    def test_inference_metrics_forbidden_with_wrong_key(self, client_loaded):
        client, _ = client_loaded
        resp = client.get(
            "/inference/metrics",
            headers={"X-Admin-Key": "definitely-wrong-key"},
        )
        assert resp.status_code == 403
        assert resp.json() == {"error": "Forbidden"}

    def test_inference_metrics_accessible_with_correct_key(self, client_loaded):
        client, _ = client_loaded
        secret = "test-admin-secret"
        with patch("api.main.settings") as mock_settings:
            mock_settings.ADMIN_API_KEY = secret
            # Re-import to pick up the patched settings inside the endpoint
            resp = client.get(
                "/inference/metrics",
                headers={"X-Admin-Key": secret},
            )
        assert resp.status_code == 200
        body = resp.json()
        assert "total_requests" in body
        assert "uptime_seconds" in body


# ---------------------------------------------------------------------------
# /predict — metric recording
# ---------------------------------------------------------------------------

class TestPredictMetricsRecording:
    def test_predict_records_success_metric(self, client_loaded):
        """A successful prediction must increment successful_requests."""
        client, mock_predictor = client_loaded

        # Build a minimal valid PredictionResponse-like return value
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        # Timestamps must be in the past and 1-hour apart
        t0 = now - timedelta(hours=3)
        t1 = t0 + timedelta(hours=1)
        t2 = t1 + timedelta(hours=1)

        fake_response = MagicMock()
        # Make the mock response serialisable by model_validate / JSON
        from api.schemas import PredictionResponse
        fake_response.__class__ = PredictionResponse
        fake_pred = PredictionResponse(
            target_lead_time_utc=t2 + timedelta(hours=1),
            temperature_celsius_prediction=28.5,
            rain_probability=0.12,
            rain_classification=False,
            selected_rain_threshold=0.4,
            prediction_timestamp_utc=datetime.now(timezone.utc),
            model_version={"temperature_model_type": "RF", "rain_model_type": "LR"},
        )
        mock_predictor.predict.return_value = fake_pred

        from api.inference_metrics import metrics_store
        before = metrics_store.successful_requests

        payload = {
            "observations": [
                {
                    "timestamp_utc": t0.isoformat(),
                    "temperature_2m": 25.0,
                    "relative_humidity_2m": 60.0,
                    "dew_point_2m": 17.0,
                    "precipitation": 0.0,
                    "wind_speed_10m": 10.0,
                    "wind_direction_10m": 180.0,
                    "surface_pressure": 1010.0,
                    "cloud_cover": 20.0,
                },
                {
                    "timestamp_utc": t1.isoformat(),
                    "temperature_2m": 25.5,
                    "relative_humidity_2m": 59.0,
                    "dew_point_2m": 17.0,
                    "precipitation": 0.0,
                    "wind_speed_10m": 11.0,
                    "wind_direction_10m": 185.0,
                    "surface_pressure": 1009.0,
                    "cloud_cover": 25.0,
                },
                {
                    "timestamp_utc": t2.isoformat(),
                    "temperature_2m": 26.0,
                    "relative_humidity_2m": 58.0,
                    "dew_point_2m": 17.0,
                    "precipitation": 0.0,
                    "wind_speed_10m": 12.0,
                    "wind_direction_10m": 190.0,
                    "surface_pressure": 1008.0,
                    "cloud_cover": 30.0,
                },
            ]
        }

        resp = client.post("/predict", json=payload)
        assert resp.status_code == 200
        assert metrics_store.successful_requests == before + 1

    def test_predict_records_failure_metric(self, client_loaded):
        """When predictor.predict raises, failed_requests must be incremented."""
        client, mock_predictor = client_loaded
        mock_predictor.predict.side_effect = RuntimeError("boom")

        from api.inference_metrics import metrics_store
        before_failed = metrics_store.failed_requests

        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        t0 = now - timedelta(hours=3)
        t1 = t0 + timedelta(hours=1)
        t2 = t1 + timedelta(hours=1)

        payload = {
            "observations": [
                {
                    "timestamp_utc": t0.isoformat(),
                    "temperature_2m": 25.0,
                    "relative_humidity_2m": 60.0,
                    "dew_point_2m": 17.0,
                    "precipitation": 0.0,
                    "wind_speed_10m": 10.0,
                    "wind_direction_10m": 180.0,
                    "surface_pressure": 1010.0,
                    "cloud_cover": 20.0,
                },
                {
                    "timestamp_utc": t1.isoformat(),
                    "temperature_2m": 25.5,
                    "relative_humidity_2m": 59.0,
                    "dew_point_2m": 17.0,
                    "precipitation": 0.0,
                    "wind_speed_10m": 11.0,
                    "wind_direction_10m": 185.0,
                    "surface_pressure": 1009.0,
                    "cloud_cover": 25.0,
                },
                {
                    "timestamp_utc": t2.isoformat(),
                    "temperature_2m": 26.0,
                    "relative_humidity_2m": 58.0,
                    "dew_point_2m": 17.0,
                    "precipitation": 0.0,
                    "wind_speed_10m": 12.0,
                    "wind_direction_10m": 190.0,
                    "surface_pressure": 1008.0,
                    "cloud_cover": 30.0,
                },
            ]
        }

        resp = client.post("/predict", json=payload)
        # Expect 500 from the generic exception handler
        assert resp.status_code == 500
        assert metrics_store.failed_requests == before_failed + 1
