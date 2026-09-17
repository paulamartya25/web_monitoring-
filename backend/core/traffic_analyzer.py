import numpy as np
from collections import deque, defaultdict

# ── Road class groups ──────────────────────────────────────────────────────
VEHICLE_CLASSES   = {"car", "truck", "bus", "motorcycle", "bicycle", "train"}
PEDESTRIAN_CLASSES = {"person"}
CYCLIST_CLASSES   = {"bicycle"}

# Displacement thresholds (pixels/frame at 640px wide frame)
STOPPED_THRESH   = 3
SLOW_THRESH      = 15
FAST_THRESH      = 40   # above this → "Speeding"

# Frames an object must be stopped before "Illegally Parked"
PARKED_FRAMES = 60      # ~2 seconds at 30fps


class TrafficActivityDescriptor:
    """
    Road/traffic-focused activity descriptor.
    Replaces the generic ActivityDescriptor for traffic CCTV use case.
    """

    def __init__(self):
        self.track_history: dict[int, deque] = {}       # track_id → centroids
        self.stopped_frames: dict[int, int] = {}         # track_id → consecutive stopped frames
        self.zone_config = None                           # set externally if zones defined

    def set_zones(self, zone_config):
        self.zone_config = zone_config

    # ── Public API ───────────────────────────────────────────────────────
    def describe(self, tracked_detections: list) -> list:
        """
        Add 'activity', 'displacement_px', 'estimated_speed_kmh' to each detection.
        """
        result = []
        for i, det in enumerate(tracked_detections):
            det = det.copy()
            track_id   = det.get("track_id", -1)
            centroid   = det.get("centroid", [0, 0])
            cls_name   = det.get("class_name", "object").lower()

            # Update history
            if track_id not in self.track_history:
                self.track_history[track_id] = deque(maxlen=30)
            self.track_history[track_id].append(centroid)

            displacement = self._displacement(track_id)
            det["displacement_px"] = round(displacement, 2)

            # Speed estimate only for traffic classes (not pedestrians, unknown objects)
            # Calibration: 1px ≈ 0.1 km/h at typical CCTV height. Cap at 200 km/h (sanity check).
            raw_speed = displacement * 0.12 * 30  # ×30fps
            if cls_name in VEHICLE_CLASSES:
                det["estimated_speed_kmh"] = round(min(raw_speed, 200.0), 1)
            else:
                det["estimated_speed_kmh"] = 0.0  # No speed shown for people/unknown

            # Assign activity label
            activity = self._label(cls_name, track_id, displacement, i, tracked_detections)
            det["activity"] = activity

            # Alert flag
            det["alert"] = self._is_alert(activity)

            result.append(det)

        return result

    def reset(self):
        self.track_history.clear()
        self.stopped_frames.clear()

    # ── Internal helpers ─────────────────────────────────────────────────
    def _displacement(self, track_id: int) -> float:
        history = self.track_history.get(track_id)
        if not history or len(history) < 2:
            return 0.0
        pts = list(history)
        deltas = [np.linalg.norm(np.array(pts[i]) - np.array(pts[i-1]))
                  for i in range(1, len(pts))]
        return float(np.mean(deltas)) if deltas else 0.0

    def _label(self, cls_name: str, track_id: int, disp: float,
               idx: int, all_dets: list) -> str:

        # ── Pedestrian ───────────────────────────────────────────────
        if cls_name in PEDESTRIAN_CLASSES:
            if disp < STOPPED_THRESH:
                return "🧍 Standing"
            elif disp < 20:
                return "🚶 Walking"
            else:
                return "🏃 Running"

        # ── Cyclist ──────────────────────────────────────────────────
        if cls_name == "bicycle":
            if disp < STOPPED_THRESH:
                return "🚲 Stopped"
            return "🚴 Cycling"

        # ── Vehicles ─────────────────────────────────────────────────
        if cls_name in VEHICLE_CLASSES:
            # Track consecutive stopped frames
            if disp < STOPPED_THRESH:
                self.stopped_frames[track_id] = self.stopped_frames.get(track_id, 0) + 1
            else:
                self.stopped_frames[track_id] = 0

            stopped_count = self.stopped_frames.get(track_id, 0)

            if stopped_count > PARKED_FRAMES:
                return "🚨 Illegally Parked"
            elif disp < STOPPED_THRESH:
                return "🔴 Stopped"
            elif disp < SLOW_THRESH:
                return "🟡 Moving slowly"
            elif disp < FAST_THRESH:
                return "🟢 Moving"
            else:
                return "🚨 Speeding"

        # ── Default ──────────────────────────────────────────────────
        return "Detected" if disp < STOPPED_THRESH else "Moving"

    def _is_alert(self, activity: str) -> bool:
        """Return True if this activity should trigger an alert."""
        alert_keywords = {"🚨", "⚠️", "Jaywalking", "Speeding", "Illegally"}
        return any(kw in activity for kw in alert_keywords)
