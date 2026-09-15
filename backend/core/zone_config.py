import numpy as np
from collections import defaultdict, deque


class VehicleCounter:
    """
    Counts vehicles/pedestrians crossing a virtual counting line.

    Usage:
        counter = VehicleCounter(line_y=320)   # horizontal line at y=320
        counts  = counter.update(tracked_detections)
    """

    def __init__(self, line_y: int = None, line_x: int = None):
        """
        line_y : y-coordinate for a horizontal counting line
        line_x : x-coordinate for a vertical counting line
        Set one or the other (or both).
        """
        self.line_y = line_y
        self.line_x = line_x
        self.prev_centroids: dict[int, list] = {}    # track_id → last centroid
        self.counts: dict[str, int] = defaultdict(int)  # class_name → count
        self.crossed_ids: set = set()                 # IDs that already crossed

    def update(self, tracked_detections: list) -> dict:
        """
        Returns dict of counts per class that crossed the line this session.
        """
        for det in tracked_detections:
            tid  = det.get("track_id", -1)
            cent = det.get("centroid", [0, 0])
            cls  = det.get("class_name", "object")

            if tid < 0 or tid in self.crossed_ids:
                self.prev_centroids[tid] = cent
                continue

            prev = self.prev_centroids.get(tid)
            if prev:
                crossed = False
                # Horizontal line crossing
                if self.line_y:
                    if (prev[1] < self.line_y <= cent[1]) or (cent[1] < self.line_y <= prev[1]):
                        crossed = True
                # Vertical line crossing
                if self.line_x:
                    if (prev[0] < self.line_x <= cent[0]) or (cent[0] < self.line_x <= prev[0]):
                        crossed = True

                if crossed:
                    self.counts[cls] += 1
                    self.crossed_ids.add(tid)

            self.prev_centroids[tid] = cent

        return dict(self.counts)

    def reset_counts(self):
        self.counts.clear()
        self.crossed_ids.clear()
        self.prev_centroids.clear()

    @property
    def total(self) -> int:
        return sum(self.counts.values())


class ZoneMonitor:
    """
    Monitors rectangular alert zones.
    Fires an alert when a specific object class enters a zone.

    zones: list of dicts:
        {
          'name':    'Crosswalk Zone',
          'bbox':    [x1, y1, x2, y2],   # pixel coordinates
          'watch':   ['person'],           # classes to watch
          'alert':   '⚠️ Pedestrian in road'
        }
    """

    def __init__(self, zones: list = None):
        self.zones = zones or []

    def check(self, tracked_detections: list) -> list:
        """
        Returns list of active alert strings for this frame.
        """
        alerts = []
        for det in tracked_detections:
            cx, cy = det.get("centroid", [0, 0])
            cls    = det.get("class_name", "").lower()
            tid    = det.get("track_id", -1)

            for zone in self.zones:
                x1, y1, x2, y2 = zone["bbox"]
                if cls in zone.get("watch", []) and x1 <= cx <= x2 and y1 <= cy <= y2:
                    msg = f"[ID#{tid}] {det['class_name']}: {zone['alert']} in '{zone['name']}'"
                    alerts.append(msg)

        return alerts


class TrafficStats:
    """
    Rolling statistics for the live stream dashboard.
    Tracks per-class counts, average speed, and alerts over a time window.
    """

    def __init__(self, window_frames: int = 150):   # ~5 sec at 30fps
        self.window = window_frames
        self.history: deque = deque(maxlen=window_frames)

    def update(self, detections: list, alerts: list):
        self.history.append({
            "detections": detections,
            "alerts": alerts,
        })

    def summary(self) -> dict:
        all_dets = [d for frame in self.history for d in frame["detections"]]
        all_alerts = [a for frame in self.history for a in frame["alerts"]]

        class_counts: dict[str, int] = defaultdict(int)
        speeds: list[float] = []

        for d in all_dets:
            class_counts[d["class_name"]] += 1
            spd = d.get("estimated_speed_kmh", 0)
            if spd > 0:
                speeds.append(spd)

        return {
            "class_counts": dict(class_counts),
            "total_objects": len(all_dets),
            "avg_speed_kmh": round(float(np.mean(speeds)), 1) if speeds else 0.0,
            "max_speed_kmh": round(float(np.max(speeds)), 1) if speeds else 0.0,
            "recent_alerts": list(set(all_alerts))[-10:],   # last 10 unique alerts
            "alert_count": len(all_alerts),
        }
