# Phase 3.1: Independent Historical Dataset Integrity Audit Report
**Project:** WeatherPulse ML Service  
**Target Location:** Indore, Madhya Pradesh ($22.7196^\circ\text{N}, 75.8577^\circ\text{E}$)  
**Audit Scope:** Pilot Historical Observations, Forecast Archives, and Training Dataset (Jan 1, 2024 – Jan 31, 2024)  
**Audit Date:** November 9, 2026  
**Audit Verdict:** **CONDITIONAL APPROVAL WITH REQUIRED CORRECTIONS**

---

## 1. Verified Data Findings (Task 1)

### 1.1 File Inventory and Agreement
All raw API payloads, normalized processed tables, and metadata schemas were independently inspected:

| Dataset | Format | Row Count | Columns | File Size | Timestamp Range (UTC) |
|---|---|---|---|---|---|
| **Raw Observations** | CSV | 744 | 12 | 62.5 KB | 2024-01-01 00:00 to 2024-01-31 23:00 |
| **Raw Forecast Runs** | CSV | 2,232 | 15 | 284.2 KB | 2024-01-01 00:00 to 2024-01-31 23:00 |
| **Processed Observations** | Parquet | 744 | 14 | 28.3 KB | 2024-01-01 00:00 to 2024-01-31 23:00 |
| **Processed Observations** | CSV | 744 | 14 | 88.6 KB | 2024-01-01 00:00 to 2024-01-31 23:00 |
| **Processed Forecasts** | Parquet | 2,232 | 17 | 37.2 KB | 2024-01-01 00:00 to 2024-01-31 23:00 |
| **Processed Forecasts** | CSV | 2,232 | 17 | 362.4 KB | 2024-01-01 00:00 to 2024-01-31 23:00 |
| **Training Dataset** | Parquet | 741 | 58 | 114.8 KB | 2024-01-01 02:00 to 2024-01-31 22:00 |
| **Training Dataset** | CSV | 741 | 58 | 269.5 KB | 2024-01-01 02:00 to 2024-01-31 22:00 |

- **Agreement**: 100% agreement between raw CSVs and processed Parquet files on overlapping variables. Processed datasets enriched raw data with UTC timestamps, timezone-aware strings (`Asia/Kolkata`), duplicate filtering, and standardized types.
- **Duplicates**: **0 duplicate rows** across observations, forecasts, and training datasets.
- **Missing Data**: **0 null values** across all numerical fields (100% complete hourly series).

### 1.2 Physical Unit & Range Verification
All numerical metrics conform strictly to Central Indian winter climatology:
- **Temperature ($2\text{m}$)**: $9.0^\circ\text{C}$ to $27.9^\circ\text{C}$ (Normal winter range for Indore, no anomalous values).
- **Relative Humidity ($2\text{m}$)**: $25.0\%$ to $100.0\%$.
- **Dew Point ($2\text{m}$)**: $1.0^\circ\text{C}$ to $18.2^\circ\text{C}$.
- **Precipitation**: $0.0\text{ mm}$ to $17.9\text{ mm}$ (Observed winter shower on Jan 7–8, 2024).
- **Surface Pressure**: $946.0\text{ hPa}$ to $957.5\text{ hPa}$ (Consistent with Indore's $553\text{ m}$ elevation above sea level).
- **Wind Speed ($10\text{m}$)**: $0.4\text{ km/h}$ to $16.6\text{ km/h}$.
- **Cloud Cover**: $0.0\%$ to $100.0\%$.

---

## 2. Forecast Provenance Audit (Task 2)

An inspection of `collect_forecast_archive.py` and the raw Open-Meteo responses revealed key architectural characteristics and limitations:

1. **Model Identifiers**: Preserved correctly across all 2,232 rows (`best_match`, `ecmwf_ifs`, and `gfs_seamless`).
2. **Forecast Valid Timestamp**: Preserved accurately in UTC and converted to local time (`Asia/Kolkata`).
3. **Forecast Initialization Timestamp**: **NOT AVAILABLE FROM API.**
   - *Finding*: Open-Meteo's Historical Forecast API reconstructs previous forecasts mapped directly to valid timestamps. It does not provide the specific model run cycle initialization time (e.g., whether the prediction for `2024-01-01 03:00` originated from the `00Z` run or a previous `12Z` cycle).
   - *Limitation*: In `collect_forecast_archive.py`, `lead_time_hours_nominal` was set to `0` as an operational placeholder.
   - *Impact*: We cannot mathematically prove the exact dissemination latency of each historical forecast cycle without explicit run-cycle metadata.

---

## 3. ML Training Dataset Leakage Audit (Task 3)

Inspection of `preprocess.py` and `training_dataset.parquet` against leakage prevention rules:

1. **Observation Lag Invariant**: **PASSED.**
   - Features at decision time $t$ include:
     - $t_0$: Current observation at $t$.
     - $\text{lag}_{1\text{h}}$: Observation at $t - 1\text{h}$.
     - $\text{lag}_{2\text{h}}$: Observation at $t - 2\text{h}$.
   - Edge rows (the first 2 hours of the month) were cleanly dropped to avoid null imputation.
2. **Target Label Invariant**: **PASSED.**
   - `target_obs_temperature_2m_lead1h` strictly corresponds to the observation at $t + 1\text{h}$.
   - Formula check: $\Delta t = \text{target\_valid\_time\_utc} - \text{timestamp\_utc} = 1.0\text{ hour}$ for all 741 rows.
   - Zero overlap between feature column names (`feat_*`) and target column names (`target_*`).
3. **NWP Forecast Join Alignment**: **CAUTION / CLARIFICATION.**
   - Forecast columns (`feat_nwp_*`) are joined on `target_valid_time_utc` ($t + 1\text{h}$).
   - Because NWP operational runs (ECMWF IFS, GFS) are global models generated hours in advance, joining on $t+1\text{h}$ assumes that the NWP forecast for $t+1\text{h}$ was already published and ingested by decision time $t$.
   - In production real-time pipelines, NWP runs have an ingestion delay of 2–4 hours. While valid for post-hoc NWP blending, this latency must be accounted for during online inference.

---

## 4. Rainfall Dataset Validation (Task 4)

A statistical audit of the precipitation distribution in the January 2024 pilot data:

- **Total Recorded Hours**: 744 hours
- **Zero-Rain Hours ($p = 0\text{ mm}$)**: 707 hours (**95.03%**)
- **Non-Zero Rain Hours ($p > 0\text{ mm}$)**: 37 hours (**4.97%**)
- **Measurable Rain Hours ($p \ge 0.1\text{ mm}$)**: 37 hours (4.97%)
- **Significant Rain Hours ($p \ge 1.0\text{ mm}$)**: 6 hours (0.81%)
- **Heavy Rain Hours ($p \ge 5.0\text{ mm}$)**: 1 hour (0.13%, max $17.9\text{ mm/h}$ on Jan 8, 2024)
- **Total Month Rainfall**: $35.7\text{ mm}$

### Critical Finding:
`training_dataset.parquet` currently only includes `target_obs_temperature_2m_lead1h`.  
It lacks dedicated target columns for:
1. `target_obs_rain_occurrence_lead1h` (Binary classification target: 0 = No Rain, 1 = Rain)
2. `target_obs_precipitation_lead1h` (Continuous regression target: rainfall volume in mm)

---

## 5. Training Readiness Evaluation (Task 5)

The pilot dataset (January 2024, 741 training samples) is **INSUFFICIENT FOR PRODUCTION ML MODEL TRAINING**:

| Task | Readiness Status | Reason |
|---|---|---|
| **Temperature Forecasting** | Feasible for prototype / code verification only | Range is restricted to 9°C–28°C (winter only). A model trained on this will fail catastrophically during summer heatwaves (40°C–45°C) and monsoon months. |
| **Rain Occurrence Classification** | Unsuitable (Severe Class Imbalance) | 95.03% zero-rain class. A baseline model predicting "no rain" constant achieves 95% accuracy without learning meteorological triggers. |
| **Rainfall Amount Prediction** | Unsuitable (Extreme Sparsity) | Only 6 hours in the entire month had rainfall $\ge 1.0\text{ mm}$. Statistically insufficient for regression convergence. |

---

## 6. Required Corrections & Action Plan

Before initiating full-scale model training:

1. **Update `preprocess.py` to add Rainfall Targets**:
   - Add `target_obs_rain_occurrence_lead1h = (obs[precipitation].shift(-1) >= 0.1).astype(int)`
   - Add `target_obs_precipitation_lead1h = obs[precipitation].shift(-1)`
2. **Explicit NWP Latency Parameter**:
   - In live deployment or training documentation, define a 2-hour latency buffer to account for operational NWP dissemination delays.
3. **Pilot Approval for Multi-Year Data Collection**:
   - **Verdict**: **APPROVED TO SCALE COLLECTION TO MULTI-YEAR RANGE (2021–2024)**.
   - The pilot collection and file generation pipelines are robust, stable, schema-consistent, and error-free.
   - Scaling to 2021–2024 (~35,000 hourly observations) is mandatory to capture the Southwest Monsoon seasons (June–September) and complete annual weather cycles for Indore.

