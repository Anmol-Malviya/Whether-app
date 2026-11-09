"""
evaluate.py - Evaluation metrics and reporting utilities for WeatherPulse Phase 4.

Provides evaluation functions for:
1. Continuous regression (MAE, RMSE, R2, Bias)
2. Binary classification (Precision, Recall, F1, PR-AUC, ROC-AUC, Brier score, Confusion matrix)
3. Threshold optimization on validation data
4. Target distribution summaries
"""

from typing import Dict, Any, Tuple
import numpy as np
from sklearn.metrics import (
    mean_absolute_error,
    root_mean_squared_error,
    r2_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
)


def evaluate_temperature_predictions(
    y_true: np.ndarray,
    y_pred: np.ndarray
) -> Dict[str, float]:
    """
    Evaluate temperature prediction metrics:
    - MAE (°C)
    - RMSE (°C)
    - R²
    - Mean Bias (°C)
    """
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(root_mean_squared_error(y_true, y_pred))
    r2 = float(r2_score(y_true, y_pred))
    bias = float(np.mean(y_pred - y_true))

    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 4),
        "bias": round(bias, 4),
    }


def find_best_rain_threshold(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    metric: str = "f1",
    num_thresholds: int = 100
) -> Tuple[float, float]:
    """
    Find optimal probability decision threshold on validation data.
    Sweeps thresholds from 0.01 to 0.99.
    Returns (best_threshold, best_score).
    """
    best_threshold = 0.5
    best_score = -1.0

    thresholds = np.linspace(0.01, 0.99, num_thresholds)
    for thresh in thresholds:
        preds = (y_prob >= thresh).astype(int)
        if metric == "f1":
            score = f1_score(y_true, preds, zero_division=0)
        else:
            score = f1_score(y_true, preds, zero_division=0)

        if score > best_score:
            best_score = score
            best_threshold = float(thresh)

    return round(best_threshold, 4), round(float(best_score), 4)


def evaluate_rain_predictions(
    y_true: np.ndarray,
    y_pred_binary: np.ndarray,
    y_prob: np.ndarray = None
) -> Dict[str, Any]:
    """
    Evaluate binary rain occurrence predictions:
    - Precision
    - Recall
    - F1 Score
    - PR-AUC (Average Precision)
    - ROC-AUC
    - Brier Score Loss
    - Confusion Matrix [[TN, FP], [FN, TP]]
    """
    prec = float(precision_score(y_true, y_pred_binary, zero_division=0))
    rec = float(recall_score(y_true, y_pred_binary, zero_division=0))
    f1 = float(f1_score(y_true, y_pred_binary, zero_division=0))
    cm = confusion_matrix(y_true, y_pred_binary).tolist()

    metrics: Dict[str, Any] = {
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "confusion_matrix": cm,
    }

    if y_prob is not None:
        try:
            pr_auc = float(average_precision_score(y_true, y_prob))
            metrics["pr_auc"] = round(pr_auc, 4)
        except Exception:
            metrics["pr_auc"] = None

        try:
            roc_auc = float(roc_auc_score(y_true, y_prob))
            metrics["roc_auc"] = round(roc_auc, 4)
        except Exception:
            metrics["roc_auc"] = None

        try:
            brier = float(brier_score_loss(y_true, y_prob))
            metrics["brier_score"] = round(brier, 4)
        except Exception:
            metrics["brier_score"] = None

    return metrics


def analyze_rain_calibration(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    num_bins: int = 10
) -> Dict[str, Any]:
    """
    Computes reliability diagram data, calibration curve,
    predicted probability distribution, and observed event frequency by bin.
    """
    bins = np.linspace(0.0, 1.0, num_bins + 1)
    bin_indices = np.digitize(y_prob, bins) - 1
    bin_indices = np.clip(bin_indices, 0, num_bins - 1)

    bin_data = []
    for i in range(num_bins):
        mask = bin_indices == i
        count = int(np.sum(mask))
        bin_lower = round(float(bins[i]), 2)
        bin_upper = round(float(bins[i + 1]), 2)

        if count > 0:
            mean_pred_prob = round(float(np.mean(y_prob[mask])), 4)
            obs_event_freq = round(float(np.mean(y_true[mask])), 4)
            event_count = int(np.sum(y_true[mask]))
        else:
            mean_pred_prob = round((bin_lower + bin_upper) / 2.0, 4)
            obs_event_freq = 0.0
            event_count = 0

        bin_data.append({
            "bin_index": i,
            "bin_range": f"[{bin_lower:.1f}, {bin_upper:.1f})",
            "sample_count": count,
            "sample_percentage": round((count / len(y_prob)) * 100, 2),
            "event_count": event_count,
            "mean_predicted_probability": mean_pred_prob,
            "observed_event_frequency": obs_event_freq,
            "calibration_error": round(abs(mean_pred_prob - obs_event_freq), 4) if count > 0 else 0.0,
        })

    brier = round(float(brier_score_loss(y_true, y_prob)), 4)

    return {
        "num_bins": num_bins,
        "overall_brier_score": brier,
        "bins": bin_data,
    }


def analyze_rainfall_distribution(series: np.ndarray) -> Dict[str, Any]:
    """
    Analyzes rainfall amount target distribution as requested in Phase 4 Step 4.
    """
    total = len(series)
    nonzero_mask = series > 0.0
    nonzero_count = int(np.sum(nonzero_mask))
    zero_count = total - nonzero_count

    stats = {
        "total_samples": total,
        "zero_count": zero_count,
        "zero_percentage": round((zero_count / total) * 100, 2),
        "nonzero_count": nonzero_count,
        "nonzero_percentage": round((nonzero_count / total) * 100, 2),
    }

    if nonzero_count > 0:
        nonzero_vals = series[nonzero_mask]
        stats["nonzero_min"] = round(float(np.min(nonzero_vals)), 4)
        stats["nonzero_max"] = round(float(np.max(nonzero_vals)), 4)
        stats["nonzero_mean"] = round(float(np.mean(nonzero_vals)), 4)
        stats["nonzero_median"] = round(float(np.median(nonzero_vals)), 4)
        stats["nonzero_std"] = round(float(np.std(nonzero_vals)), 4)
        stats["p75"] = round(float(np.percentile(nonzero_vals, 75)), 4)
        stats["p90"] = round(float(np.percentile(nonzero_vals, 90)), 4)
        stats["p99"] = round(float(np.percentile(nonzero_vals, 99)), 4)
    else:
        stats["nonzero_min"] = 0.0
        stats["nonzero_max"] = 0.0
        stats["nonzero_mean"] = 0.0
        stats["nonzero_median"] = 0.0
        stats["nonzero_std"] = 0.0

    return stats

