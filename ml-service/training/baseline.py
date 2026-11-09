"""
baseline.py - Persistence and heuristic baselines for WeatherPulse Phase 4.

Provides naive persistence baselines against which trained machine learning models
are compared to ensure real predictive skill.
"""

from typing import Union
import numpy as np
import pandas as pd


def get_temperature_persistence_predictions(
    df: pd.DataFrame,
    current_temp_col: str = "feat_obs_temperature_2m_t0"
) -> np.ndarray:
    """
    Persistence baseline for temperature:
    predicted_temperature(t + 1h) = current_observed_temperature(t)
    """
    if current_temp_col not in df.columns:
        raise ValueError(f"Required current temperature column '{current_temp_col}' not found.")
    return df[current_temp_col].to_numpy()


def get_rain_occurrence_persistence_predictions(
    df: pd.DataFrame,
    current_rain_col: str = "feat_obs_precipitation_t0",
    threshold: float = 0.1
) -> np.ndarray:
    """
    Persistence baseline for rain occurrence:
    predicted_rain_occurrence(t + 1h) = 1 if current_observed_precip(t) >= 0.1mm else 0
    """
    if current_rain_col not in df.columns:
        raise ValueError(f"Required current precipitation column '{current_rain_col}' not found.")
    return (df[current_rain_col].to_numpy() >= threshold).astype(int)


def get_rain_probability_persistence(
    df: pd.DataFrame,
    train_rain_prevalence: float
) -> np.ndarray:
    """
    Climatology / constant base rate baseline for rain probability:
    Always predicts the historical training set rain prevalence.
    """
    return np.full(len(df), train_rain_prevalence, dtype=float)

