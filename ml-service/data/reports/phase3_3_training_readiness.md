# WeatherPulse Phase 3.3: Forecast Data Integrity & Training Readiness Audit Report

**Location:** Indore, Madhya Pradesh ($22.7196^\circ\text{N}, 75.8577^\circ\text{E}$, elevation $553\text{ m}$)  
**Period Covered:** January 1, 2021 to December 31, 2024 (4 full years, 1,461 days, 35,064 hours)  
**Audit Date:** November 9, 2026  
**Audit Status:** Complete — Rigorous Data Integrity Verification  
**Evaluation Target Horizon:** $t + 1\text{h}$ (Lead-1h Multi-Target Supervised Learning)

---

## 1. Executive Summary & Verdict

### Verdict: **READY FOR BASELINE EXPERIMENT (WITH GOVERNED POLICIES)**

The dataset satisfies all rigorous statistical and technical criteria required to begin offline baseline modeling:
- Zero data corruption across all observation and forecast records.
- Complete metadata provenance for all 103,248 NWP records (January 2024 pilot partition duplication fully resolved).
- Continuous hourly observation records without gaps (35,064 contiguous hours).
- Mathematically verified leakage boundary ($t+1\text{h}$ future targets strictly decoupled from features available at $t$).
- 100% test pass rate across the 14-point dataset validation suite and 7 regression test suites.

> [!CAUTION]
> **Operational NWP Leakage Boundary:** The dataset is **READY FOR BASELINE EXPERIMENT** in offline cross-validation and hyperparameter tuning. However, it is **NOT YET DEPLOYABLE TO REAL-TIME PRODUCTION** until an online serving harness implements an operational ingestion latency buffer ($\ge 2\text{ hours}$).

---

## 2. Corrected Issues

### Issue 1: January 2024 Pilot vs. Annual Duplicate Resolution & Audit
* **Discovered Issue:** Both the January pilot files (`indore_historical_*_2024-01-01_to_2024-01-31.csv`) and the complete annual files (`indore_historical_*_2024.csv`) exist in `data/raw`. Simple duplicate filtering could conflate internal annual duplicates with pilot supersession.
* **Resolution & Exact Counters:** 
  1. Updated `load_all_raw_forecasts()` and `load_all_raw_observations()` in `preprocess.py` to calculate superseded pilot records explicitly via **source partition identity** (matching keys against the annual partition), rather than relying merely on overall duplicate counts.
  2. Separately audited and reported:
     - Observations: 35,064 annual records, 744 pilot records. Annual internal duplicates: **0**, Pilot internal duplicates: **0**, Superseded pilot rows: **744**.
     - Forecasts: 103,248 annual records, 2,232 pilot records. Annual internal duplicates: **0**, Pilot internal duplicates: **0**, Superseded pilot rows: **2,232**.
  3. Ensured audit counters are kept strictly separate and not overwritten with unrelated duplicate totals.
  4. Preserved raw pilot archive files intact on disk without modification.
  5. Added regression test `test_january_2024_pilot_vs_annual_duplicate_precedence` verifying the exact superseded pilot count (744 obs, 2,232 fc).

### Issue 2: Hardcoded Feature Count in Coverage Report
* **Discovered Issue:** Earlier documentation listed 58 features in the summary, while the actual training dataset dynamically generates 56 features (8 diurnal/calendar + 24 observation lags [8 vars $\times$ 3 lags] + 24 NWP forecast features [8 vars $\times$ 3 models]).
* **Resolution:** Corrected report feature counting in `dataset_coverage_report.json` and `dataset_coverage_report.md` to compute feature counts dynamically from the schema.

---

## 3. Observation & Forecast Coverage

### 3.1 Observation Coverage by Year
Observations were collected from the Open-Meteo Historical Weather API at hourly resolution:

| Year | Total Hours | Expected Hours | Missing Hours | Duplicates Removed | Completeness |
|---|---|---|---|---|---|
| **2021** | 8,760 | 8,760 | 0 | 0 | 100.0% |
| **2022** | 8,760 | 8,760 | 0 | 0 | 100.0% |
| **2023** | 8,760 | 8,760 | 0 | 0 | 100.0% |
| **2024 (Leap Year)** | 8,784 | 8,784 | 0 | 744 (pilot duplicate) | 100.0% |
| **Total** | **35,064** | **35,064** | **0** | **744** | **100.0%** |

Observation continuity was audited: every record has exactly a $+1\text{h}$ timestep delta from the previous record without any missing intervals.

### 3.2 Forecast Coverage by Model and Year
Forecast data across 3 numerical weather prediction models:

| Year | `best_match` | `ecmwf_ifs` | `gfs_seamless` | Notes |
|---|---|---|---|---|
| **2021** | 8,760 | 8,760 | 6,816 | GFS seamless archive begins March 23, 2021 |
| **2022** | 8,760 | 8,760 | 8,760 | 100.0% complete |
| **2023** | 8,760 | 8,760 | 8,760 | 100.0% complete |
| **2024** | 8,784 | 8,784 | 8,784 | 100.0% complete (2,232 pilot records resolved) |
| **Total** | **35,064** | **35,064** | **33,120** | **Total records: 103,248** |

---

## 4. Missing Values Analysis by Model and Variable

### 4.1 Observations Table
- Zero missing values across all 8 meteorological variables across all 35,064 rows ($0.0\%$).

### 4.2 Forecast Table
- `best_match`: 0 missing values across all variables ($0.0\%$).
- `ecmwf_ifs`: 0 missing values across all variables ($0.0\%$).
- `gfs_seamless`: 
  - `cloud_cover`: 1 missing value on `2021-03-23 00:00:00+00:00` (the first hour GFS begins).
  - `precipitation`: 346 missing values:
    - 1 value: `2021-03-23 00:00:00+00:00`
    - 28 values: `2022-11-29 20:00:00+00:00` to `2022-11-30 23:00:00+00:00`
    - 317 values: `2022-12-01 00:00:00+00:00` to `2022-12-14 04:00:00+00:00`
  - All other 6 variables: 0 missing values during the active coverage window.

### 4.3 Training Dataset Feature Missingness
Total training records: **35,061 rows**.
- Diurnal & Calendar Features (8 features): **0 missing** ($0.0\%$).
- Observation Lag Features (24 features: 8 vars $\times$ [t0, lag1h, lag2h]): **0 missing** ($0.0\%$).
- Best Match Forecast Features (8 features): **0 missing** ($0.0\%$).
- ECMWF IFS Forecast Features (8 features): **0 missing** ($0.0\%$).
- GFS Seamless Forecast Features (8 features):
  - `feat_nwp_temperature_2m_gfs_seamless`: 1,941 missing ($5.536\%$) — matches expected historical coverage gap before March 23, 2021.
  - `feat_nwp_dew_point_2m_gfs_seamless`: 1,941 missing ($5.536\%$).
  - `feat_nwp_relative_humidity_2m_gfs_seamless`: 1,941 missing ($5.536\%$).
  - `feat_nwp_surface_pressure_gfs_seamless`: 1,941 missing ($5.536\%$).
  - `feat_nwp_wind_speed_10m_gfs_seamless`: 1,941 missing ($5.536\%$).
  - `feat_nwp_wind_direction_10m_gfs_seamless`: 1,941 missing ($5.536\%$).
  - `feat_nwp_cloud_cover_gfs_seamless`: 1,942 missing ($5.539\%$) — 1,941 expected gap + 1 internal gap.
  - `feat_nwp_precipitation_gfs_seamless`: 2,287 missing ($6.523\%$) — 1,941 expected gap + 346 internal gaps.

---

## 5. NWP Missing-Value Policy Semantics & Verified Sample Counts

To handle GFS missingness without unprincipled zero-imputation, distinct policies are defined and verified by actually applying each policy to the generated dataset:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Policy: option_a (Exclude GFS Features)                                                │
│ Features: 48 (Exclude all 8 GFS columns, retain best_match & ecmwf_ifs)                │
│ Verified Samples: 35,061 (100.0% sample retention, 0 nulls across all features)        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Policy: option_b (Retain All NWP Models with Missing-Value Support - Default)         │
│ Features: 56 (Keep all 8 GFS columns, model-specific namespaces preserved)             │
│ Verified Samples: 35,061 (Native NaN support in gradient boosted trees / LightGBM)     │
│ Total Missing Values: 15,875 (1,941 x 8 pre-coverage + 346 precipitation + 1 cloud)   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Policy: gfs_coverage_boundary_cutoff (March 23, 2021 Cutoff)                           │
│ Truncates dataset to start when GFS historical coverage begins (>= 2021-03-23 00:00Z).  │
│ NOTE: This is NOT a complete-data policy. Internal GFS missingness is retained:        │
│   - Remaining internal precipitation missing values: exactly 345 samples               │
│ Verified Samples: 33,119 samples                                                      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Policy: strict_complete_cases (Separate Policy)                                        │
│ Drops any row containing missing feature values across all 56 features.                │
│ Verified Samples: 32,774 samples (100% dense matrix across all 56 features)            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Policy: clean_two_year_cutoff (>= 2023-01-01)                                          │
│ Clean 2-year post-anomaly window (2023-01-01 to 2024-12-31).                           │
│ Verified Samples: 17,543 samples                                                      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommendation for Modeling Phase:
- **Primary Baseline Track:** **Option B** (`option_b`) using XGBoost or LightGBM, which natively branch on missing values.
- **Ablation / Linear Models Track:** **Option A** (`option_a`) (48 features, 35,061 complete samples) for linear ridge/lasso or neural models that require dense matrices without discarding samples.
- **Strict Complete Dense Track:** **Strict Complete Cases** (`strict_complete_cases`) (56 features, 32,774 dense samples) if all 3 NWP models must be included in non-NaN-aware architectures.

---

## 6. Training Targets & Statistical Distributions

All targets are evaluated at lead time $t + 1\text{ hour}$:

1. **Continuous Temperature (`target_obs_temperature_2m_lead1h`):**
   - Mean: $24.85^\circ\text{C}$, Std: $6.04^\circ\text{C}$
   - Min: $6.50^\circ\text{C}$, Max: $45.00^\circ\text{C}$
   - Null count: **0**
2. **Binary Rain Occurrence (`target_obs_rain_occurrence_lead1h`):**
   - Class 0 (No rain / trace $< 0.1\text{ mm}$): **29,566 samples** ($84.33\%$)
   - Class 1 (Measurable rain $\ge 0.1\text{ mm}$): **5,495 samples** ($15.67\%$)
   - Null count: **0**
   - Invariant: Strictly matches `precipitation >= 0.1 mm`.
3. **Continuous Precipitation (`target_obs_precipitation_lead1h`):**
   - Mean: $0.132\text{ mm}$, Std: $0.736\text{ mm}$
   - Min: $0.00\text{ mm}$, Max: $27.60\text{ mm}$
   - Null count: **0**

---

## 7. Forecast Provenance Limitations & Operational NWP Availability Impossibility

### Provenance Audit Findings:
1. **Forecast Initialization Cycle:**
   - The Open-Meteo Historical Forecast API maps numerical weather forecasts directly to target **valid timestamps** ($t+1\text{h}$).
   - The specific model run initialization cycle (e.g. 00Z, 06Z, 12Z, or 18Z run) is **NOT provided** by the source API.
   - In accordance with strict data contract standards, `initialization_time_utc` is preserved as unknown (`UNKNOWN_FROM_OPEN_METEO_API`) and `lead_time_hours` is kept as `NaN`. Under no circumstances are cycles or lead times fabricated (e.g. never assumed to be 0).
2. **Historical Retrieval vs. Forecast Publication Timestamps:**
   - The `retrieval_timestamp_utc` column records the **wall-clock timestamp when our pipeline retrieved the data from Open-Meteo**, NOT the original operational forecast release, publication, or dissemination time.
3. **Operational NWP Availability Cannot Be Reconstructed:**
   - Because original operational release and dissemination timestamps are absent from this historical archive, **operational NWP availability at inference decision time $t$ cannot be reconstructed from this archive**.
   - In actual production operations, supercomputer assimilation and model distribution introduce an operational latency of 1.5 to 3.5 hours.
   - **Production Requirement:** Any live online inference system in Phase 4 must apply an explicit **$\ge 2\text{-hour}$ latency buffer** (e.g. only ingesting runs initialized prior to $t - 2\text{h}$) to eliminate lookahead bias.

---

## 8. Final Dataset Artifact Manifest

| File Path | Rows | Columns | Size | MD5 / Integrity |
|---|---|---|---|---|
| `data/processed/historical_observations.parquet` | 35,064 | 14 | ~780 KB | Monotonic hourly UTC |
| `data/processed/historical_observations.csv` | 35,064 | 13 | ~3.3 MB | CSV representation |
| `data/processed/historical_forecasts.parquet` | 103,248 | 20 | ~1.5 MB | Complete metadata, 0 nulls in provenance |
| `data/processed/historical_forecasts.csv` | 103,248 | 19 | ~12.2 MB | CSV representation |
| `data/processed/training_dataset.parquet` | 35,061 | 63 | ~2.5 MB | 56 features, 3 targets, 4 index/meta |
| `data/processed/training_dataset.csv` | 35,061 | 63 | ~15.9 MB | CSV representation |

