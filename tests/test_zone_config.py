"""
tests/test_zone_config.py — Unit tests for VehicleCounter, ZoneMonitor, TrafficStats
"""
import pytest
from backend.core.zone_config import VehicleCounter, ZoneMonitor, TrafficStats


def make_det(cls="car", track_id=1, centroid=None):
    return {
        "class_name": cls, "track_id": track_id,
        "centroid": centroid or [100, 100],
        "estimated_speed_kmh": 30.0,
    }


# ─── VehicleCounter ────────────────────────────────────────────────────────────

class TestVehicleCounter:
    def test_no_crossing_same_side(self):
        c = VehicleCounter(line_y=320)
        det = make_det("car", 1, [100, 100])
        c.update([det])
        det2 = make_det("car", 1, [100, 150])
        counts = c.update([det2])
        assert counts.get("car", 0) == 0

    def test_crossing_horizontal_line(self):
        c = VehicleCounter(line_y=320)
        # Move from y=300 (above) to y=340 (below) → crosses line_y=320
        det1 = make_det("car", 1, [100, 300])
        c.update([det1])
        det2 = make_det("car", 1, [100, 340])
        counts = c.update([det2])
        assert counts.get("car", 0) == 1

    def test_crossing_vertical_line(self):
        c = VehicleCounter(line_x=320)
        det1 = make_det("bus", 1, [300, 100])
        c.update([det1])
        det2 = make_det("bus", 1, [340, 100])
        counts = c.update([det2])
        assert counts.get("bus", 0) == 1

    def test_same_object_counts_once(self):
        c = VehicleCounter(line_y=320)
        # Cross once
        c.update([make_det("car", 1, [100, 300])])
        c.update([make_det("car", 1, [100, 340])])
        # Cross again (back and forth) — should NOT count again
        c.update([make_det("car", 1, [100, 300])])
        c.update([make_det("car", 1, [100, 340])])
        assert c.counts.get("car", 0) == 1

    def test_multiple_classes_counted_separately(self):
        c = VehicleCounter(line_y=320)
        c.update([make_det("car",  1, [100, 300])])
        c.update([make_det("car",  1, [100, 340])])
        c.update([make_det("bus",  2, [200, 300])])
        c.update([make_det("bus",  2, [200, 340])])
        assert c.counts.get("car", 0) == 1
        assert c.counts.get("bus", 0) == 1

    def test_total_property(self):
        c = VehicleCounter(line_y=320)
        c.update([make_det("car",  1, [100, 300])])
        c.update([make_det("car",  1, [100, 340])])
        c.update([make_det("bus",  2, [200, 300])])
        c.update([make_det("bus",  2, [200, 340])])
        assert c.total == 2

    def test_reset_clears_everything(self):
        c = VehicleCounter(line_y=320)
        c.update([make_det("car", 1, [100, 300])])
        c.update([make_det("car", 1, [100, 340])])
        c.reset_counts()
        assert c.total == 0
        assert len(c.crossed_ids) == 0

    def test_negative_track_id_ignored(self):
        c = VehicleCounter(line_y=320)
        c.update([make_det("car", -1, [100, 300])])
        counts = c.update([make_det("car", -1, [100, 340])])
        assert counts.get("car", 0) == 0


# ─── ZoneMonitor ───────────────────────────────────────────────────────────────

class TestZoneMonitor:
    def get_monitor(self):
        zones = [{"name": "Crosswalk", "bbox": [0, 0, 200, 200],
                  "watch": ["person"], "alert": "⚠️ Person in road"}]
        return ZoneMonitor(zones=zones)

    def test_no_alert_outside_zone(self):
        zm = self.get_monitor()
        det = make_det("person", 1, [300, 300])  # outside zone
        alerts = zm.check([det])
        assert len(alerts) == 0

    def test_alert_inside_zone(self):
        zm = self.get_monitor()
        det = make_det("person", 1, [100, 100])  # inside zone
        alerts = zm.check([det])
        assert len(alerts) == 1
        assert "Person in road" in alerts[0]

    def test_wrong_class_no_alert(self):
        zm = self.get_monitor()
        det = make_det("car", 1, [100, 100])   # car in pedestrian zone
        alerts = zm.check([det])
        assert len(alerts) == 0

    def test_empty_detections_no_alerts(self):
        zm = self.get_monitor()
        assert zm.check([]) == []

    def test_no_zones_no_alerts(self):
        zm = ZoneMonitor(zones=[])
        det = make_det("person", 1, [100, 100])
        assert zm.check([det]) == []

    def test_alert_contains_track_id(self):
        zm = self.get_monitor()
        det = make_det("person", 42, [100, 100])
        alerts = zm.check([det])
        assert "42" in alerts[0]

    def test_multiple_objects_multiple_alerts(self):
        zm = self.get_monitor()
        dets = [
            make_det("person", 1, [50, 50]),
            make_det("person", 2, [100, 100]),
        ]
        alerts = zm.check(dets)
        assert len(alerts) == 2


# ─── TrafficStats ──────────────────────────────────────────────────────────────

class TestTrafficStats:
    def test_empty_summary(self):
        ts = TrafficStats()
        s = ts.summary()
        assert s["total_objects"] == 0
        assert s["avg_speed_kmh"] == 0.0
        assert s["max_speed_kmh"] == 0.0
        assert s["alert_count"] == 0

    def test_counts_objects(self):
        ts = TrafficStats()
        dets = [make_det("car", 1), make_det("bus", 2)]
        ts.update(dets, [])
        s = ts.summary()
        assert s["total_objects"] == 2

    def test_class_counts_correct(self):
        ts = TrafficStats()
        ts.update([make_det("car", 1), make_det("car", 2), make_det("bus", 3)], [])
        s = ts.summary()
        assert s["class_counts"]["car"] == 2
        assert s["class_counts"]["bus"] == 1

    def test_avg_speed_calculated(self):
        ts = TrafficStats()
        dets = [
            {**make_det("car", 1), "estimated_speed_kmh": 40.0},
            {**make_det("bus", 2), "estimated_speed_kmh": 60.0},
        ]
        ts.update(dets, [])
        s = ts.summary()
        assert s["avg_speed_kmh"] == 50.0

    def test_max_speed_calculated(self):
        ts = TrafficStats()
        dets = [
            {**make_det("car", 1), "estimated_speed_kmh": 40.0},
            {**make_det("bus", 2), "estimated_speed_kmh": 120.0},
        ]
        ts.update(dets, [])
        s = ts.summary()
        assert s["max_speed_kmh"] == 120.0

    def test_alerts_counted(self):
        ts = TrafficStats()
        ts.update([], ["alert1", "alert2", "alert3"])
        s = ts.summary()
        assert s["alert_count"] == 3

    def test_window_limit_respected(self):
        ts = TrafficStats(window_frames=5)
        for i in range(10):
            ts.update([make_det("car", i)], [])
        # Only last 5 frames kept
        s = ts.summary()
        assert s["total_objects"] == 5
