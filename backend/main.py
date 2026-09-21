import os
import logging
import torch
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from core.config import settings
from core.detector import YOLODetector
from core.tracker import CentroidTracker
from core.traffic_analyzer import TrafficActivityDescriptor
from core.zone_config import VehicleCounter, ZoneMonitor, TrafficStats
from db.database import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # Create directories
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.REPORTS_DIR, exist_ok=True)
    os.makedirs(settings.MODELS_DIR, exist_ok=True)

    # Init database
    await init_db()
    logger.info("Database initialized.")

    # Load model + pipeline components
    app.state.detector = YOLODetector(model_size=settings.MODEL_SIZE)
    app.state.tracker  = CentroidTracker()
    app.state.activity = TrafficActivityDescriptor()          # traffic-specific
    app.state.counter  = VehicleCounter(line_y=320)          # counting line at y=320
    app.state.zone_monitor = ZoneMonitor(zones=[])            # configure zones via API
    app.state.traffic_stats = TrafficStats()

    device = "CUDA (GPU)" if torch.cuda.is_available() else "CPU"
    logger.info(f"YOLOv8 loaded on {device} | Model: {settings.MODEL_SIZE}")

    yield

    # Shutdown
    logger.info("Application shutdown.")


app = FastAPI(
    title="VisionAI — Real-Time Object Detection API",
    description="YOLOv8-powered object detection with live streaming, file upload, and dataset evaluation.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Key Authentication (optional — set API_KEY in .env to enable) ─────────
_API_KEY = os.getenv("API_KEY", "")   # empty = auth disabled

@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    """
    If API_KEY is configured, require it as:
      - Header:  X-API-Key: <key>
      - OR Query: ?api_key=<key>
    Public routes (health, docs, openapi) are always allowed.
    """
    PUBLIC = {"/health", "/docs", "/openapi.json", "/redoc"}
    if _API_KEY and request.url.path not in PUBLIC:
        provided = (
            request.headers.get("X-API-Key")
            or request.query_params.get("api_key")
        )
        if provided != _API_KEY:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid or missing API key. Pass X-API-Key header."},
            )
    return await call_next(request)


# ── Static file serving ───────────────────────────────────────────────────────
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
app.mount("/reports", StaticFiles(directory=settings.REPORTS_DIR), name="reports")

# ── Routers ───────────────────────────────────────────────────────────────────
from routers.detect import router as detect_router      # noqa: E402
from routers.stream import router as stream_router      # noqa: E402
from routers.evaluate import router as evaluate_router  # noqa: E402

app.include_router(detect_router)
app.include_router(stream_router)
app.include_router(evaluate_router)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health_check():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model_info = app.state.detector.get_model_info()
    return {
        "status": "ok",
        "device": device,
        "model": model_info,
    }


@app.post("/model/reload", tags=["system"])
async def reload_model(model_size: str):
    """Hot-swap the YOLOv8 model at runtime."""
    allowed = {"yolov8n", "yolov8s", "yolov8m", "yolov8l", "yolov8x"}
    if model_size not in allowed:
        from fastapi import HTTPException
        raise HTTPException(400, f"Invalid model. Choose from {allowed}")
    app.state.detector.reload(model_size)
    return {"status": "ok", "model": model_size}
