# WeatherPulse Phase 5 — ML Prediction Service

Production-structured FastAPI microservice for serving WeatherPulse observation-only ML models for next-hour temperature and rain occurrence predictions.

---

## 1. Architecture & Design Principles

- **Framework**: FastAPI + Pydantic v2 + Joblib + Uvicorn.
- **Model Invariants**:
  - Serves `models/temperature_model_obs_only.joblib` (XGBRegressor).
  - Serves `models/rain_model_obs_only.joblib` (XGBClassifier).
  - Preserves exact 32 features and feature order identical to Phase 4 training.
  - Zero NWP dependency at inference time (observation-only).
  - Rain classification strictly evaluates against the validation-selected threshold (`0.7425`).
- **Data Integrity & Validation**:
  - Requires **exactly 3 sequential hourly observations** ($t-2$, $t-1$, $t_0$).
  - Validates physical meteorological limits (e.g., temperature between -20°C and 60°C, relative humidity 0-100%).
  - Strictly rejects missing variables, future timestamps, timestamp gaps, and non-finite values (NaN/Inf).
  - Never silently imputes missing observations with zeroes.
- **Security & Reliability**:
  - Non-blocking asynchronous lifecycle: models loaded once during application startup.
  - Configurable CORS via environment variables.
  - Payload size limiting middleware (`MAX_REQUEST_BODY_BYTES`).
  - Structured error responses for validation and server errors.
  - Clear degraded health reporting if models fail to load.

---

## 2. Directory Structure

```
ml-service/
├── api/
│   ├── __init__.py
│   ├── config.py           # Pydantic Settings & environment config
│   ├── feature_builder.py  # 32-feature extraction logic matching training pipeline
│   ├── main.py             # FastAPI app, CORS, middleware, endpoints
│   ├── predictor.py        # Model loading, XGBoost inference, threshold evaluation
│   ├── schemas.py          # Pydantic schemas with physical bounds validation
│   └── README.md           # API Documentation & usage instructions
├── models/
│   ├── temperature_model_obs_only.joblib
│   └── rain_model_obs_only.joblib
├── tests/
│   └── test_api.py         # Pytest suite covering endpoints, validation & parity
└── requirements.txt
```

---

## 3. Installation & Setup (Windows PowerShell)

### Prerequisites
- Python 3.10+ (tested with Python 3.14)
- Virtual environment (recommended)

### Commands
```powershell
# 1. Navigate to workspace root
cd c:\Users\anmol\Downloads\weather-major

# 2. Set PYTHONPATH to include ml-service
$env:PYTHONPATH="ml-service"

# 3. Install required dependencies
python -m pip install -r ml-service/requirements.txt

# 4. Start the FastAPI development server
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 4. API Endpoints

### 4.1 Health Check
**`GET /health`**

Returns service health, model load status, and artifact metadata.

**Example Request:**
```powershell
curl.exe -X GET http://127.0.0.1:8000/health
```

**Response (200 OK):**
```json
{
  "status": "healthy",
  "temperature_model_loaded": true,
  "rain_model_loaded": true,
  "model_versions": {
    "temperature_model": {
      "type": "XGBRegressor",
      "versions": {
        "xgboost": "3.4.1",
        "scikit_learn": "1.8.0",
        "joblib": "1.5.3"
      },
      "dataset_version": "ml-service\\data\\processed\\training_dataset.csv"
    },
    "rain_model": {
      "type": "XGBClassifier",
      "versions": {
        "xgboost": "3.4.1",
        "scikit_learn": "1.8.0",
        "joblib": "1.5.3"
      },
      "dataset_version": "ml-service\\data\\processed\\training_dataset.csv"
    }
  }
}
```

---

### 4.2 Model Information
**`GET /models/info`**

Returns target horizons, feature lists, count, and selected rain classification threshold.

**Example Request:**
```powershell
curl.exe -X GET http://127.0.0.1:8000/models/info
```

**Response (200 OK):**
```json
{
  "temperature_model": {
    "model_type": "XGBRegressor",
    "target_horizon": "1h",
    "target_variable": "target_obs_temperature_2m_lead1h",
    "feature_count": 32,
    "features": [
      "feat_hour",
      "feat_day_of_week",
      "..."
    ]
  },
  "rain_model": {
    "model_type": "XGBClassifier",
    "target_horizon": "1h",
    "target_variable": "target_obs_rain_occurrence_lead1h",
    "feature_count": 32,
    "selected_rain_threshold": 0.7425
  }
}
```

---

### 4.3 Predict
**`POST /predict`**

Accepts exactly 3 sequential hourly observations in chronological order and returns next-hour temperature and rain probability/classification.

**Example Request:**
```powershell
curl.exe -X POST http://127.0.0.1:8000/predict `
  -H "Content-Type: application/json" `
  -d '{
    "observations": [
      {
        "timestamp_utc": "2024-01-01T10:00:00Z",
        "temperature_2m": 22.5,
        "relative_humidity_2m": 55.0,
        "dew_point_2m": 13.0,
        "precipitation": 0.0,
        "wind_speed_10m": 8.5,
        "wind_direction_10m": 180.0,
        "surface_pressure": 950.0,
        "cloud_cover": 20.0
      },
      {
        "timestamp_utc": "2024-01-01T11:00:00Z",
        "temperature_2m": 23.0,
        "relative_humidity_2m": 53.0,
        "dew_point_2m": 12.8,
        "precipitation": 0.0,
        "wind_speed_10m": 9.0,
        "wind_direction_10m": 190.0,
        "surface_pressure": 949.5,
        "cloud_cover": 25.0
      },
      {
        "timestamp_utc": "2024-01-01T12:00:00Z",
        "temperature_2m": 23.8,
        "relative_humidity_2m": 50.0,
        "dew_point_2m": 12.5,
        "precipitation": 0.2,
        "wind_speed_10m": 10.0,
        "wind_direction_10m": 195.0,
        "surface_pressure": 949.0,
        "cloud_cover": 40.0
      }
    ]
  }'
```

**Response (200 OK):**
```json
{
  "target_lead_time_utc": "2024-01-01T13:00:00Z",
  "temperature_celsius_prediction": 23.23,
  "rain_probability": 0.0039,
  "rain_classification": false,
  "selected_rain_threshold": 0.7425,
  "prediction_timestamp_utc": "2026-11-09T16:05:00.123456Z",
  "model_version": {
    "temperature_model_type": "XGBRegressor",
    "rain_model_type": "XGBClassifier",
    "dataset_version": "ml-service\\data\\processed\\training_dataset.csv",
    "system_versions": { ... }
  }
}
```

---

## 5. Automated Testing

Run the test suite via PowerShell:
```powershell
$env:PYTHONPATH="ml-service"
python -m pytest ml-service/tests/test_api.py -v
```

The test suite validates:
1. `test_health_endpoint`: Service status, model loaded booleans, version mapping.
2. `test_models_info_endpoint`: 32 feature count, horizon, rain threshold.
3. `test_model_loading_and_unloaded_state`: Graceful handling of uninitialized predictor.
4. `test_valid_prediction`: Inference pipeline execution, output schema, and threshold logic.
5. `test_invalid_payload_count`: Strict rejection of `< 3` or `> 3` observations.
6. `test_missing_required_variables`: Rejection when any of the 8 variables are missing.
7. `test_timestamp_gaps`: Rejection of non-1-hour spacing or out-of-order records.
8. `test_future_timestamp_rejected`: Rejection of future timestamps.
9. `test_non_finite_values_rejected`: Rejection of NaN or Inf numerical values.
10. `test_out_of_bounds_physical_limits`: Rejection of values outside meteorological physical limits.
11. `test_feature_parity_with_training_pipeline`: Exact parity verification against original training rows and feature order.
12. `test_cors_middleware`: CORS headers configuration.

