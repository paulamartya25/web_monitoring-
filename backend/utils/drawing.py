import cv2
import numpy as np
import base64

# Color palette (BGR) — 20 distinct colors
_PALETTE = [
    (255, 56, 56),   (255, 157, 151), (255, 112, 31),  (255, 178, 29),
    (207, 210, 49),  (72, 249, 10),   (146, 204, 23),  (61, 219, 134),
    (26, 147, 52),   (0, 212, 187),   (44, 153, 168),  (0, 194, 255),
    (52, 69, 147),   (100, 115, 255), (0, 24, 236),    (132, 56, 255),
    (82, 0, 133),    (203, 56, 255),  (255, 149, 200), (255, 55, 199),
]


def _color_for(class_id: int) -> tuple:
    return _PALETTE[class_id % len(_PALETTE)]


def draw_detections(image: np.ndarray, detections: list) -> np.ndarray:
    """
    Draw bounding boxes, labels, confidence scores, and activity labels
    on a BGR numpy image.

    Parameters
    ----------
    image : BGR numpy array
    detections : list of dicts with keys:
        class_id, class_name, confidence, bbox [x1,y1,x2,y2],
        activity (optional), track_id (optional)

    Returns
    -------
    Annotated BGR numpy array
    """
    img = image.copy()
    h, w = img.shape[:2]

    for det in detections:
        cls_id = det.get("class_id", 0)
        cls_name = det.get("class_name", "?")
        conf = det.get("confidence", 0.0)
        x1, y1, x2, y2 = [int(v) for v in det["bbox"]]
        activity = det.get("activity", "")
        track_id = det.get("track_id", None)

        color = _color_for(cls_id)

        # Draw bounding box (thick)
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)

        # Build label text
        label_parts = [f"{cls_name} {conf:.0%}"]
        if track_id is not None and track_id >= 0:
            label_parts[0] = f"#{track_id} {cls_name} {conf:.0%}"
        if activity:
            label_parts.append(activity)

        # Render each label line
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = max(0.4, min(0.65, w / 1280))
        thickness = 1

        for i, text in enumerate(label_parts):
            (tw, th), baseline = cv2.getTextSize(text, font, font_scale, thickness)
            label_y = max(y1 - 4 - i * (th + 4), th + 4)

            # Semi-transparent label background
            overlay = img.copy()
            cv2.rectangle(
                overlay,
                (x1, label_y - th - baseline - 2),
                (x1 + tw + 4, label_y + baseline - 2),
                color,
                cv2.FILLED,
            )
            cv2.addWeighted(overlay, 0.7, img, 0.3, 0, img)

            # Text
            text_color = (0, 0, 0) if sum(color) > 380 else (255, 255, 255)
            cv2.putText(
                img, text,
                (x1 + 2, label_y - baseline),
                font, font_scale, text_color, thickness, cv2.LINE_AA,
            )

    # Draw frame-level detection count
    count_text = f"Detections: {len(detections)}"
    cv2.putText(img, count_text, (10, 28), cv2.FONT_HERSHEY_SIMPLEX,
                0.7, (0, 255, 0), 2, cv2.LINE_AA)

    return img


def encode_image_to_base64(image: np.ndarray, quality: int = 85) -> str:
    """Encode a BGR numpy image to a JPEG base64 string."""
    encode_params = [cv2.IMWRITE_JPEG_QUALITY, quality]
    _, buffer = cv2.imencode(".jpg", image, encode_params)
    return base64.b64encode(buffer).decode("utf-8")


def decode_base64_to_image(b64_string: str) -> np.ndarray:
    """Decode a base64 JPEG string to a BGR numpy array."""
    # Strip data URI prefix if present
    if "," in b64_string:
        b64_string = b64_string.split(",", 1)[1]
    img_data = base64.b64decode(b64_string)
    np_arr = np.frombuffer(img_data, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
