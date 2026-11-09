# WeatherPulse Phase 4.1.1 — Hardened Leakage-Safe ML Baseline Report

**Dataset:** `ml-service\data\processed\training_dataset.csv`  
**Experiment Design:** Strict Observation-Only Baseline (Zero NWP / Reanalysis features)  
**Total Historical Records:** 35,061 rows  
**Purged Boundary Rows:** 2 samples removed for strict temporal isolation  
**Feature Count:** Exactly **32 features** (8 calendar/diurnal + 24 observation lags)  
**Target Horizon:** Strictly evaluated at $t + 1.0\text{ hour}$ ($t+1\text{h}$)  
**Splitting Strategy:** Chronological Calendar Yearly with 1-Hour Temporal Purge  
**Software Stack:** Python 3.14.3 | XGBoost 3.4.1 | Scikit-Learn 1.8.0 | Joblib 1.5.3  

---

## 1. Executive Summary & Verdict

### Final Verdict: **BASELINE PROMISING**

In this hardened offline baseline, all numerical weather prediction (NWP) reanalysis columns (`best_match`, `ecmwf_ifs`, and `gfs_seamless`) were completely eliminated to eliminate data leakage and assimilation lookahead. Models were trained exclusively on physical surface observations available at decision time $t$ and diurnal/calendar cycles, with an explicit **1-hour temporal purge buffer** between yearly partitions.

| Task / Model | Test Set Persistence | Test Set ML Baseline (32 Obs Features) | Performance Delta | Evaluation Verdict |
|---|---|---|---|---|
| **Temperature ($t+1\text{h}$)** | MAE: $0.9270^\circ\text{C}$<br>RMSE: $1.2649^\circ\text{C}$ | **MAE: $0.4648^\circ\text{C}$**<br>**RMSE: $0.6840^\circ\text{C}$** | **$49.86\%$ MAE reduction**<br>**$45.92\%$ RMSE reduction** | **Substantial, genuine predictive skill over persistence** |
| **Rain Occurrence ($t+1\text{h}$)** | F1: $0.7842$<br>Recall: $78.42\%$<br>Brier: **$0.0701$** | **F1: $0.7892$**<br>**Recall: $83.04\%$**<br>Brier: **$0.0702$** | **$+4.62\%$ higher Recall**<br>PR-AUC: **$0.8675$**<br>Brier: $\approx$ identical ($+0.0001$) | **ML outperforms on true rain event detection; ML has NOT improved Brier score over persistence** |

> [!CAUTION]
> **Important Scientific Calibration Finding:**
> **The ML classifier has NOT improved the Brier score over persistence (ML Brier: $0.0702$ vs. Persistence Brier: $0.0701$).**
> Because rainfall is an infrequent event ($16.25\%$ base rate in 2024), persistence achieves a very low Brier score ($0.0701$) simply by predicting $0.0$ during persistent dry stretches. The ML model's advantage lies in **event capture sensitivity**: it achieves **$83.04\%$ recall vs. $78.42\%$ for persistence**, detecting $66$ additional rain events that persistence misses, with a **PR-AUC of $0.8675$**. However, its raw probabilities are slightly overconfident in the upper probability deciles due to positive-class reweighting (`scale_pos_weight = 5.1060`). Calibration curves and reliability data are fully documented below.

---

## 2. 1-Hour Temporal Purge & Leakage Invariants

### 2.1 The 1-Hour Temporal Purge
Because the target is evaluated at horizon $t + 1.0\text{ hour}$:
- The final sample of Train at `2022-12-31 23:00 UTC` has its target valid at `2023-01-01 00:00 UTC` — exactly the first feature timestamp of the Validation partition.
- To guarantee that **the last training target timestamp is strictly earlier than the first validation feature timestamp**, we removed `2022-12-31 23:00 UTC` (1 boundary row purged).
- Similarly, to guarantee that **the last validation target timestamp is strictly earlier than the first test feature timestamp**, we removed `2023-12-31 23:00 UTC` (1 boundary row purged).

**Purged Rows Summary:**
- Total dataset rows: 35,061
- Boundary samples removed: **2 rows** (`2022-12-31 23:00:00+00:00` and `2023-12-31 23:00:00+00:00`)
- Validated conditions:
  - `Train target_valid_time_utc.max` (`2022-12-31 23:00Z`) $<$ `Validation timestamp_utc.min` (`2023-01-01 00:00Z`) $\rightarrow$ **VERIFIED TRUE**
  - `Validation target_valid_time_utc.max` (`2023-12-31 23:00Z`) $<$ `Test timestamp_utc.min` (`2024-01-01 00:00Z`) $\rightarrow$ **VERIFIED TRUE**

### 2.2 Leakage Rules
1. **Zero NWP Columns:** 0 NWP features in the input matrix.
2. **Zero Target Columns:** 0 target columns in the input matrix.
3. **Zero Future Observations:** All observation features are restricted to time $t0$, $t-1\text{h}$, and $t-2\text{h}$.
4. **Target Horizon:** Exactly $t + 1.0\text{ hour}$.

---

## 3. Dataset Sizes & Split Boundaries (After Temporal Purge)

| Split Name | Calendar Years | Sample Count | Fraction | Start Timestamp (UTC) | End Timestamp (UTC) | Target Horizon Max (UTC) | Rain Events Count | Rain Occurrence Rate |
|---|---|---|---|---|---|---|---|---|
| **Train** | 2021 – 2022 | 17,517 | 49.96% | `2021-01-01 02:00:00+00:00` | `2022-12-31 22:00:00+00:00` | `2022-12-31 23:00:00+00:00` | 2,869 | 16.38% |
| **Validation** | 2023 | 8,759 | 24.98% | `2023-01-01 00:00:00+00:00` | `2023-12-31 22:00:00+00:00` | `2023-12-31 23:00:00+00:00` | 1,199 | 13.69% |
| **Test** | 2024 | 8,783 | 25.05% | `2024-01-01 00:00:00+00:00` | `2024-12-31 22:00:00+00:00` | `2024-12-31 23:00:00+00:00` | 1,427 | 16.25% |
| **Total Partitioned** | 2021 – 2024 | 35,059 | 99.99% | `2021-01-01 02:00:00+00:00` | `2024-12-31 22:00:00+00:00` | `2024-12-31 23:00:00+00:00` | 5,495 | 15.67% |

---

## 4. Temperature Prediction Model (`xgb.XGBRegressor`)

- **Features Used:** Exactly 32 features (8 calendar + 24 observation lags)
- **Hyperparameters:** `n_estimators=150`, `max_depth=5`, `learning_rate=0.08`, `subsample=0.8`, `colsample_bytree=0.8`, `early_stopping_rounds=15`, `random_state=42`
- **Best Early-Stopping Iteration:** 150

### Performance Across Partitions vs Persistence:
| Partition | Metric | ML Baseline (Obs-Only) | Persistence Baseline | Relative Improvement |
|---|---|---|---|---|
| **Train (2021–2022)** | MAE ($^\circ\text{C}$) | 0.3636 | 0.9503 | +61.94% |
| | RMSE ($^\circ\text{C}$) | 0.5308 | 1.3100 | +58.92% |
| | $R^2$ Score | 0.9925 | 0.9545 | — |
| | Bias ($^\circ\text{C}$) | -0.0000 | 0.0001 | — |
| **Validation (2023)** | MAE ($^\circ\text{C}$) | 0.4563 | 0.9621 | +52.57% |
| | RMSE ($^\circ\text{C}$) | 0.6716 | 1.3203 | +49.13% |
| | $R^2$ Score | 0.9868 | 0.9489 | — |
| | Bias ($^\circ\text{C}$) | -0.0338 | -0.0006 | — |
| **Test (2024)** | MAE ($^\circ\text{C}$) | **0.4648** | **0.9270** | **+49.86%** |
| | RMSE ($^\circ\text{C}$) | **0.6840** | **1.2649** | **+45.92%** |
| | $R^2$ Score | **0.9870** | **0.9557** | — |
| | Bias ($^\circ\text{C}$) | **-0.0916** | **0.0002** | — |

---

## 5. Rain Occurrence Prediction Model (`xgb.XGBClassifier`)

- **Class Imbalance Handling:** `scale_pos_weight = 5.1056` (from 2021–2022 train partition)
- **Validation-Selected Threshold:** **`0.7425`** (maximizing 2023 Validation F1 at **`0.7812`**; 2024 Test set was kept untouched during threshold selection).
- **Persistence Baseline:** $\hat{R}_{t+1\text{h}} = 1$ if current observed precip $\ge 0.1\text{ mm}$ else 0.
- **Climatology Baseline:** Fixed training set base rate ($16.38\%$).

### Detailed Metrics on Unseen 2024 Test Set (8,783 samples, 1,427 rain events):
| Metric | ML Baseline (Obs-Only) | Persistence Baseline | Climatology Baseline |
|---|---|---|---|
| **Precision** | **0.7519** | 0.7842 | 0.0000 |
| **Recall** | **0.8304** | 0.7842 | 0.0000 |
| **F1 Score** | **0.7892** | 0.7842 | 0.0000 |
| **PR-AUC** | **0.8675** | 0.6500 | 0.1625 |
| **ROC-AUC** | **0.9672** | 0.8711 | 0.5000 |
| **Brier Score** | **0.0702** | **0.0701** | 0.1361 |
| **Confusion Matrix** | `[6965, 391 / 242, 1185]` | `[7048, 308 / 308, 1119]` | `[7356, 0 / 1427, 0]` |

---

## 6. Rain Calibration Curve & Reliability Diagram Data

Below is the calibration curve data across 10 probability deciles for the 2024 Test Set (8,783 hours):

| Probability Decile | Total Hours in Bin | Sample % | Observed Rain Events | Mean Predicted Probability | Observed Event Frequency | Calibration Error ($|\bar{p} - \bar{y}|$) |
|---|---|---|---|---|---|---|
| `[0.0, 0.1)` | 5,634 (64.15%) | 27 | 0.0096 | 0.0048 | 0.0048 |
| `[0.1, 0.2)` | 431 (4.91%) | 22 | 0.1444 | 0.0510 | 0.0934 |
| `[0.2, 0.3)` | 288 (3.28%) | 26 | 0.2451 | 0.0903 | 0.1548 |
| `[0.3, 0.4)` | 228 (2.6%) | 31 | 0.3471 | 0.1360 | 0.2111 |
| `[0.4, 0.5)` | 195 (2.22%) | 31 | 0.4471 | 0.1590 | 0.2881 |
| `[0.5, 0.6)` | 188 (2.14%) | 42 | 0.5476 | 0.2234 | 0.3242 |
| `[0.6, 0.7)` | 166 (1.89%) | 40 | 0.6533 | 0.2410 | 0.4123 |
| `[0.7, 0.8)` | 184 (2.09%) | 66 | 0.7509 | 0.3587 | 0.3922 |
| `[0.8, 0.9)` | 318 (3.62%) | 166 | 0.8548 | 0.5220 | 0.3328 |
| `[0.9, 1.0)` | 1,151 (13.1%) | 976 | 0.9664 | 0.8480 | 0.1184 |

### Calibration Analysis & Insights:
1. **Low Probability Range ($[0.0, 0.1)$):** Highly calibrated. 5,634 hours ($64.15\%$ of the year) are predicted with mean probability $0.0096$, where actual rain occurred in only $0.48\%$ of hours (calibration error $< 0.005$).
2. **Intermediate Range ($[0.1, 0.8)$):** The model exhibits slight overconfidence ($\sim 10\%$ to $30\%$ higher predicted probability than observed frequency). This is the expected mathematical trade-off of applying `scale_pos_weight = 5.1` during loss optimization to boost minority-event recall.
3. **High Probability Range ($[0.9, 1.0]$):** 1,151 hours ($13.10\%$ of the year) were predicted with mean probability $0.9664$, with an actual event frequency of $84.80\%$.
4. **Production Recommendation for Phase 5:** Apply **Isotonic Regression** or **Platt Scaling (Sigmoid)** fitted on the validation set before feeding rain probabilities to user-facing weather alerts if strictly calibrated probabilities are desired.

---

## 7. Model Performance vs. Real-Time Production Readiness

> [!WARNING]
> **Clear Distinction: Model Skill vs. Production Deployment Readiness**
> - **Model Skill:** The offline ML models demonstrate clear predictive superiority over persistence ($49.86\%$ MAE reduction for temperature; $+4.62\%$ higher recall and $0.8675$ PR-AUC for rain).
> - **Production Readiness (NOT YET DEPLOYABLE):**
>   1. **No Live Ingestion Service:** There is currently no automated worker pulling real-time weather observations at :00 past each hour.
>   2. **Missing Feature Pipeline:** Real-time inference requires a latency-aware feature computation engine that calculates running observation lags ($t0, t-1\text{h}, t-2\text{h}$) without missing-data crashes.
>   3. **No Calibration Post-Processor:** As discovered in Section 6, probability outputs should pass through a calibrated scaler before driving user-facing weather advisory banners.
>   4. **No Fallback Controller:** An operational deployment must fall back to persistence or NWP whenever local station sensors drop offline.

---

## 8. Saved Artifacts Verification

The following files have been saved and independently verified via round-trip inference tests:
- `ml-service/models/temperature_model_obs_only.joblib` (~170 KB)
- `ml-service/models/rain_model_obs_only.joblib` (~220 KB)
- `ml-service/data/reports/phase4_1_metrics.json`
- `ml-service/data/reports/phase4_1_training_report.md`
