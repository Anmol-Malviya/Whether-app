# WeatherPulse — Phase 6.1.2 Production System Documentation

WeatherPulse is a resilient hyperlocal weather intelligence and multi-provider consensus platform with Shadow-Mode ML nowcasting, citizen weather moment reporting, and automated spatial-temporal disaster incident triage.

---

## 1. Project Architecture

The application comprises two decoupled, production-hardened services:

1. **Next.js Full-Stack Application (`src/`)**:
   - **Framework**: Next.js 16 (App Router, Turbopack, React 19).
   - **Weather Aggregator (`src/lib/aggregator.ts`)**: Queries Open-Meteo, WeatherAPI, and OpenWeatherMap in parallel. Computes multi-provider consensus (40% agreement, 30% freshness, 30% availability).
   - **ML Shadow Integration (`src/lib/mlPrediction.ts`)**: Fetches 3 consecutive hourly observations from Open-Meteo, checks physical meteorological bounds and staleness, calls the Python FastAPI service, and durably persists predictions with bounded timeouts (2500ms) and idempotency keys to MongoDB.
   - **Shadow Evaluation Pipeline (`src/lib/shadowEvaluator.ts`)**: Idempotent worker with atomic conditional claims, 60s leases, bounded retries (max 5), trapezoidal PR-AUC scoring, and verification against model-derived Open-Meteo operational feeds.
   - **Database Layer (`src/lib/db.ts`, `src/lib/models/MlEvaluation.ts`)**: MongoDB Atlas via Mongoose with auto-recovering DNS, single-flight index initialization, and compound query & lease-recovery indexes.

2. **Python ML Inference Microservice (`ml-service/`)**:
   - **Framework**: FastAPI + Uvicorn + Pydantic v2.
   - **Models**: Scikit-Learn / XGBoost models trained on 10+ years of hourly meteorological data (Indore station coordinates: 22.7196° N, 75.8577° E).
   - **Temperature Model**: `XGBRegressor` predicting next-hour ambient temperature (°C) using 32 lag/delta features.
   - **Rain Classifier**: `XGBClassifier` generating uncalibrated occurrence probability and thresholded binary prediction at validation-calibrated threshold **0.7425**.

---

## 2. Environment Variables

Create `.env.local` in the project root:

```env
# MongoDB Connection
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/weatherpulse?retryWrites=true&w=majority

# Administrative Cron Authentication (Required for evaluation trigger)
CRON_SECRET=your-secure-cron-secret-here

# Weather Providers
ENABLE_PROVIDER_OPEN_METEO=true
WEATHERAPI_KEY=your_weatherapi_key_here
ENABLE_PROVIDER_WEATHERAPI=true
OPENWEATHER_KEY=your_openweather_key_here
ENABLE_PROVIDER_OPENWEATHER=true

# Python ML Microservice URL
ML_SERVICE_URL=http://127.0.0.1:8000

# Location Defaults
DEFAULT_LOCATION_NAME=Indore, Madhya Pradesh
DEFAULT_LOCATION_LAT=22.7196
DEFAULT_LOCATION_LON=75.8577

# Moments & Expiry
MOMENT_EXPIRY_MINUTES=60
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
GROQ_api=your_groq_api_key
```

In `ml-service/.env` (optional, defaults apply):
```env
HOST=127.0.0.1
PORT=8000
RAIN_THRESHOLD=0.7425
```

---

## 3. Startup Instructions (Windows PowerShell)

### Step 1: Start Python FastAPI ML Service

In a dedicated terminal:
```powershell
# Navigate to ml-service directory
cd C:\Users\anmol\Downloads\weather-major\ml-service

# Install dependencies (if not already installed)
python -m pip install -r requirements.txt

# Start FastAPI server via Uvicorn
$env:PYTHONPATH="C:\Users\anmol\Downloads\weather-major\ml-service"
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```
Health check: Navigate to `http://127.0.0.1:8000/health` or `http://127.0.0.1:8000/models/info`.

### Step 2: Start Next.js Application

In a second terminal:
```powershell
cd C:\Users\anmol\Downloads\weather-major

# Install dependencies (if not already installed)
npm install

# Start development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 4. MongoDB Configuration & Index Reliability

Collection `ml_evaluations` contains deterministic records with the following production indexes:

| Index Name | Specification | Purpose |
| :--- | :--- | :--- |
| `_id_` | `{ _id: 1 }` | Default primary key |
| `evaluationKey_1` | `{ evaluationKey: 1 }` (unique) | Enforces deterministic idempotency: `${locationId}_obs_only_v1_${targetLeadTimeUtc.toISOString()}` |
| `locationId_1` | `{ locationId: 1 }` | Fast location-specific lookups |
| `targetLeadTimeUtc_1` | `{ targetLeadTimeUtc: 1 }` | Time-range sorting and bounds |
| `evaluationStatus_1` | `{ evaluationStatus: 1 }` | Filtering by pending/evaluated states |
| `evaluationLeaseUntil_1` | `{ evaluationLeaseUntil: 1 }` | Lease recovery scanning |
| `targetLeadTimeUtc_-1_evaluationStatus_1` | Compound `{ targetLeadTimeUtc: -1, evaluationStatus: 1 }` | Fast metric aggregation over time ranges |
| `locationId_1_targetLeadTimeUtc_-1` | Compound `{ locationId: 1, targetLeadTimeUtc: -1 }` | Historical lookups per location |
| `evaluationStatus_1_evaluationLeaseUntil_1_targetLeadTimeUtc_1` | Compound | Fast atomic worker queue claims and expired lease reclamation |

Indexes are managed safely through `ensureMlEvaluationIndexes()` with single-flight checking, avoiding destructive index rebuilds or unhandled race conditions.

---

## 5. Cron Configuration & Verification

To evaluate past shadow predictions once the target lead time has elapsed + 15 minutes, configure a cron job or scheduled worker:

```bash
# Periodic trigger (e.g. every 15-30 minutes):
curl -X POST http://localhost:3000/api/weather/ml-shadow \
  -H "Authorization: Bearer <CRON_SECRET>"
```

### Authentication Invariants:
- If `CRON_SECRET` is unset on server: returns **HTTP 503 Service Unavailable**.
- If `Authorization: Bearer <token>` is missing or invalid: returns **HTTP 401 Unauthorized**.
- Query-string authentication (`?secret=...`, `?token=...`) is **strictly rejected with HTTP 401**.
- Internal stack traces are never exposed in JSON responses.

---

## 6. Key API Endpoints

- `GET /api/weather/current?location=indore`: Returns multi-provider aggregated weather consensus and shadow ML nowcast payload.
- `GET /api/weather/ml-shadow?range=24h&page=1&limit=20`: Returns shadow evaluation metrics (MAE, RMSE, Mean Bias, Brier Score, PR-AUC, Confusion Matrix) and paginated prediction history.
- `POST /api/weather/ml-shadow`: Executes atomic evaluation of matured shadow predictions (requires Bearer authentication).
- `GET /health` (FastAPI): Reports Python ML service health and model loading status.
- `POST /predict` (FastAPI): Ingests 3 consecutive hourly observations and returns 1-hour ahead nowcast.

---

## 7. Shadow Mode Invariants & Ground Truth Clarification

- **Pure Shadow Mode**: ML predictions run strictly for evaluation. They do **not** replace the multi-provider consensus in user forecasts.
- **Uncalibrated Probabilities**: The rain prediction probability is a raw continuous model occurrence score output by XGBoost, **not** a Bayesian calibrated probability.
- **Threshold**: The operational rain decision threshold is strictly fixed at **0.7425**, calibrated on historical validation folds.
- **Model-Derived Evaluation**: Post-hoc verification is computed against Open-Meteo operational feeds (which assimilate NWP model outputs and observational data). These are **model-derived reference outcomes**, not direct in-situ physical weather station sensors.
- **No Synthetic Weather Data**: If Open-Meteo observations have missing parameters, non-finite values, or gaps, the prediction is marked unavailable/stale. Imputing zero or synthetic meteorological values is strictly forbidden.

---

## 8. Automated Testing Commands

Execute tests across both the Node.js and Python test suites:

### Node.js Integration & Reliability Tests:
```powershell
# Run all Node.js shadow evaluation, persistence, metric, and security tests:
node --test scripts/test_final_reliability.mjs scripts/test_shadow_fixes.mjs scripts/test_shadow_integration.mjs scripts/test_shadow_metrics.mjs
```

### Python ML Service & Regression Tests:
```powershell
$env:PYTHONPATH="C:\Users\anmol\Downloads\weather-major\ml-service"
python -m pytest ml-service/tests ml-service/training/test_phase4_1_pipeline.py ml-service/training/test_baseline_pipeline.py ml-service/training/test_dataset_integrity.py
```

### Production Build & Lint:
```powershell
npm run build
npx eslint src/lib src/app/api
```

---

## 9. Known Limitations

1. **Serverless Lifecycle**: On Vercel or ephemeral serverless deployments, background tasks without timeouts can be cancelled upon response termination. WeatherPulse addresses this by explicitly awaiting database writes with a bounded 2500ms timeout during the request lifecycle.
2. **Single Primary Coordinates**: ML models are specifically trained for Central India / Indore coordinates (22.7196, 75.8577). For distant custom coordinates, the shadow evaluator flags model geographic limits.
3. **Reference Feed Dependency**: Outcome evaluations depend on Open-Meteo archive availability for the target timestamp. If Open-Meteo experiences upstream delays, evaluations remain gracefully in `pending` status until the lease expires and the record is re-evaluated.
