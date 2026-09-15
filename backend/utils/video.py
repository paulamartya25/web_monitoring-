import cv2
import os
import logging
from typing import Callable

logger = logging.getLogger(__name__)


def process_video(
    input_path: str,
    output_path: str,
    frame_callback: Callable,
    progress_callback: Callable | None = None,
) -> list:
    """
    Process a video file frame-by-frame.

    Parameters
    ----------
    input_path      : Path to source video file
    output_path     : Path to save annotated output video
    frame_callback  : Callable(frame: ndarray, frame_idx: int) -> (annotated: ndarray, detections: list)
    progress_callback : Optional callable(percent: float) called periodically

    Returns
    -------
    List of per-frame detection dicts: [{frame_idx, detections: [...]}, ...]
    """
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {input_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    per_frame_log = []
    frame_idx = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            annotated, detections = frame_callback(frame, frame_idx)
            out.write(annotated)

            per_frame_log.append({
                "frame_idx": frame_idx,
                "timestamp_sec": round(frame_idx / fps, 3),
                "detections": detections,
            })

            if progress_callback and total_frames > 0:
                progress_callback(frame_idx / total_frames * 100)

            frame_idx += 1

    finally:
        cap.release()
        out.release()

    logger.info(f"Processed {frame_idx} frames → {output_path}")
    return per_frame_log


def get_video_info(path: str) -> dict:
    """Return basic metadata for a video file."""
    cap = cv2.VideoCapture(path)
    info = {
        "fps": cap.get(cv2.CAP_PROP_FPS),
        "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
        "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
        "total_frames": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
        "duration_sec": 0.0,
    }
    if info["fps"] > 0:
        info["duration_sec"] = round(info["total_frames"] / info["fps"], 2)
    cap.release()
    return info
