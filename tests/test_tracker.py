"""
tests/test_tracker.py — Unit tests for CentroidTracker
"""
import pytest
import numpy as np
from backend.core.tracker import CentroidTracker


def make_det(x1, y1, x2, y2, cls="car", conf=0.9):
    return {"bbox": [x1, y1, x2, y2], "class_name": cls, "confidence": conf}


class TestCentroidTrackerInit:
    def test_default_params(self):
        t = CentroidTracker()
        assert t.max_disappeared == 30
        assert t.max_distance == 80
        assert t.next_object_id == 0

    def test_custom_params(self):
        t = CentroidTracker(max_disappeared=10, max_distance=50)
        assert t.max_disappeared == 10
        assert t.max_distance == 50


class TestCentroidTrackerUpdate:
    def test_empty_detections_returns_empty(self):
        t = CentroidTracker()
        assert t.update([]) == []

    def test_single_detection_gets_id_zero(self):
        t = CentroidTracker()
        result = t.update([make_det(0, 0, 100, 100)])
        assert result[0]["track_id"] == 0

    def test_centroid_computed_correctly(self):
        t = CentroidTracker()
        result = t.update([make_det(0, 0, 100, 100)])
        assert result[0]["centroid"] == [50, 50]

    def test_two_detections_get_unique_ids(self):
        t = CentroidTracker()
        dets = [make_det(0, 0, 50, 50), make_det(200, 200, 300, 300)]
        result = t.update(dets)
        ids = {r["track_id"] for r in result}
        assert len(ids) == 2

    def test_same_object_keeps_id_across_frames(self):
        t = CentroidTracker()
        r1 = t.update([make_det(0, 0, 100, 100)])
        r2 = t.update([make_det(5, 5, 105, 105)])
        assert r1[0]["track_id"] == r2[0]["track_id"]

    def test_far_object_gets_new_id(self):
        t = CentroidTracker(max_distance=80)
        r1 = t.update([make_det(0, 0, 50, 50)])
        r2 = t.update([make_det(500, 500, 600, 600)])
        assert r1[0]["track_id"] != r2[0]["track_id"]

    def test_object_deregistered_after_max_disappeared(self):
        t = CentroidTracker(max_disappeared=2)
        t.update([make_det(0, 0, 100, 100)])
        t.update([])
        t.update([])
        t.update([])
        assert len(t.objects) == 0

    def test_class_name_preserved(self):
        t = CentroidTracker()
        result = t.update([make_det(0, 0, 100, 100, cls="bus")])
        assert result[0]["class_name"] == "bus"

    def test_confidence_preserved(self):
        t = CentroidTracker()
        result = t.update([make_det(0, 0, 100, 100, conf=0.75)])
        assert result[0]["confidence"] == 0.75

    def test_multiple_frames_id_stable(self):
        t = CentroidTracker()
        ids = []
        for i in range(5):
            r = t.update([make_det(i*2, i*2, i*2+100, i*2+100)])
            ids.append(r[0]["track_id"])
        assert len(set(ids)) == 1   # same ID all 5 frames


class TestCentroidTrackerHistory:
    def test_history_empty_for_unknown_id(self):
        t = CentroidTracker()
        assert t.get_history(999) == []

    def test_history_grows_with_frames(self):
        t = CentroidTracker()
        for i in range(3):
            t.update([make_det(i*5, i*5, i*5+50, i*5+50)])
        assert len(t.get_history(0)) == 3

    def test_history_capped_at_30(self):
        t = CentroidTracker()
        for i in range(40):
            t.update([make_det(i, i, i+50, i+50)])
        assert len(t.get_history(0)) <= 30
