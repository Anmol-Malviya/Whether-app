from typing import List, Dict, Any
from datetime import datetime
import zoneinfo
import numpy as np
from api.schemas import HourlyObservation
from api.config import settings

# 8 primary meteorological variables in order matching training pipeline
PRIMARY_VARS = [
    "temperature_2m",
    "relative_humidity_2m",
    "dew_point_2m",
    "precipitation",
    "wind_speed_10m",
    "wind_direction_10m",
    "surface_pressure",
    "cloud_cover"
]

# The exact 32 features expected by the obs_only models
EXPECTED_FEATURES = [
    "feat_hour",
    "feat_day_of_week",
    "feat_month",
    "feat_day_of_year",
    "feat_sin_hour",
    "feat_cos_hour",
    "feat_sin_month",
    "feat_cos_month",
    "feat_obs_temperature_2m_t0",
    "feat_obs_temperature_2m_lag1h",
    "feat_obs_temperature_2m_lag2h",
    "feat_obs_relative_humidity_2m_t0",
    "feat_obs_relative_humidity_2m_lag1h",
    "feat_obs_relative_humidity_2m_lag2h",
    "feat_obs_dew_point_2m_t0",
    "feat_obs_dew_point_2m_lag1h",
    "feat_obs_dew_point_2m_lag2h",
    "feat_obs_precipitation_t0",
    "feat_obs_precipitation_lag1h",
    "feat_obs_precipitation_lag2h",
    "feat_obs_wind_speed_10m_t0",
    "feat_obs_wind_speed_10m_lag1h",
    "feat_obs_wind_speed_10m_lag2h",
    "feat_obs_wind_direction_10m_t0",
    "feat_obs_wind_direction_10m_lag1h",
    "feat_obs_wind_direction_10m_lag2h",
    "feat_obs_surface_pressure_t0",
    "feat_obs_surface_pressure_lag1h",
    "feat_obs_surface_pressure_lag2h",
    "feat_obs_cloud_cover_t0",
    "feat_obs_cloud_cover_lag1h",
    "feat_obs_cloud_cover_lag2h"
]


def build_features_from_observations(
    observations: List[HourlyObservation],
    expected_feature_order: List[str] = EXPECTED_FEATURES,
    timezone_str: str = settings.LOCAL_TIMEZONE
) -> np.ndarray:
    """
    Transforms exactly 3 sequential hourly observations [t-2, t-1, t0] into
    a 2D numpy array (1, 32) in exact expected_feature_order without pandas dependency.
    """
    if len(observations) != 3:
        raise ValueError(f"Expected exactly 3 hourly observations, got {len(observations)}")

    # Index 0: t-2 (lag 2h)
    # Index 1: t-1 (lag 1h)
    # Index 2: t0 (current)
    obs_t_minus_2 = observations[0]
    obs_t_minus_1 = observations[1]
    obs_t0 = observations[2]

    # Convert t0 timestamp to local timezone for calendar features
    tz = zoneinfo.ZoneInfo(timezone_str)
    local_dt = obs_t0.timestamp_utc.astimezone(tz)

    hour = local_dt.hour
    day_of_week = local_dt.weekday()  # Monday is 0, Sunday is 6
    month = local_dt.month
    day_of_year = local_dt.timetuple().tm_yday

    feat_sin_hour = float(np.sin(2 * np.pi * hour / 24.0))
    feat_cos_hour = float(np.cos(2 * np.pi * hour / 24.0))
    feat_sin_month = float(np.sin(2 * np.pi * month / 12.0))
    feat_cos_month = float(np.cos(2 * np.pi * month / 12.0))

    feature_dict: Dict[str, float] = {
        "feat_hour": float(hour),
        "feat_day_of_week": float(day_of_week),
        "feat_month": float(month),
        "feat_day_of_year": float(day_of_year),
        "feat_sin_hour": feat_sin_hour,
        "feat_cos_hour": feat_cos_hour,
        "feat_sin_month": feat_sin_month,
        "feat_cos_month": feat_cos_month,
    }

    # Meteorological lags
    for var in PRIMARY_VARS:
        feature_dict[f"feat_obs_{var}_t0"] = float(getattr(obs_t0, var))
        feature_dict[f"feat_obs_{var}_lag1h"] = float(getattr(obs_t_minus_1, var))
        feature_dict[f"feat_obs_{var}_lag2h"] = float(getattr(obs_t_minus_2, var))

    # Construct ordered array
    order = expected_feature_order or EXPECTED_FEATURES
    row = [feature_dict[f] for f in order]
    return np.array([row], dtype=np.float32)
