"""
core/anomaly_detector.py
========================
Rule-based anomaly detector for traffic surveillance.

Detects four event types from tracked + described detections:
  1. Sudden stop     — vehicle was moving, abruptly stopped
  2. Near-miss       — two moving tracked objects come within threshold distance
  3. Crowd formation — unusual pedestrian density in a region
  4. Abandoned obj   — any object stationary for > ABANDONED_SECONDS at 10 FPS

Each event carries: type, track_id, class_name, message, severity, bbox.
Severity levels: "high" | "medium" | "low"
"""

import numpy as np
from collections import deque
import logging

logger = logging.getLogger(__name__)

# ── Class groups (VisDrone + COCO labels) ──────────────────────────────────
VEHICLE_CLASSES = {
    "car", "truck", "bus", "motorcycle", "bicycle", "van",
    "tricycle", "awning-tricycle", "motor",
}
PEDESTRIAN_CLASSES = {"person", "pedestrian", "people"}

# ── Thresholds ─────────────────────────────────────────────────────────────
MOVING_DISP_THRESH   = 8    # px/frame  — object is "moving"
STOPPED_DISP_THRESH  = 3    # px/frame  — object is "stopped"

SUDDEN_STOP_PREV     = 5    # must have been moving for this many frames
SUDDEN_STOP_CURR     = 3    # then stopped for this many frames

NEAR_MISS_DIST_PX    = 35   # centroid distance (px) → near-miss
NEAR_MISS_MIN_SPEED  = 6    # both objects must have displacement > this

CROWD_MIN_PEOPLE     = 4    # min pedestrians in a cluster
CROWD_RADIUS_PX      = 160  # cluster radius (px)

ABANDONED_FRAMES     = 90   # ~9 s at 10 FPS → flag as abandoned

# Cooldown: suppress repeated events for the same track_id
COOLDOWN_FRAMES = 30


class AnomalyDetector:
    """
    Stateful anomaly detector.  Call detect() on each frame with the
    post-described detection list.  Returns a list of event dicts for
    that frame.
    """

    def __init__(self):
        # Per-track displacement history (last 20 frames)
        self.disp_history: dict[int, deque] = {}
        # Per-track consecutive stopped frames (for abandoned detection)
        self.stationary_frames: dict[int, int] = {}
        # Cooldown counter per (track_id, event_type) to avoid spam
        self.cooldown: dict[tuple, int] = {}

    # ── Public API ─────────────────────────────────────────────────────────
    def detect(self, described: list) -> list[dict]:
        """
        Run all anomaly detectors on one frame's described detections.
        Returns list of anomaly event dicts.
        """
        # 1. Update per-track histories
        active_tids = set()
        for det in described:
            tid = det.get("track_id", -1)
            if tid < 0:
                continue
            active_tids.add(tid)
            disp = det.get("displacement_px", 0.0)

            if tid not in self.disp_history:
                self.disp_history[tid] = deque(maxlen=20)
            self.disp_history[tid].append(disp)

        # Tick down cooldowns
        for key in list(self.cooldown.keys()):
            self.cooldown[key] -= 1
            if self.cooldown[key] <= 0:
                del self.cooldown[key]

        # Clean up stale track IDs
        stale = set(self.stationary_frames.keys()) - active_tids
        for tid in stale:
            del self.stationary_frames[tid]

        # 2. Run detectors
        events: list[dict] = []
        events += self._sudden_stops(described)
        events += self._near_misses(described)
        events += self._crowd_formation(described)
        events += self._abandoned_objects(described)

        return events

    def reset(self):
        self.disp_history.clear()
        self.stationary_frames.clear()
        self.cooldown.clear()

    # ── Detectors ──────────────────────────────────────────────────────────
    def _sudden_stops(self, detections: list) -> list[dict]:
        events = []
        for det in detections:
            tid = det.get("track_id", -1)
            cls = det.get("class_name", "").lower()
            if tid < 0 or cls not in VEHICLE_CLASSES:
                continue
            if self._on_cooldown(tid, "sudden_stop"):
                continue

            history = list(self.disp_history.get(tid, []))
            needed = SUDDEN_STOP_PREV + SUDDEN_STOP_CURR
            if len(history) < needed:
                continue

            prev   = history[-(SUDDEN_STOP_PREV + SUDDEN_STOP_CURR):-SUDDEN_STOP_CURR]
            recent = history[-SUDDEN_STOP_CURR:]

            if (all(d > MOVING_DISP_THRESH for d in prev) and
                    all(d < STOPPED_DISP_THRESH for d in recent)):
                events.append(self._event(
                    "sudden_stop", tid, cls,
                    f"⚠️ Sudden stop: {cls} #{tid}",
                    "medium", det.get("bbox", [0, 0, 0, 0]),
                ))
                self._set_cooldown(tid, "sudden_stop")

        return events

    def _near_misses(self, detections: list) -> list[dict]:
        events = []
        moving = [
            d for d in detections
            if d.get("displacement_px", 0) > NEAR_MISS_MIN_SPEED
            and d.get("track_id", -1) >= 0
        ]

        for i in range(len(moving)):
            for j in range(i + 1, len(moving)):
                a, b = moving[i], moving[j]
                ca = np.array(a.get("centroid", [0, 0]))
                cb = np.array(b.get("centroid", [0, 0]))
                dist = float(np.linalg.norm(ca - cb))

                if dist < NEAR_MISS_DIST_PX:
                    tid = f"{a['track_id']}-{b['track_id']}"
                    if not self._on_cooldown(tid, "near_miss"):
                        events.append(self._event(
                            "near_miss", tid,
                            f"{a['class_name']}/{b['class_name']}",
                            f"🚨 Near-miss: {a['class_name']} #{a['track_id']} ↔ "
                            f"{b['class_name']} #{b['track_id']} ({dist:.0f} px)",
                            "high", a.get("bbox", [0, 0, 0, 0]),
                        ))
                        self._set_cooldown(tid, "near_miss")

        return events

    def _crowd_formation(self, detections: list) -> list[dict]:
        events = []
        peds = [
            d for d in detections
            if d.get("class_name", "").lower() in PEDESTRIAN_CLASSES
            and d.get("track_id", -1) >= 0
        ]
        if len(peds) < CROWD_MIN_PEOPLE:
            return events

        centroids = np.array([d.get("centroid", [0, 0]) for d in peds], dtype=float)
        visited: set[int] = set()

        for i, c in enumerate(centroids):
            if i in visited:
                continue
            dists = np.linalg.norm(centroids - c, axis=1)
            cluster_idx = np.where(dists < CROWD_RADIUS_PX)[0]

            if len(cluster_idx) >= CROWD_MIN_PEOPLE:
                for idx in cluster_idx:
                    visited.add(int(idx))
                cluster_pts = centroids[cluster_idx]
                x1 = int(cluster_pts[:, 0].min()) - 20
                y1 = int(cluster_pts[:, 1].min()) - 20
                x2 = int(cluster_pts[:, 0].max()) + 20
                y2 = int(cluster_pts[:, 1].max()) + 20

                # Crowd cooldown keyed on cluster centroid (rounded)
                ck = (int(c[0] // 100), int(c[1] // 100))
                if not self._on_cooldown(ck, "crowd"):
                    events.append(self._event(
                        "crowd_formation", -1, "pedestrians",
                        f"⚠️ Crowd: {len(cluster_idx)} people clustered within "
                        f"{CROWD_RADIUS_PX} px",
                        "medium", [x1, y1, x2, y2],
                    ))
                    self._set_cooldown(ck, "crowd")

        return events

    def _abandoned_objects(self, detections: list) -> list[dict]:
        events = []
        for det in detections:
            tid = det.get("track_id", -1)
            cls = det.get("class_name", "").lower()
            if tid < 0:
                continue

            disp = det.get("displacement_px", 0.0)
            if disp < STOPPED_DISP_THRESH:
                self.stationary_frames[tid] = self.stationary_frames.get(tid, 0) + 1
            else:
                self.stationary_frames[tid] = 0

            frames = self.stationary_frames.get(tid, 0)
            if frames >= ABANDONED_FRAMES and not self._on_cooldown(tid, "abandoned"):
                secs = frames // 10
                events.append(self._event(
                    "abandoned_object", tid, cls,
                    f"⚠️ Abandoned {cls} #{tid} — stationary >{secs}s",
                    "medium", det.get("bbox", [0, 0, 0, 0]),
                ))
                self._set_cooldown(tid, "abandoned")

        return events

    # ── Helpers ────────────────────────────────────────────────────────────
    @staticmethod
    def _event(
        type_: str, track_id, class_name: str,
        message: str, severity: str, bbox: list,
    ) -> dict:
        return {
            "type": type_,
            "track_id": track_id,
            "class_name": class_name,
            "message": message,
            "severity": severity,
            "bbox": bbox,
        }

    def _on_cooldown(self, key, event_type: str) -> bool:
        return self.cooldown.get((key, event_type), 0) > 0

    def _set_cooldown(self, key, event_type: str):
        self.cooldown[(key, event_type)] = COOLDOWN_FRAMES
