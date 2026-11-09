import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from api.config import settings
from api.schemas import (
    PredictionRequest,
    PredictionResponse,
    HealthResponse,
    ModelInfoResponse
)
from api.predictor import predictor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("ml_service.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager:
    Loads ML model artifacts once during startup.
    Handles startup failures gracefully and provides clean shutdown.
    """
    logger.info("Initializing WeatherPulse ML Prediction Service...")
    try:
        predictor.load_models()
        logger.info("ML Models successfully loaded into memory.")
    except Exception as e:
        logger.error(f"Failed to load ML models during startup: {e}", exc_info=True)
    
    yield
    
    logger.info("Shutting down WeatherPulse ML Prediction Service...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="FastAPI ML Prediction Service for WeatherPulse (Observation-Only Models)",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration from environment / config
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def payload_size_limit_middleware(request: Request, call_next):
    """Enforces payload size limit to prevent resource exhaustion attacks."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > settings.MAX_REQUEST_BODY_BYTES:
        return JSONResponse(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            content={
                "error": "PayloadTooLarge",
                "message": f"Request body exceeds maximum allowed size of {settings.MAX_REQUEST_BODY_BYTES} bytes."
            }
        )
    return await call_next(request)


# Exception handlers for structured, clear error responses
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Structured handler for Pydantic input validation errors."""
    errors = []
    for err in exc.errors():
        field_loc = " -> ".join([str(x) for x in err.get("loc", [])])
        msg = err.get("msg")
        errors.append({"field": field_loc, "message": msg, "type": err.get("type")})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "ValidationError",
            "message": "Input validation failed. Please check the observations schema and physical boundaries.",
            "details": errors
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Structured handler for standard HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "HTTPException",
            "message": exc.detail
        }
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Structured handler for unhandled internal exceptions."""
    logger.error(f"Unhandled error processing request {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "message": "An unexpected error occurred during request processing."
        }
    )


@app.get("/health", response_model=HealthResponse)
async def get_health():
    """
    Service health check:
    - Service status
    - Model loading status
    - Model versions
    """
    temp_loaded = predictor.temp_model is not None
    rain_loaded = predictor.rain_model is not None
    overall_status = "healthy" if (temp_loaded and rain_loaded) else "degraded"

    model_versions = {}
    if predictor.temp_artifact:
        model_versions["temperature_model"] = {
            "type": predictor.temp_artifact.get("model_type"),
            "versions": predictor.temp_artifact.get("versions"),
            "dataset_version": predictor.temp_artifact.get("dataset_version")
        }
    if predictor.rain_artifact:
        model_versions["rain_model"] = {
            "type": predictor.rain_artifact.get("model_type"),
            "versions": predictor.rain_artifact.get("versions"),
            "dataset_version": predictor.rain_artifact.get("dataset_version")
        }

    return HealthResponse(
        status=overall_status,
        temperature_model_loaded=temp_loaded,
        rain_model_loaded=rain_loaded,
        model_versions=model_versions
    )


@app.get("/models/info", response_model=ModelInfoResponse)
async def get_models_info():
    """
    Model metadata endpoint:
    - Target horizons
    - Feature count & names
    - Selected rain threshold
    """
    if not predictor.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Models are not loaded or currently unavailable."
        )
    return predictor.get_info()


@app.post("/predict", response_model=PredictionResponse)
async def predict_weather(request: PredictionRequest):
    """
    Prediction endpoint:
    - Validates exactly 3 sequential hourly observations
    - Generates 32 observation-only features in saved order
    - Returns next-hour temperature prediction and rain occurrence classification
    """
    if not predictor.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML models are not loaded or currently unavailable."
        )

    try:
        response = predictor.predict(request)
        return response
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve)
        )
    except Exception as e:
        logger.error(f"Inference error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference execution failed: {str(e)}"
        )
