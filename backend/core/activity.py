import numpy as np
from collections import deque


# Pixels per frame displacement thresholds
THRESH_STATIONARY = 5
THRESH_WALKING = 30
THRESH_RUNNING = 60

# Proximity threshold (pixels) for "interacting"
PROXIMITY_THRESH = 80


class ActivityDescriptor:
    """
    Rule-based activity/behavior description engine.
    Uses tracked centroid history to determine per-object activity labels.
    """

    def __init__(self):
        # track_id -> deque of (cx, cy) centroids
        self.track_history: dict[int, deque] = {}

    def _get_displacement(self, track_id: int) -> float:
        """Return mean displacement (px/frame) over recent history."""
        history = self.track_history.get(track_id)
        if not history or len(history) < 2:
            return 0.0
        points = list(history)
        # Compute displacements between consecutive frames
        displacements = [
            np.linalg.norm(np.array(points[i]) - np.array(points[i - 1]))
            for i in range(1, len(points))
        ]
        return float(np.mean(displacements)) if displacements else 0.0

    def _classify_motion(self, displacement: float, class_name: str) -> str:
        """Map displacement value to human-readable activity."""
        # Vehicles don't "walk"
        vehicles = {"car", "truck", "bus", "motorcycle", "bicycle", "train", "boat"}
        if class_name.lower() in vehicles:
            if displacement < THRESH_STATIONARY:
                return "Parked"
            elif displacement < THRESH_WALKING:
                return "Moving slowly"
            else:
                return "Moving fast"

        # Persons / animals / other
        if displacement < THRESH_STATIONARY:
            return "Stationary"
        elif displacement < THRESH_WALKING:
            return "Walking"
        elif displacement < THRESH_RUNNING:
            return "Jogging"
        else:
            return "Running"

    def _check_proximity(self, idx: int, detections: list) -> bool:
        """Check whether this object is near another detected object."""
        if len(detections) < 2:
            return False
        cx1, cy1 = detections[idx].get("centroid", [0, 0])
        for j, other in enumerate(detections):
            if j == idx:
                continue
            cx2, cy2 = other.get("centroid", [0, 0])
            if np.linalg.norm(np.array([cx1, cy1]) - np.array([cx2, cy2])) < PROXIMITY_THRESH:
                return True
        return False

    def describe(self, tracked_detections: list) -> list:
        """
        Parameters
        ----------
        tracked_detections : list of dicts produced by CentroidTracker.update()
            Each dict must have: track_id, centroid, class_name

        Returns
        -------
        Same list with 'activity' field added to each dict.
        """
        result = []
        for i, det in enumerate(tracked_detections):
            det = det.copy()
            track_id = det.get("track_id", -1)
            centroid = det.get("centroid", [0, 0])
            class_name = det.get("class_name", "object")

            # Update history
            if track_id not in self.track_history:
                self.track_history[track_id] = deque(maxlen=30)
            self.track_history[track_id].append(centroid)

            # Determine motion activity
            displacement = self._get_displacement(track_id)
            activity = self._classify_motion(displacement, class_name)

            # Check proximity interaction
            if self._check_proximity(i, tracked_detections):
                activity += " · Interacting"

            det["activity"] = activity
            det["displacement_px"] = round(displacement, 2)
            result.append(det)

        return result

    def reset(self):
        """Clear all track history (call when stream stops)."""
        self.track_history.clear()
