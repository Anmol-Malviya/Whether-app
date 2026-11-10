from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    PROJECT_NAME: str = "WeatherPulse ML Prediction Service"
    API_V1_STR: str = "/api/v1"
    
    # Paths to model artifacts
    TEMPERATURE_MODEL_PATH: str = "ml-service/models/temperature_model_obs_only.joblib"
    RAIN_MODEL_PATH: str = "ml-service/models/rain_model_obs_only.joblib"
    
    # Location timezone for diurnal feature engineering
    LOCAL_TIMEZONE: str = "Asia/Kolkata"
    
    # CORS Configuration
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"]
    )
    
    # Request constraints
    MAX_REQUEST_BODY_BYTES: int = 100_000  # Sensible payload limit (100 KB)

    # Admin API key for protected operational endpoints (optional)
    ADMIN_API_KEY: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()

