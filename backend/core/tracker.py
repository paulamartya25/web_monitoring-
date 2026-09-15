import numpy as np
from collections import OrderedDict, deque
from scipy.spatial import distance as dist


class CentroidTracker:
    """
    Simple centroid-based multi-object tracker.
    Assigns persistent IDs to detected objects across frames
    using Euclidean distance between bounding-box centroids.
    """

    def __init__(self, max_disappeared: int = 30, max_distance: int = 80):
        self.next_object_id = 0
        self.objects: OrderedDict[int, np.ndarray] = OrderedDict()   # id -> centroid
        self.disappeared: OrderedDict[int, int] = OrderedDict()       # id -> frames missing
        self.centroids_history: dict[int, deque] = {}                 # id -> recent centroids
        self.max_disappeared = max_disappeared
        self.max_distance = max_distance

    # ------------------------------------------------------------------
    def _register(self, centroid: np.ndarray):
        self.objects[self.next_object_id] = centroid
        self.disappeared[self.next_object_id] = 0
        self.centroids_history[self.next_object_id] = deque(maxlen=30)
        self.centroids_history[self.next_object_id].append(centroid)
        self.next_object_id += 1

    def _deregister(self, object_id: int):
        del self.objects[object_id]
        del self.disappeared[object_id]
        if object_id in self.centroids_history:
            del self.centroids_history[object_id]

    # ------------------------------------------------------------------
    def update(self, detections: list) -> list:
        """
        Parameters
        ----------
        detections : list of dicts with keys:
            - bbox       : [x1, y1, x2, y2]
            - class_name : str
            - confidence : float

        Returns
        -------
        Same list with 'track_id' and 'centroid' added to each dict.
        """
        if not detections:
            # Mark all existing tracks as disappeared
            for oid in list(self.disappeared.keys()):
                self.disappeared[oid] += 1
                if self.disappeared[oid] > self.max_disappeared:
                    self._deregister(oid)
            return []

        # Compute input centroids
        input_centroids = []
        for d in detections:
            x1, y1, x2, y2 = d["bbox"]
            cx = int((x1 + x2) / 2)
            cy = int((y1 + y2) / 2)
            input_centroids.append(np.array([cx, cy]))

        if not self.objects:
            for c in input_centroids:
                self._register(c)
        else:
            object_ids = list(self.objects.keys())
            object_centroids = list(self.objects.values())

            # Distance matrix: existing objects vs new detections
            D = dist.cdist(np.array(object_centroids), np.array(input_centroids))

            # Hungarian-style greedy matching (rows = existing, cols = new)
            rows = D.min(axis=1).argsort()
            cols = D.argmin(axis=1)[rows]

            used_rows, used_cols = set(), set()

            for (row, col) in zip(rows, cols):
                if row in used_rows or col in used_cols:
                    continue
                if D[row, col] > self.max_distance:
                    continue

                oid = object_ids[row]
                self.objects[oid] = input_centroids[col]
                self.disappeared[oid] = 0
                self.centroids_history[oid].append(input_centroids[col])
                used_rows.add(row)
                used_cols.add(col)

            # Handle unmatched existing tracks
            for row in set(range(len(object_ids))) - used_rows:
                oid = object_ids[row]
                self.disappeared[oid] += 1
                if self.disappeared[oid] > self.max_disappeared:
                    self._deregister(oid)

            # Register unmatched new detections
            for col in set(range(len(input_centroids))) - used_cols:
                self._register(input_centroids[col])

        # Attach track_id to detections
        result = []
        assigned_ids = list(self.objects.keys())
        for i, det in enumerate(detections):
            if i < len(assigned_ids):
                tid = assigned_ids[i]
                det = det.copy()
                det["track_id"] = tid
                det["centroid"] = self.objects[tid].tolist()
            else:
                det = det.copy()
                det["track_id"] = -1
                det["centroid"] = [0, 0]
            result.append(det)

        return result

    def get_history(self, track_id: int) -> list:
        """Return recent centroids for a given track ID."""
        history = self.centroids_history.get(track_id)
        if history:
            return [c.tolist() for c in history]
        return []
