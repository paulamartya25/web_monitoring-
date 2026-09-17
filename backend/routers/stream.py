import time
import logging
import numpy as np
import cv2

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, WebSocketException
from fastapi.websockets import WebSocketState

from utils.drawing import draw_detections, encode_image_to_base64, decode_base64_to_image

logger = logging.getLogger(__name__)
router = APIRouter(tags=["stream"])

# Minimum milliseconds between processed frames (10 FPS cap)
FRAME_INTERVAL_MS = 100


@router.websocket("/ws/stream")
async def stream_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for live webcam detection.

    Client sends: base64-encoded JPEG frames as text messages.
    Server returns: JSON with annotated_frame (base64), detections, fps.
    """
    await websocket.accept()
    detector     = websocket.app.state.detector
    tracker      = websocket.app.state.tracker
    activity_desc = websocket.app.state.activity
    counter      = websocket.app.state.counter
    zone_monitor = websocket.app.state.zone_monitor
    traffic_stats = websocket.app.state.traffic_stats

    # Reset ALL state for fresh stream session (clears old video/session data)
    activity_desc.reset()
    counter.reset()
    zone_monitor.reset() if hasattr(zone_monitor, 'reset') else None
    traffic_stats.reset()

    logger.info("WebSocket stream connected — all stats reset")
    last_frame_time = 0.0
    frame_count = 0
    fps_window: list[float] = []

    try:
        while True:
            try:
                data = await websocket.receive_text()
            except WebSocketDisconnect:
                break

            now = time.time()
            elapsed_ms = (now - last_frame_time) * 1000

            # Throttle: skip frames if client sends faster than limit
            if elapsed_ms < FRAME_INTERVAL_MS:
                continue

            # Decode incoming frame
            frame = decode_base64_to_image(data)
            if frame is None:
                await websocket.send_json({"error": "Could not decode frame"})
                continue

            t_start = time.time()

            # Inference pipeline
            result = detector.detect_image(frame)
            tracked = tracker.update(result["detections"])
            described = activity_desc.describe(tracked)
            vehicle_counts = counter.update(described)
            zone_alerts = zone_monitor.check(described)
            traffic_stats.update(described, zone_alerts)
            annotated = draw_detections(frame, described)
            b64_out = encode_image_to_base64(annotated, quality=75)

            t_end = time.time()
            inference_ms = (t_end - t_start) * 1000

            # FPS computation (rolling window)
            fps_window.append(now)
            fps_window = [t for t in fps_window if now - t <= 2.0]
            fps = len(fps_window) / 2.0

            last_frame_time = now
            frame_count += 1

            response = {
                "annotated_frame": b64_out,
                "detections": described,
                "fps": round(fps, 1),
                "inference_ms": round(inference_ms, 1),
                "frame_count": frame_count,
                "vehicle_counts": vehicle_counts,
                "zone_alerts": zone_alerts,
                "traffic_summary": traffic_stats.summary(),
            }

            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_json(response)

    except Exception as e:
        logger.error(f"Stream error: {e}")
    finally:
        activity_desc.reset()
        logger.info(f"WebSocket disconnected after {frame_count} frames")
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.close()
