from datetime import datetime
from typing import List, Optional, Dict, Any
import math
from pydantic import BaseModel, Field, field_validator, model_validator


# Documented physical limits for Indore / Central India meteorological variables
PHYSICAL_LIMITS = {
    "temperature_2m": (-20.0, 60.0),       # Celsius
    "relative_humidity_2m": (0.0, 100.0),  # %
    "dew_point_2m": (-30.0, 45.0),         # Celsius
    "precipitation": (0.0, 300.0),         # mm/hr
    "wind_speed_10m": (0.0, 150.0),        # km/h
    "wind_direction_10m": (0.0, 360.0),    # degrees
    "surface_pressure": (800.0, 1100.0),   # hPa
    "cloud_cover": (0.0, 100.0),           # %
}


class HourlyObservation(BaseModel):
    timestamp_utc: datetime = Field(
        ...,
        description="Observation timestamp in UTC (ISO 8601 format, e.g., '2026-11-09T12:00:00Z')"
    )
    temperature_2m: float = Field(
        ...,
        description="Ambient temperature 2m above ground in degrees Celsius [-20.0 to 60.0]"
    )
    relative_humidity_2m: float = Field(
        ...,
        description="Relative humidity 2m above ground in percentage [0.0 to 100.0]"
    )
    dew_point_2m: float = Field(
        ...,
        description="Dew point temperature 2m above ground in degrees Celsius [-30.0 to 45.0]"
    )
    precipitation: float = Field(
        ...,
        description="Hourly precipitation amount in mm [0.0 to 300.0]"
    )
    wind_speed_10m: float = Field(
        ...,
        description="Wind speed 10m above ground in km/h [0.0 to 150.0]"
    )
    wind_direction_10m: float = Field(
        ...,
        description="Wind direction 10m above ground in degrees [0.0 to 360.0]"
    )
    surface_pressure: float = Field(
        ...,
        description="Atmospheric surface pressure in hPa [800.0 to 1100.0]"
    )
    cloud_cover: float = Field(
        ...,
        description="Total cloud cover in percentage [0.0 to 100.0]"
    )

    @field_validator(
        "temperature_2m",
        "relative_humidity_2m",
        "dew_point_2m",
        "precipitation",
        "wind_speed_10m",
        "wind_direction_10m",
        "surface_pressure",
        "cloud_cover",
        mode="after"
    )
    @classmethod
    def validate_finite_and_limits(cls, value: float, info) -> float:
        field_name = info.field_name
        if not math.isfinite(value):
            raise ValueError(f"Field '{field_name}' must be a finite numerical value; received {value}.")
        
        min_val, max_val = PHYSICAL_LIMITS[field_name]
        if not (min_val <= value <= max_val):
            raise ValueError(
                f"Field '{field_name}' value {value} is outside documented physical limits [{min_val}, {max_val}]."
            )
        return value

    @field_validator("timestamp_utc", mode="after")
    @classmethod
    def validate_timestamp_utc(cls, value: datetime) -> datetime:
        # Require timezone awareness or assume UTC
        if value.tzinfo is None:
            raise ValueError("Timestamp must include explicit timezone info (UTC, e.g. 'Z' or '+00:00').")
        return value


class PredictionRequest(BaseModel):
    observations: List[HourlyObservation] = Field(
        ...,
        min_length=3,
        max_length=3,
        description="Exactly 3 sequential hourly observations ordered chronologically from oldest (t-2) to newest (t0)."
    )

    @model_validator(mode="after")
    def validate_observation_sequence(self) -> "PredictionRequest":
        obs = self.observations
        if len(obs) != 3:
            raise ValueError(f"Exactly 3 hourly observations are required; received {len(obs)}.")

        # Check future timestamps against current UTC
        now_utc = datetime.now(obs[0].timestamp_utc.tzinfo)
        for i, o in enumerate(obs):
            if o.timestamp_utc > now_utc:
                raise ValueError(
                    f"Observation at index {i} has a future timestamp: {o.timestamp_utc.isoformat()} > {now_utc.isoformat()}."
                )

        # Check chronological ordering and exact 1-hour interval
        t0 = obs[0].timestamp_utc
        t1 = obs[1].timestamp_utc
        t2 = obs[2].timestamp_utc

        diff1 = (t1 - t0).total_seconds()
        diff2 = (t2 - t1).total_seconds()

        if diff1 != 3600:
            raise ValueError(
                f"Interval between observation 0 and 1 is {diff1/3600:.2f} hours; expected exactly 1 hour (3600s)."
            )
        if diff2 != 3600:
            raise ValueError(
                f"Interval between observation 1 and 2 is {diff2/3600:.2f} hours; expected exactly 1 hour (3600s)."
            )

        return self


class PredictionResponse(BaseModel):
    target_lead_time_utc: datetime = Field(
        ...,
        description="Target prediction valid timestamp in UTC (t + 1 hour)"
    )
    temperature_celsius_prediction: float = Field(
        ...,
        description="Next-hour ambient temperature forecast in Celsius"
    )
    rain_probability: float = Field(
        ...,
        description="Rain occurrence probability [0.0 to 1.0]"
    )
    rain_classification: bool = Field(
        ...,
        description="Binary rain classification evaluated at validation-selected threshold"
    )
    selected_rain_threshold: float = Field(
        ...,
        description="Threshold used for rain classification (validation-selected)"
    )
    prediction_timestamp_utc: datetime = Field(
        ...,
        description="Timestamp when the inference was computed in UTC"
    )
    model_version: Dict[str, Any] = Field(
        ...,
        description="Metadata and versions of the serving models"
    )


class HealthReadyResponse(BaseModel):
    ready: bool
    temperature_model_loaded: bool
    rain_model_loaded: bool
    feature_count: int
    message: str  # human-readable readiness summary


class InferenceMetricsSummary(BaseModel):
    total_requests: int
    successful_requests: int
    failed_requests: int
    success_rate: Optional[float]  # 0.0-1.0
    failure_rate: Optional[float]
    avg_latency_ms: Optional[float]
    p95_latency_ms: Optional[float]
    uptime_seconds: float
    last_success_at: Optional[str]  # ISO UTC
    last_failure_at: Optional[str]  # ISO UTC


class HealthResponse(BaseModel):
    status: str = Field(..., description="'healthy' or 'degraded'")
    temperature_model_loaded: bool
    rain_model_loaded: bool
    model_versions: Dict[str, Any]
    inference_metrics: Optional[InferenceMetricsSummary] = None
    service_uptime_s: Optional[float] = None


class ModelInfoResponse(BaseModel):
    temperature_model: Dict[str, Any]
    rain_model: Dict[str, Any]

