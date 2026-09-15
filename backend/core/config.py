from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    MODEL_SIZE: str = "yolov8n"
    CONFIDENCE_THRESHOLD: float = 0.25
    IOU_THRESHOLD: float = 0.45
    MAX_DETECTIONS: int = 100
    DATABASE_URL: str = "sqlite+aiosqlite:///./detections.db"
    UPLOAD_DIR: str = "./uploads"
    REPORTS_DIR: str = "./reports"
    MODELS_DIR: str = "./models"
    CORS_ORIGINS: List[str] = ["*"]
    MAX_VIDEO_SIZE_MB: int = 200
    STREAM_FPS_LIMIT: int = 15

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
