"""
core/activity.py
================
Enriched rule-based activity / behaviour descriptor.

Activities per class
--------------------
Persons  : Stationary | Loitering | Walking | Jogging | Running | Fleeing
Vehicles : Parked | Idling | Moving slowly | Moving | Speeding
Any      : + "· Interacting" suffix when near another object
           + "· Restricted zone" suffix when inside a configured zone

Loitering
---------
A person is Loitering when they have been Stationary or Walking slowly
in roughly the same spatial area for > LOITER_SECONDS seconds.
Uses a rolling centroid window to check spatial spread.
"""

import numpy as np
from collections import deque


# ── Motion thresholds (px / frame at ~10 FPS) ───────────────────────────────
THRESH_STATIONARY = 5
THRESH_WALK       = 22
THRESH_JOG        = 50
THRESH_RUN        = 80    # above this → Running / Fleeing

# ── Loitering ────────────────────────────────────────────────────────────────
LOITER_FRAMES      = 60   # ~6 s at 10 FPS before "loitering" kicks in
LOITER_SPREAD_PX   = 80   # max spatial spread of centroid cloud to count as loitering

# ── Proximity (interacting) ───────────────────────────────────────────────────
PROXIMITY_THRESH   = 90   # px — objects closer than this are "interacting"

# ── History window ────────────────────────────────────────────────────────────
HISTORY_LEN        = 40   # frames of centroid history kept per track

VEHICLE_CLASSES = {
    "car", "truck", "bus", "motorcycle", "bicycle",
    "van", "tricycle", "awning-tricycle", "motor",
}
PERSON_CLASSES = {"person", "pedestrian", "people"}


class ActivityDescriptor:
    """
    Enriched activity descriptor. Call describe() each frame.
    Thread-safe as long as only one thread calls describe() at a time.
    """

    def __init__(self):
        # track_id → deque of (cx, cy)
        self.track_history:    dict[int, deque] = {}
        # track_id → consecutive slow/stationary frame count (for loitering)
        self.slow_frames:      dict[int, int]   = {}
        # track_id → reference centroid when slow_frames started (for spread)
        self.loiter_start_pos: dict[int, tuple] = {}

    # ── Public API ────────────────────────────────────────────────────────────
    def describe(self, tracked_detections: list) -> list:
        """
        Adds 'activity', 'displacement_px', 'loitering', 'centroid'
        fields to each detection dict.
        """
        result = []
        for i, det in enumerate(tracked_detections):
            det = det.copy()
            tid       = det.get("track_id", -1)
            centroid  = det.get("centroid", [0, 0])
            cls       = det.get("class_name", "object").lower()

            # Update centroid history
            if tid not in self.track_history:
                self.track_history[tid] = deque(maxlen=HISTORY_LEN)
            self.track_history[tid].append(tuple(centroid))

            # Displacement
            displacement = self._displacement(tid)

            # Activity label
            activity = self._classify(displacement, cls)

            # Loitering check (persons only)
            is_loitering = False
            if cls in PERSON_CLASSES and tid >= 0:
                is_loitering = self._check_loitering(tid, displacement, centroid)
                if is_loitering:
                    activity = "⚠️ Loitering"

            # Proximity / interacting
            if self._near_another(i, tracked_detections):
                activity += " · Interacting"

            det["activity"]        = activity
            det["displacement_px"] = round(displacement, 2)
            det["loitering"]       = is_loitering
            result.append(det)

        # Clean up stale track IDs
        active = {d.get("track_id", -1) for d in tracked_detections}
        for stale in list(self.slow_frames.keys()):
            if stale not in active:
                del self.slow_frames[stale]
                self.loiter_start_pos.pop(stale, None)

        return result

    def reset(self):
        self.track_history.clear()
        self.slow_frames.clear()
        self.loiter_start_pos.clear()

    # ── Motion classification ─────────────────────────────────────────────────
    def _classify(self, displacement: float, cls: str) -> str:
        if cls in VEHICLE_CLASSES:
            if displacement < THRESH_STATIONARY:
                return "Parked"
            elif displacement < 10:
                return "Idling"
            elif displacement < THRESH_WALK:
                return "Moving slowly"
            elif displacement < THRESH_RUN:
                return "Moving"
            else:
                return "Speeding 🚨"

        # Persons / unknown
        if displacement < THRESH_STATIONARY:
            return "Stationary"
        elif displacement < THRESH_WALK:
            return "Walking"
        elif displacement < THRESH_JOG:
            return "Jogging"
        elif displacement < THRESH_RUN:
            return "Running"
        else:
            return "Fleeing 🚨"

    # ── Loitering detection ───────────────────────────────────────────────────
    def _check_loitering(self, tid: int, displacement: float, centroid) -> bool:
        """
        Returns True if the person has been moving slowly / stationary
        in a small area for >= LOITER_FRAMES consecutive frames.
        """
        is_slow = displacement < THRESH_WALK

        if is_slow:
            self.slow_frames[tid] = self.slow_frames.get(tid, 0) + 1
            if tid not in self.loiter_start_pos:
                self.loiter_start_pos[tid] = tuple(centroid)
        else:
            # Moving briskly — reset loiter counter
            self.slow_frames[tid] = 0
            self.loiter_start_pos.pop(tid, None)
            return False

        if self.slow_frames[tid] < LOITER_FRAMES:
            return False

        # Check spatial spread over history window
        history = list(self.track_history.get(tid, []))
        if len(history) < 10:
            return False
        pts = np.array(history[-LOITER_FRAMES:], dtype=float)
        spread = float(pts.std(axis=0).max())   # max std across x or y
        return spread < LOITER_SPREAD_PX

    # ── Helpers ───────────────────────────────────────────────────────────────
    def _displacement(self, tid: int) -> float:
        history = self.track_history.get(tid)
        if not history or len(history) < 2:
            return 0.0
        pts = list(history)
        disps = [
            np.linalg.norm(np.array(pts[i]) - np.array(pts[i - 1]))
            for i in range(1, len(pts))
        ]
        return float(np.mean(disps))

    def _near_another(self, idx: int, detections: list) -> bool:
        if len(detections) < 2:
            return False
        c1 = np.array(detections[idx].get("centroid", [0, 0]))
        for j, other in enumerate(detections):
            if j == idx:
                continue
            c2 = np.array(other.get("centroid", [0, 0]))
            if np.linalg.norm(c1 - c2) < PROXIMITY_THRESH:
                return True
        return False
