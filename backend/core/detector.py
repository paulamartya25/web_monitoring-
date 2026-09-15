import cv2
import numpy as np
import logging
from ultralytics import YOLO
from core.config import settings

logger = logging.getLogger(__name__)

# Color palette: 20 distinct BGR colors for different classes
CLASS_COLORS = [
    (255, 56, 56), (255, 157, 151), (255, 112, 31), (255, 178, 29),
    (207, 210, 49), (72, 249, 10), (146, 204, 23), (61, 219, 134),
    (26, 147, 52), (0, 212, 187), (44, 153, 168), (0, 194, 255),
    (52, 69, 147), (100, 115, 255), (0, 24, 236), (132, 56, 255),
    (82, 0, 133), (203, 56, 255), (255, 149, 200), (255, 55, 199),
]


def get_class_color(class_id: int) -> tuple:
    return CLASS_COLORS[class_id % len(CLASS_COLORS)]


class YOLODetector:
    def __init__(self, model_size: str = "yolov8n"):
        self.model_size = model_size
        self.model = YOLO(f"{model_size}.pt")
        self.class_names = self.model.names
        logger.info(f"Loaded YOLOv8 model: {model_size} | Classes: {len(self.class_names)}")

    def detect_image(
        self,
        image: np.ndarray,
        conf: float = None,
        iou: float = None,
    ) -> dict:
        """
        Run YOLOv8 inference on a numpy BGR image.
        Returns dict with 'detections' list and 'annotated_image' (BGR ndarray).
        """
        conf = conf or settings.CONFIDENCE_THRESHOLD
        iou = iou or settings.IOU_THRESHOLD

        results = self.model.predict(
            source=image,
            conf=conf,
            iou=iou,
            max_det=settings.MAX_DETECTIONS,
            verbose=False,
        )

        detections = []
        result = results[0]

        for box in result.boxes:
            cls_id = int(box.cls[0])
            cls_name = self.class_names[cls_id]
            confidence = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()

            detections.append({
                "class_id": cls_id,
                "class_name": cls_name,
                "confidence": round(confidence, 4),
                "bbox": [round(x1), round(y1), round(x2), round(y2)],
            })

        return {
            "detections": detections,
            "annotated_image": image.copy(),  # raw; drawing is done in drawing.py
        }

    def reload(self, model_size: str):
        """Hot-swap the model at runtime."""
        self.model_size = model_size
        self.model = YOLO(f"{model_size}.pt")
        self.class_names = self.model.names
        logger.info(f"Reloaded model: {model_size}")

    def get_model_info(self) -> dict:
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
        return {
            "model_size": self.model_size,
            "num_classes": len(self.class_names),
            "class_names": list(self.class_names.values()),
            "device": device,
        }
