# WeatherPulse Phase 3.2: Multi-Year Seasonal & Dataset Coverage Report

**Location:** Indore, Madhya Pradesh ($22.7196^\circ\text{N}, 75.8577^\circ\text{E}$, elevation $553\text{ m}$)  
**Period Covered:** January 1, 2021 to December 31, 2024 (4 full years, 1,461 days, 35,064 hours)  
**Execution Date:** November 9, 2026  
**Status:** **100% Validated (0 Nulls, 0 Duplicates, Strict Zero Leakage)**

---

## 1. Multi-Year Observations & Data Completeness

Across the entire 4-year period (2021–2024), **35,064 hourly records** were fetched directly from the Open-Meteo Archive API without gaps:

| Year | Expected Hours | Downloaded Hours | Missing Records | Duplicate Records | Status |
|---|---|---|---|---|---|
| **2021** | 8,760 | 8,760 | 0 | 0 | 100% Complete |
| **2022** | 8,760 | 8,760 | 0 | 0 | 100% Complete |
| **2023** | 8,760 | 8,760 | 0 | 0 | 100% Complete |
| **2024 (Leap Year)** | 8,784 | 8,784 | 0 | 0 | 100% Complete |
| **Total** | **35,064** | **35,064** | **0** | **0** | **100% Complete** |

---

## 2. Seasonal Climate Coverage (Indore Climatology)

The 4-year dataset captures the full dynamic annual meteorological cycles of Malwa/Central India:

```
┌────────────────────────────────────────────────────────────────────────┐
│ SUMMER (March - May)                                                  │
│ Hours: 8,832 | Max Temp: 45.0°C | Avg Temp: 29.4°C | Rain: 65.4 mm    │
│ Intense pre-monsoon heatwaves, high evapotranspiration, low humidity   │
├────────────────────────────────────────────────────────────────────────┤
│ SOUTHWEST MONSOON (June - September)                                  │
│ Hours: 11,712 | Rain Hours: 4,873 (41.6%) | Total Rain: 4,171.8 mm    │
│ Accounts for 89.8% of Indore's annual precipitation; peak convective  │
│ rainfall with max hourly intensity of 27.6 mm/h                       │
├────────────────────────────────────────────────────────────────────────┤
│ POST-MONSOON (October - November)                                     │
│ Hours: 5,856 | Avg Temp: 23.8°C | Rain: 178.5 mm                      │
│ Transition window with retreating monsoon disturbances                │
├────────────────────────────────────────────────────────────────────────┤
│ WINTER (December - February)                                          │
│ Hours: 8,664 | Min Temp: 6.5°C | Avg Temp: 19.2°C | Rain: 228.7 mm   │
│ Cool dry conditions punctuated by occasional Western Disturbances     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Rainfall Target Distribution & Solved Class Imbalance

In the January 2024 pilot, rain was present in only 4.97% of hours (37 hours), creating severe sparsity. Expanding to 2021–2024 resolves this imbalance and provides robust statistical support for training:

| Category | Definition | Hour Count | Percentage |
|---|---|---|---|
| **Zero / Trace Rain** | $< 0.1\text{ mm}$ | 29,569 hours | **84.33%** |
| **Measurable Rain (`target_rain_occ = 1`)**| $\ge 0.1\text{ mm}$ | **5,495 hours** | **15.67%** |
| **Significant Rain** | $\ge 1.0\text{ mm}$ | 1,203 hours | 3.43% |
| **Heavy Rain** | $\ge 5.0\text{ mm}$ | 158 hours | 0.45% |
| **Violent Cloudburst Rain** | $\ge 15.0\text{ mm}$ | 17 hours | 0.05% |

- **Maximum Hourly Rain Recorded:** **$27.6\text{ mm}$**
- **4-Year Cumulative Rainfall:** **$4,644.4\text{ mm}$**
- **Model Training Feasibility:** With **5,495 positive rain events**, binary classification models (`target_obs_rain_occurrence_lead1h`) now have sufficient positive samples to learn atmospheric triggers (dew point convergence, humidity jumps, pressure drops). Continuous regression (`target_obs_precipitation_lead1h`) can leverage two-stage hurdle/Tweedie loss functions.

---

## 4. NWP Forecast Archive Availability & Provenance Constraints

Across 2021–2024, **103,248 model forecast records** were retrieved across 3 models:

| Year | `best_match` | `ecmwf_ifs` | `gfs_seamless` | Notes on Availability |
|---|---|---|---|---|
| **2021** | 8,760 | 8,760 | 6,816 | GFS seamless archive starts March 23, 2021 in Open-Meteo |
| **2022** | 8,760 | 8,760 | 8,760 | 100% full year availability |
| **2023** | 8,760 | 8,760 | 8,760 | 100% full year availability |
| **2024** | 8,784 | 8,784 | 8,784 | 100% full leap-year availability |

### Provenance Constraints Formally Documented:
1. **Unknown Initialization Times:** Open-Meteo Historical Forecast API maps forecasts to target valid timestamps and does not expose operational run-cycle initialization (e.g. 00Z vs 12Z cycle). `initialization_time_utc` is preserved as unknown (`UNKNOWN_FROM_OPEN_METEO_API`) and `lead_time_hours` as `NaN`. Original forecast publication timestamps cannot be reconstructed from historical retrieval timestamps.
2. **Operational Availability Reconstruction Impossibility:** Operational NWP availability at decision time $t$ cannot be reconstructed from this historical archive.
3. **Operational Latency Buffer:** For online operational deployment in Phase 4, a **$\ge 2\text{-hour}$ latency buffer** must be applied to ensure NWP runs have been ingested before decision time $t$.

---

## 5. Supervised Training Dataset Statistics

The generated `training_dataset.parquet` dataset consists of:
- **Total Samples:** **35,061 rows** (rows 1 and 2 dropped for lag initialization, last row dropped for future horizon barrier)
- **Features:** **56 features** (Diurnal calendar metrics, observation lags at $t_0, t-1\text{h}, t-2\text{h}$, and model predictions valid for $t+1\text{h}$)
- **Supervised Targets ($t+1\text{h}$):**
  1. `target_obs_temperature_2m_lead1h` (Continuous regression in $^\circ\text{C}$)
  2. `target_obs_rain_occurrence_lead1h` (Binary classification $\{0, 1\}$)
  3. `target_obs_precipitation_lead1h` (Continuous rainfall regression in $\text{mm}$)
- **Leakage Integrity:** **Zero future observation leakage verified.** All target timestamps strictly equal $t + 1\text{h}$.

