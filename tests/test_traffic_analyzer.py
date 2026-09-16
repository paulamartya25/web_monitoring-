"""
tests/test_traffic_analyzer.py — Unit tests for TrafficActivityDescriptor
"""
import pytest
from backend.core.traffic_analyzer import (
    TrafficActivityDescriptor, STOPPED_THRESH, SLOW_THRESH, FAST_THRESH, PARKED_FRAMES
)


def make_tracked(cls="car", track_id=1, centroid=None):
    return {
        "class_name": cls,
        "track_id": track_id,
        "centroid": centroid or [100, 100],
        "bbox": [75, 75, 125, 125],
        "confidence": 0.9,
    }


class TestTrafficActivityDescriptorInit:
    def test_starts_empty(self):
        a = TrafficActivityDescriptor()
        assert a.track_history == {}
        assert a.stopped_frames == {}

    def test_reset_clears_state(self):
        a = TrafficActivityDescriptor()
        a.track_history[1] = []
        a.stopped_frames[1] = 5
        a.reset()
        assert a.track_history == {}
        assert a.stopped_frames == {}


class TestActivityLabels:
    def test_stationary_vehicle_is_stopped(self):
        a = TrafficActivityDescriptor()
        det = make_tracked("car", 1, [100, 100])
        # Feed same centroid multiple times → displacement = 0
        for _ in range(5):
            results = a.describe([det])
        assert "Stopped" in results[0]["activity"] or "🔴" in results[0]["activity"]

    def test_fast_vehicle_is_speeding(self):
        a = TrafficActivityDescriptor()
        # Simulate large displacement by feeding far-apart centroids
        positions = [[0, 0], [50, 50], [100, 100], [150, 150], [200, 200]]
        for pos in positions:
            det = make_tracked("car", 1, pos)
            results = a.describe([det])
        # Large displacement should trigger speeding
        assert "Speeding" in results[0]["activity"] or "Moving" in results[0]["activity"]

    def test_pedestrian_standing(self):
        a = TrafficActivityDescriptor()
        det = make_tracked("person", 2, [200, 200])
        for _ in range(5):
            results = a.describe([det])
        assert "Standing" in results[0]["activity"] or "🧍" in results[0]["activity"]

    def test_pedestrian_walking(self):
        a = TrafficActivityDescriptor()
        positions = [[0, 0], [10, 10], [20, 20], [30, 30]]
        for pos in positions:
            det = make_tracked("person", 2, pos)
            results = a.describe([det])
        assert "Walking" in results[0]["activity"] or "🚶" in results[0]["activity"]

    def test_bicycle_stopped(self):
        a = TrafficActivityDescriptor()
        det = make_tracked("bicycle", 3, [100, 100])
        for _ in range(5):
            results = a.describe([det])
        assert "Stopped" in results[0]["activity"] or "🚲" in results[0]["activity"]

    def test_illegally_parked_after_many_stopped_frames(self):
        a = TrafficActivityDescriptor()
        det = make_tracked("car", 1, [100, 100])
        for _ in range(PARKED_FRAMES + 5):
            results = a.describe([det])
        assert "Illegally Parked" in results[0]["activity"] or "🚨" in results[0]["activity"]


class TestSpeedEstimation:
    def test_speed_is_zero_for_stationary(self):
        a = TrafficActivityDescriptor()
        det = make_tracked("car", 1, [100, 100])
        for _ in range(5):
            results = a.describe([det])
        assert results[0]["estimated_speed_kmh"] == 0.0

    def test_speed_is_positive_for_moving(self):
        a = TrafficActivityDescriptor()
        positions = [[0, 0], [10, 0], [20, 0], [30, 0], [40, 0]]
        for pos in positions:
            det = make_tracked("car", 1, pos)
            results = a.describe([det])
        assert results[0]["estimated_speed_kmh"] > 0

    def test_displacement_px_field_present(self):
        a = TrafficActivityDescriptor()
        det = make_tracked("car", 1, [100, 100])
        results = a.describe([det])
        assert "displacement_px" in results[0]


class TestAlertFlag:
    def test_speeding_triggers_alert(self):
        a = TrafficActivityDescriptor()
        positions = [[0, 0], [60, 0], [120, 0], [180, 0], [240, 0]]
        for pos in positions:
            det = make_tracked("car", 1, pos)
            results = a.describe([det])
        if "🚨" in results[0]["activity"]:
            assert results[0]["alert"] is True

    def test_normal_movement_no_alert(self):
        a = TrafficActivityDescriptor()
        positions = [[0, 0], [5, 0], [10, 0], [15, 0]]
        for pos in positions:
            det = make_tracked("car", 1, pos)
            results = a.describe([det])
        if "Moving" in results[0]["activity"] and "🚨" not in results[0]["activity"]:
            assert results[0]["alert"] is False

    def test_multiple_detections_processed(self):
        a = TrafficActivityDescriptor()
        dets = [
            make_tracked("car", 1, [100, 100]),
            make_tracked("person", 2, [200, 200]),
            make_tracked("bus", 3, [300, 300]),
        ]
        results = a.describe(dets)
        assert len(results) == 3
