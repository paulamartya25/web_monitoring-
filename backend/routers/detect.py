import os
import uuid
import logging
import cv2
import numpy as np

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from core.config import settings
from db.database import get_db
from db.models import Detection
from utils.drawing import draw_detections, encode_image_to_base64

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/detect", tags=["detection"])


@router.post("/image")
async def detect_image(
    request: Request,
    file: UploadFile = File(...),
    conf: float = Query(default=None),
    iou: float = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Detect objects in an uploaded image. Returns annotated image (base64) + detections JSON."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (JPEG, PNG, etc.).")

    conf = conf or settings.CONFIDENCE_THRESHOLD
    iou = iou or settings.IOU_THRESHOLD

    contents = await file.read()
    np_arr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Could not decode image. Ensure the file is a valid image.")

    detector = request.app.state.detector
    tracker = request.app.state.tracker
    activity_desc = request.app.state.activity

    result = detector.detect_image(image, conf=conf, iou=iou)
    tracked = tracker.update(result["detections"])
    described = activity_desc.describe(tracked)

    annotated = draw_detections(image, described)
    b64 = encode_image_to_base64(annotated)

    # Save annotated image
    ext = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
    save_name = f"{uuid.uuid4().hex}_annotated{ext}"
    save_path = os.path.join(settings.UPLOAD_DIR, save_name)
    cv2.imwrite(save_path, annotated)

    # Persist to DB
    for det in described:
        x1, y1, x2, y2 = det["bbox"]
        db.add(Detection(
            source="image",
            filename=file.filename,
            class_name=det["class_name"],
            confidence=det["confidence"],
            bbox_x1=x1, bbox_y1=y1, bbox_x2=x2, bbox_y2=y2,
            activity_label=det.get("activity"),
            track_id=det.get("track_id"),
        ))
    await db.commit()

    return {
        "detections": described,
        "annotated_image": b64,
        "total_detections": len(described),
        "annotated_url": f"/uploads/{save_name}",
    }


@router.post("/video")
async def detect_video(
    request: Request,
    file: UploadFile = File(...),
    conf: float = Query(default=None),
    iou: float = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Detect objects in an uploaded video. Returns annotated video URL + per-frame log."""
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video (mp4, avi, etc.).")

    conf = conf or settings.CONFIDENCE_THRESHOLD
    iou = iou or settings.IOU_THRESHOLD

    uid = uuid.uuid4().hex
    original_name = file.filename or "video.mp4"
    input_name = f"{uid}_input_{original_name}"
    output_name = f"{uid}_output_{original_name}"
    input_path = os.path.join(settings.UPLOAD_DIR, input_name)
    output_path = os.path.join(settings.UPLOAD_DIR, output_name)

    contents = await file.read()
    with open(input_path, "wb") as f:
        f.write(contents)

    detector = request.app.state.detector
    tracker = request.app.state.tracker
    activity_desc = request.app.state.activity
    activity_desc.reset()

    from utils.video import process_video

    def frame_callback(frame, frame_idx):
        result = detector.detect_image(frame, conf=conf, iou=iou)
        tracked = tracker.update(result["detections"])
        described = activity_desc.describe(tracked)
        annotated = draw_detections(frame, described)
        return annotated, described

    try:
        per_frame_log = process_video(input_path, output_path, frame_callback)
    except Exception as e:
        logger.error(f"Video processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Video processing failed: {str(e)}")

    # Persist unique detections to DB
    seen: set = set()
    for frame_data in per_frame_log[:200]:
        for det in frame_data["detections"]:
            key = (det["class_name"], det.get("track_id"))
            if key not in seen:
                x1, y1, x2, y2 = det["bbox"]
                db.add(Detection(
                    source="video",
                    filename=original_name,
                    class_name=det["class_name"],
                    confidence=det["confidence"],
                    bbox_x1=x1, bbox_y1=y1, bbox_x2=x2, bbox_y2=y2,
                    activity_label=det.get("activity"),
                    track_id=det.get("track_id"),
                ))
                seen.add(key)
    await db.commit()

    return {
        "annotated_video_url": f"/uploads/{output_name}",
        "total_frames": len(per_frame_log),
        "per_frame_log": per_frame_log[:50],
        "download_filename": output_name,
        "message": f"Processed {len(per_frame_log)} frames successfully.",
    }


@router.get("/log")
async def get_detection_log(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0),
    source: str = Query(default=None),
    class_name: str = Query(default=None),
):
    """Get paginated detection log from the database."""
    query = select(Detection).order_by(desc(Detection.timestamp))
    if source:
        query = query.where(Detection.source == source)
    if class_name:
        query = query.where(Detection.class_name == class_name)
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    rows = result.scalars().all()

    return {
        "detections": [
            {
                "id": r.id,
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "source": r.source,
                "filename": r.filename,
                "class_name": r.class_name,
                "confidence": r.confidence,
                "bbox": [r.bbox_x1, r.bbox_y1, r.bbox_x2, r.bbox_y2],
                "activity_label": r.activity_label,
                "track_id": r.track_id,
            }
            for r in rows
        ],
        "count": len(rows),
        "offset": offset,
        "limit": limit,
    }
