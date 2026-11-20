"""
core/lighting_classifier.py
============================
Analyses a BGR numpy image and returns the lighting condition +
recommended YOLOv8 model key.

Lighting conditions
-------------------
  night   → mean brightness < 60   → yolov8s_visdrone_best (trained on low-light aerial)
             OR COCO model if ground-level is detected
  dusk    → mean brightness 60-120 → yolov8s (COCO, general scenes)
  day     → mean brightness > 120  → yolov8s_visdrone_best OR yolov8n (COCO)

Perspective detection (aerial vs ground-level)
-----------------------------------------------
  Uses horizon heuristic: if the brightest region is in the top 1/3 of the
  image, it's likely a sky → ground-level camera.
  Otherwise assume aerial / overhead CCTV.
"""

import cv2
import numpy as np


LIGHTING_THRESHOLDS = {
    "night": 60,    # mean pixel value below this → night
    "dusk":  120,   # between night and this → dusk/golden-hour
    # above dusk threshold → day
}

# Model recommendation matrix
# (lighting, perspective) -> model_size key
MODEL_MATRIX = {
    ("night",  "aerial"):      "yolov8s_visdrone_best",
    ("night",  "ground"):      "yolov8s",          # COCO small — better on ground night
    ("dusk",   "aerial"):      "yolov8s_visdrone_best",
    ("dusk",   "ground"):      "yolov8s",
    ("day",    "aerial"):      "yolov8s_visdrone_best",
    ("day",    "ground"):      "yolov8s",
}


def classify_lighting(image: np.ndarray) -> dict:
    """
    Parameters
    ----------
    image : BGR numpy array (as returned by cv2.imdecode)

    Returns
    -------
    dict with keys:
        lighting     : "night" | "dusk" | "day"
        perspective  : "aerial" | "ground"
        mean_brightness : float  (0-255)
        recommended_model : str  (model_size key)
        reason : str  (human-readable explanation for the UI)
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    mean_brightness = float(gray.mean())

    # ── Lighting condition ────────────────────────────────────────────
    if mean_brightness < LIGHTING_THRESHOLDS["night"]:
        lighting = "night"
    elif mean_brightness < LIGHTING_THRESHOLDS["dusk"]:
        lighting = "dusk"
    else:
        lighting = "day"

    # ── Perspective detection (sky heuristic) ─────────────────────────
    h, w = gray.shape
    top_third   = gray[:h // 3, :]
    bottom_half = gray[h // 2:, :]
    # Ground cameras: sky is bright (top), ground is darker (bottom)
    # Aerial cameras: even brightness distribution, no strong sky
    sky_brightness    = float(top_third.mean())
    ground_brightness = float(bottom_half.mean())

    # Variance in top third is higher for sky (clouds, gradients)
    top_variance = float(top_third.var())

    if sky_brightness > ground_brightness * 1.3 or top_variance > 1200:
        perspective = "ground"
    else:
        perspective = "aerial"

    recommended_model = MODEL_MATRIX.get((lighting, perspective), "yolov8s")

    # ── Reason string for UI display ─────────────────────────────────
    emoji = {"night": "🌙", "dusk": "🌅", "day": "☀️"}[lighting]
    cam   = {"aerial": "📡 aerial", "ground": "📷 ground-level"}[perspective]
    reason = (
        f"{emoji} {lighting.capitalize()} · {cam} camera detected "
        f"(brightness={mean_brightness:.0f}) → using {recommended_model}"
    )

    return {
        "lighting":           lighting,
        "perspective":        perspective,
        "mean_brightness":    round(mean_brightness, 1),
        "recommended_model":  recommended_model,
        "reason":             reason,
    }
