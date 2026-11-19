"""
core/homography_calibrator.py
==============================
Camera calibration for real-world speed estimation.

Supports two modes:
  1. Full homography (4-point perspective transform) — most accurate
     The user maps 4 pixel points to 4 known world coordinates (metres).
     cv2.findHomography() builds the H matrix.
     Use when overhead view is available (drone / ceiling-mounted CCTV).

  2. Simple scale (1-reference distance) — practical fallback
     The user measures one known feature (e.g. lane width = 3.7 m)
     and counts its pixel span. Scale = metres / pixels.

Speed computation (both modes):
  d_world = ||world(centroid_t) - world(centroid_{t-1})||   [metres]
  speed   = d_world × fps × 3.6                             [km/h]

Without calibration the system falls back to the old empirical formula
(displacement_px × 0.12 × 30) marked explicitly as uncalibrated.
"""

import logging
import numpy as np
import cv2

logger = logging.getLogger(__name__)


class HomographyCalibrator:
    """Stateful calibrator.  One instance lives in app.state.calibrator."""

    def __init__(self):
        self.H: np.ndarray | None = None          # 3×3 perspective matrix
        self.meters_per_pixel: float | None = None # simple-scale fallback
        self.calibrated: bool = False
        self.mode: str = "none"                    # "none" | "homography" | "simple"
        self.pixel_points: list = []               # 4 × [x, y]  (stored for display)
        self.world_points: list  = []              # 4 × [X, Y] in metres

    # ── Calibration setters ───────────────────────────────────────────────
    def compute_homography(
        self,
        pixel_pts: list[list[float]],
        world_pts: list[list[float]],
    ) -> bool:
        """
        Build H from 4 pixel↔world correspondences.

        pixel_pts: [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]  image pixel coords
        world_pts: [[X1,Y1],[X2,Y2],[X3,Y3],[X4,Y4]]  real-world metres
        """
        if len(pixel_pts) != 4 or len(world_pts) != 4:
            logger.error("Homography needs exactly 4 point pairs.")
            return False
        try:
            src = np.float32(pixel_pts)
            dst = np.float32(world_pts)
            H, mask = cv2.findHomography(src, dst, cv2.RANSAC, 5.0)
            if H is None:
                logger.error("cv2.findHomography returned None.")
                return False
            self.H = H
            self.pixel_points = pixel_pts
            self.world_points = world_pts
            self.meters_per_pixel = None
            self.calibrated = True
            self.mode = "homography"
            logger.info("Homography calibration set.\n%s", H)
            return True
        except Exception as exc:
            logger.error("Homography error: %s", exc)
            return False

    def set_simple_scale(self, pixels: float, real_metres: float) -> bool:
        """
        Simple 1-reference calibration.
        pixels      — pixel span of a known feature (e.g. lane width in px)
        real_metres — real-world size of that feature in metres
        """
        if pixels <= 0 or real_metres <= 0:
            logger.error("Invalid scale parameters: pixels=%s, metres=%s", pixels, real_metres)
            return False
        self.meters_per_pixel = real_metres / pixels
        self.H = None
        self.calibrated = True
        self.mode = "simple"
        logger.info("Simple-scale calibration: %.5f m/px", self.meters_per_pixel)
        return True

    # ── Coordinate transforms ─────────────────────────────────────────────
    def pixel_to_world(self, px: float, py: float) -> tuple[float, float] | None:
        """Return (X_metres, Y_metres) for a pixel (px, py), or None."""
        if not self.calibrated:
            return None
        if self.H is not None:
            pt = np.float32([[[px, py]]])
            out = cv2.perspectiveTransform(pt, self.H)
            return float(out[0][0][0]), float(out[0][0][1])
        if self.meters_per_pixel is not None:
            return float(px * self.meters_per_pixel), float(py * self.meters_per_pixel)
        return None

    def compute_speed_kmh(
        self,
        pos_prev: list[float],
        pos_curr: list[float],
        fps: float,
    ) -> float | None:
        """
        Calibrated speed (km/h) from two consecutive centroid positions (pixels).
        Returns None if not calibrated or fps == 0.
        """
        if not self.calibrated or fps <= 0:
            return None
        w1 = self.pixel_to_world(pos_prev[0], pos_prev[1])
        w2 = self.pixel_to_world(pos_curr[0], pos_curr[1])
        if w1 is None or w2 is None:
            return None
        dist_m    = float(np.linalg.norm(np.array(w2) - np.array(w1)))
        speed_kmh = dist_m * fps * 3.6
        return round(min(speed_kmh, 300.0), 1)

    # ── Helpers ───────────────────────────────────────────────────────────
    def reset(self):
        self.H = None
        self.meters_per_pixel = None
        self.calibrated = False
        self.mode = "none"
        self.pixel_points = []
        self.world_points = []
        logger.info("Calibration reset.")

    def status(self) -> dict:
        return {
            "calibrated":        self.calibrated,
            "mode":              self.mode,
            "scale_m_per_px":    self.meters_per_pixel,   # alias used by frontend
            "meters_per_pixel":  self.meters_per_pixel,
            "pixel_points":      self.pixel_points,
            "world_points":      self.world_points,
        }


# ── Helper: apply calibrated speeds to a described-detections list ────────
def apply_calibrated_speeds(
    described: list[dict],
    calibrator: HomographyCalibrator,
    fps: float,
    centroid_history: dict,     # track_id → list of recent [cx, cy]
) -> list[dict]:
    """
    Post-process described detections: replace estimated_speed_kmh with
    the homography-calibrated value where possible.

    centroid_history is maintained by the caller (stream.py).
    """
    if not calibrator.calibrated or fps <= 0:
        return described

    result = []
    for det in described:
        det = det.copy()
        tid = det.get("track_id", -1)
        cx, cy = det.get("centroid", [0, 0])

        if tid >= 0:
            history = centroid_history.setdefault(tid, [])
            history.append([cx, cy])
            if len(history) > 30:
                history.pop(0)

            if len(history) >= 2:
                speed = calibrator.compute_speed_kmh(history[-2], history[-1], fps)
                if speed is not None:
                    det["estimated_speed_kmh"] = speed
                    det["speed_calibrated"] = True

        result.append(det)
    return result
