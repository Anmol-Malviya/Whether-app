# WeatherPulse ML Service - Historical Data Pipeline

Reproducible multi-year historical weather data collection and preprocessing pipeline for Indore, Madhya Pradesh ($22.7196^\circ\text{N}, 75.8577^\circ\text{E}$), built for WeatherPulse.

---

## 1. Directory Structure

```
ml-service/
├── config/
│   └── locations.yaml                   # Coordinates, NWP model definitions, and date configurations
├── data/
│   ├── raw/                             # Yearly raw API responses (JSON, CSV) and metadata
│   │   ├── indore_historical_obs_2021.csv / .json / _meta.json
│   │   ├── indore_historical_obs_2022.csv / .json / _meta.json
│   │   ├── indore_historical_obs_2023.csv / .json / _meta.json
│   │   ├── indore_historical_obs_2024.csv / .json / _meta.json
│   │   ├── indore_historical_forecast_2021.csv / .json / _meta.json
│   │   ├── indore_historical_forecast_2022.csv / .json / _meta.json
│   │   ├── indore_historical_forecast_2023.csv / .json / _meta.json
│   │   └── indore_historical_forecast_2024.csv / .json / _meta.json
│   ├── processed/                       # Merged, normalized, validated Parquet & CSV datasets
│   │   ├── historical_observations.parquet & .csv  (35,064 rows)
│   │   ├── historical_forecasts.parquet & .csv     (103,248 rows)
│   │   └── training_dataset.parquet & .csv         (35,061 rows)
│   └── reports/                         # Audit and coverage validation reports
│       ├── indore_data_completeness_report.json
│       ├── phase3_integrity_audit.json & .md
│       └── dataset_coverage_report.json & .md
├── training/
│   ├── collect_historical.py            # Task 3: Multi-year historical observations collector
│   ├── collect_forecast_archive.py      # Task 4: Multi-year NWP forecast archive collector
│   ├── preprocess.py                    # Task 1 & 5: Feature engineering, multi-target generation & Parquet builder
│   └── validate_dataset.py              # Task 7: Automated data integrity & leakage validation suite
├── requirements.txt                     # Python dependencies
└── README.md
```

---

## 2. Dataset Schemas

### 1. `historical_observations.parquet` (35,064 rows)
Continuous hourly observed and reanalysis meteorological conditions (ECMWF ERA5 / ERA5-Land via Open-Meteo) for Indore from 2021-01-01 to 2024-12-31.

| Column | Type | Unit | Description |
|---|---|---|---|
| `location_id` | `string` | - | Location slug (`indore`) |
| `latitude`, `longitude`, `elevation` | `float64` | `°N`, `°E`, `m` | Geographic coordinates ($22.7196^\circ\text{N}, 75.8577^\circ\text{E}, 553\text{ m}$) |
| `timestamp_utc` | `timestamp[ns, UTC]` | ISO8601 | Primary timeline index in UTC |
| `timestamp_local_str` | `string` | Local | Preserved local timestamp in `Asia/Kolkata` (UTC+5:30) |
| `temperature_2m` | `float64` | `°C` | Air temperature at 2 meters ($6.5^\circ\text{C}$ to $45.0^\circ\text{C}$) |
| `relative_humidity_2m` | `float64` | `%` | Relative humidity at 2 meters |
| `dew_point_2m` | `float64` | `°C` | Dew point temperature at 2 meters |
| `precipitation` | `float64` | `mm` | Total hourly precipitation ($0.0$ to $27.6\text{ mm}$) |
| `wind_speed_10m` | `float64` | `km/h` | Wind speed at 10 meters |
| `wind_direction_10m` | `float64` | `°` | Wind direction (0–360°) |
| `surface_pressure` | `float64` | `hPa` | Atmospheric surface pressure ($940.2$ to $966.8\text{ hPa}$) |
| `cloud_cover` | `float64` | `%` | Total cloud cover percentage |

---

### 2. `historical_forecasts.parquet` (103,248 rows)
Archived operational NWP forecasts (`best_match`, `ecmwf_ifs`, `gfs_seamless`).

| Column | Type | Description |
|---|---|---|
| `location_id`, `latitude`, `longitude`, `elevation` | `string` / `float64` | Location coordinates |
| `model_id` | `string` | Forecast model (`best_match`, `ecmwf_ifs`, `gfs_seamless`) |
| `timestamp_utc`, `timestamp_local_str` | `timestamp[ns, UTC]` / `string` | Forecast valid time in UTC and IST |
| `initialization_time_utc` | `string` | Documented limitation: `UNKNOWN_FROM_OPEN_METEO_API` |
| `lead_time_hours` | `float64` | Recorded as `NaN` (exact run cycle lead time unknown) |
| `lead_time_status` | `string` | `NOMINAL_UNKNOWN_CYCLE` |
| `forecast_source_type` | `string` | `archived_nwp_operational_seamless` |
| `retrieval_timestamp_utc` | `string` | ISO8601 UTC timestamp of retrieval |
| Meteorological variables | `float64` | Forecasted values for temperature, humidity, rain, etc. |

---

### 3. `training_dataset.parquet` (35,061 rows)
Supervised ML-ready dataset enforcing strict chronological causality and zero data leakage.

- **Prediction Reference Time ($t$):** `timestamp_utc`
- **Target Valid Time ($t + 1\text{h}$):** `target_valid_time_utc`
- **Target Variables ($t + 1\text{h}$):**
  1. `target_obs_temperature_2m_lead1h` (`float64`): Next-hour temperature in $^\circ\text{C}$
  2. `target_obs_rain_occurrence_lead1h` (`int64`): Binary classification ($1$ if next-hour precip $\ge 0.1\text{ mm}$, else $0$)
  3. `target_obs_precipitation_lead1h` (`float64`): Next-hour precipitation in $\text{mm}$
- **Feature Vector ($X$):**
  - **Diurnal / Seasonal:** `feat_hour`, `feat_day_of_week`, `feat_month`, `feat_day_of_year`, cyclic sine/cosine encodings
  - **Observation Lags:** `feat_obs_*_t0`, `feat_obs_*_lag1h`, `feat_obs_*_lag2h` (historical measurements at $t, t-1\text{h}, t-2\text{h}$)
  - **NWP Model Predictions:** `feat_nwp_*_best_match`, `feat_nwp_*_ecmwf_ifs`, `feat_nwp_*_gfs_seamless` valid for $t + 1\text{h}$

---

## 3. Data Provenance & Operational Latency Rules

1. **Reanalysis vs. Physical Station Ground Truth**: Open-Meteo Archive data originates from ECMWF ERA5 / ERA5-Land reanalysis ($0.1^\circ$ resolution). It provides high continuous consistency across Central India, but does not represent raw local weather station sensor hardware.
2. **NWP Initialization Latency**: Open-Meteo Historical Forecast returns outputs by valid timestamp without model run-cycle headers (00Z vs 12Z). In online operational inference, an ingestion latency buffer of $\ge 2\text{ hours}$ must be maintained before relying on NWP predictions.
3. **No Synthetic Imputation**: Edge boundary rows without full lag histories or next-hour targets are dropped directly rather than filled with synthetic or interpolated values.

---

## 4. Reproduction Commands

```bash
# 1. Collect multi-year historical observations (2021 - 2024)
python ml-service/training/collect_historical.py --location indore --start-date 2021-01-01 --end-date 2024-12-31

# 2. Collect multi-year historical forecast archives (2021 - 2024)
python ml-service/training/collect_forecast_archive.py --location indore --start-date 2021-01-01 --end-date 2024-12-31

# 3. Preprocess and generate Parquet datasets with corrected targets
python ml-service/training/preprocess.py --location indore

# 4. Run automated validation suite
python ml-service/training/validate_dataset.py
```
