from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from sqlalchemy.sql import func
from db.database import Base


class Detection(Base):
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    source = Column(String(20), nullable=False)        # 'webcam', 'image', 'video'
    filename = Column(String(255), nullable=True)
    class_name = Column(String(100), nullable=False)
    confidence = Column(Float, nullable=False)
    bbox_x1 = Column(Float, nullable=False)
    bbox_y1 = Column(Float, nullable=False)
    bbox_x2 = Column(Float, nullable=False)
    bbox_y2 = Column(Float, nullable=False)
    activity_label = Column(String(100), nullable=True)
    track_id = Column(Integer, nullable=True)


class EvaluationRun(Base):
    __tablename__ = "evaluation_runs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    dataset_name = Column(String(100), nullable=False)
    model_size = Column(String(20), nullable=False)
    map50 = Column(Float, nullable=True)
    map5095 = Column(Float, nullable=True)
    precision = Column(Float, nullable=True)
    recall = Column(Float, nullable=True)
    f1_score = Column(Float, nullable=True)
    report_path = Column(String(500), nullable=True)
    status = Column(String(20), default="pending")   # pending, running, completed, failed
    error_message = Column(Text, nullable=True)
