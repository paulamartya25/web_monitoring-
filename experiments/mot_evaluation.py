"""
experiments/mot_evaluation.py
==============================
Evaluate multi-object tracking on VisDrone2019-MOT sequences.
Computes MOTA, IDF1, HOTA, Precision, Recall and ID-Switch count.
Compares ByteTrack vs CentroidTracker (baseline) side-by-side.

Requirements
------------
  pip install motmetrics ultralytics opencv-python-headless numpy

Dataset
-------
Download VisDrone2019-MOT-val from:
  https://github.com/VisDrone/VisDrone-Dataset

Expected folder layout:
  datasets/VisDrone2019-MOT-val/
    sequences/
      uav0000013_00000_v/
        00000001.jpg
        00000002.jpg
        ...
    annotations/
      uav0000013_00000_v.txt   ← MOT-format ground-truth

MOT-format columns (comma-separated):
  frame_id, track_id, x, y, w, h, score, class_id, truncation, occlusion

Usage
-----
  cd "c:\\Users\\amart\\Desktop\\real_time_object detection"
  python experiments/mot_evaluation.py \\
      --seq-dir  datasets/VisDrone2019-MOT-val/sequences \\
      --ann-dir  datasets/VisDrone2019-MOT-val/annotations \\
      --model    backend/models/yolov8s_visdrone_best.pt \\
      --max-seq  5     # evaluate first 5 sequences only (quick run)

Output
------
  experiments/results/mot_metrics_<timestamp>.csv
  Console: comparison table of ByteTrack vs CentroidTracker
"""

import argparse
import os
import sys
import time
import csv
from collections import OrderedDict, deque
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np

# ── Try importing motmetrics ───────────────────────────────────────────────
try:
    import motmetrics as mm
except ImportError:
    sys.exit(
        "motmetrics not installed.\n"
        "Run: pip install motmetrics\n"
    )

try:
    from ultralytics import YOLO
except ImportError:
    sys.exit("ultralytics not installed. Run: pip install ultralytics")


# ══════════════════════════════════════════════════════════════════════════
# Centroid Tracker (baseline — same as backend/core/tracker.py)
# ══════════════════════════════════════════════════════════════════════════
from scipy.spatial.distance import cdist


class CentroidTracker:
    def __init__(self, max_disappeared=30, max_distance=80):
        self.next_id = 0
        self.objects: OrderedDict = OrderedDict()
        self.disappeared: OrderedDict = OrderedDict()
        self.max_disappeared = max_disappeared
        self.max_distance = max_distance

    def update(self, detections):
        if not detections:
            for oid in list(self.disappeared):
                self.disappeared[oid] += 1
                if self.disappeared[oid] > self.max_disappeared:
                    del self.objects[oid]
                    del self.disappeared[oid]
            return []

        input_centroids = []
        for d in detections:
            x1, y1, x2, y2 = d["bbox"]
            input_centroids.append([(x1 + x2) // 2, (y1 + y2) // 2])
        input_centroids = np.array(input_centroids)

        col_to_oid = {}
        if not self.objects:
            for col, c in enumerate(input_centroids):
                new_id = self.next_id
                self.objects[new_id] = c
                self.disappeared[new_id] = 0
                col_to_oid[col] = new_id
                self.next_id += 1
        else:
            obj_ids = list(self.objects.keys())
            obj_cents = np.array(list(self.objects.values()))
            D = cdist(obj_cents, input_centroids)
            rows = D.min(axis=1).argsort()
            cols = D.argmin(axis=1)[rows]
            used_rows, used_cols = set(), set()
            for row, col in zip(rows, cols):
                if row in used_rows or col in used_cols:
                    continue
                if D[row, col] > self.max_distance:
                    continue
                oid = obj_ids[row]
                self.objects[oid] = input_centroids[col]
                self.disappeared[oid] = 0
                used_rows.add(row); used_cols.add(col)
                col_to_oid[col] = oid
            for row in set(range(len(obj_ids))) - used_rows:
                oid = obj_ids[row]
                self.disappeared[oid] += 1
                if self.disappeared[oid] > self.max_disappeared:
                    del self.objects[oid]; del self.disappeared[oid]
            for col in set(range(len(input_centroids))) - used_cols:
                new_id = self.next_id
                self.objects[new_id] = input_centroids[col]
                self.disappeared[new_id] = 0
                col_to_oid[col] = new_id
                self.next_id += 1

        result = []
        for i, det in enumerate(detections):
            det = det.copy()
            det["track_id"] = col_to_oid.get(i, -1)
            result.append(det)
        return result

    def reset(self):
        self.next_id = 0
        self.objects.clear()
        self.disappeared.clear()


# ══════════════════════════════════════════════════════════════════════════
# Ground-truth loader (VisDrone annotation format)
# ══════════════════════════════════════════════════════════════════════════
def load_gt(ann_path: str) -> dict[int, list]:
    """
    Returns dict: frame_id → list of {track_id, bbox:[x,y,w,h]}
    VisDrone format: frame,id,x,y,w,h,score,class,trunc,occl
    """
    gt: dict[int, list] = {}
    with open(ann_path) as f:
        for line in f:
            parts = line.strip().split(",")
            if len(parts) < 6:
                continue
            frame_id = int(parts[0])
            track_id = int(parts[1])
            x, y, w, h = int(parts[2]), int(parts[3]), int(parts[4]), int(parts[5])
            score = int(parts[6]) if len(parts) > 6 else 1
            if score == 0:          # ignore region (VisDrone convention)
                continue
            gt.setdefault(frame_id, []).append({
                "track_id": track_id,
                "bbox": [x, y, w, h],   # x1, y1, w, h
            })
    return gt


# ══════════════════════════════════════════════════════════════════════════
# Run tracking on a sequence, return predictions per frame
# ══════════════════════════════════════════════════════════════════════════
def run_sequence_bytetrack(model: YOLO, frame_paths: list, conf=0.25, iou=0.45):
    """Run ByteTrack tracking on all frames. Returns {frame_id: predictions}."""
    preds = {}
    model.predictor = None          # reset ByteTrack state between sequences
    for idx, fp in enumerate(frame_paths, start=1):
        frame = cv2.imread(fp)
        if frame is None:
            continue
        results = model.track(
            source=frame, conf=conf, iou=iou,
            tracker="bytetrack.yaml", persist=True, verbose=False,
        )
        frame_preds = []
        for box in results[0].boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            tid = int(box.id[0]) if box.id is not None else -1
            frame_preds.append({
                "track_id": tid,
                "bbox": [round(x1), round(y1),
                         round(x2 - x1), round(y2 - y1)],   # x, y, w, h
                "confidence": float(box.conf[0]),
            })
        preds[idx] = frame_preds
    return preds


def run_sequence_centroid(model: YOLO, frame_paths: list, conf=0.25, iou=0.45):
    """Run CentroidTracker on all frames. Returns {frame_id: predictions}."""
    tracker = CentroidTracker()
    preds = {}
    for idx, fp in enumerate(frame_paths, start=1):
        frame = cv2.imread(fp)
        if frame is None:
            continue
        results = model.predict(source=frame, conf=conf, iou=iou, verbose=False)
        detections = []
        for box in results[0].boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            detections.append({
                "bbox": [round(x1), round(y1), round(x2), round(y2)],
                "confidence": float(box.conf[0]),
            })
        tracked = tracker.update(detections)
        frame_preds = []
        for t in tracked:
            x1, y1, x2, y2 = t["bbox"]
            frame_preds.append({
                "track_id":   t["track_id"],
                "bbox":       [x1, y1, x2 - x1, y2 - y1],   # x, y, w, h
                "confidence": t.get("confidence", 1.0),
            })
        preds[idx] = frame_preds
    return preds


# ══════════════════════════════════════════════════════════════════════════
# Compute MOT metrics using py-motmetrics
# ══════════════════════════════════════════════════════════════════════════
def iou_distance(gt_boxes, pred_boxes):
    """
    Compute IoU-based distance matrix for motmetrics.
    Boxes in [x, y, w, h] format.
    """
    if not gt_boxes or not pred_boxes:
        return np.empty((len(gt_boxes), len(pred_boxes)))

    def to_xyxy(b):
        x, y, w, h = b
        return [x, y, x + w, y + h]

    dist = np.zeros((len(gt_boxes), len(pred_boxes)))
    for i, g in enumerate(gt_boxes):
        g = to_xyxy(g)
        for j, p in enumerate(pred_boxes):
            p = to_xyxy(p)
            xi = max(g[0], p[0]); yi = max(g[1], p[1])
            xa = min(g[2], p[2]); ya = min(g[3], p[3])
            inter = max(0, xa - xi) * max(0, ya - yi)
            area_g = (g[2]-g[0]) * (g[3]-g[1])
            area_p = (p[2]-p[0]) * (p[3]-p[1])
            union = area_g + area_p - inter + 1e-6
            dist[i, j] = 1.0 - (inter / union)   # distance = 1 - IoU
    return dist


def compute_metrics(gt_all: dict, pred_all: dict, threshold=0.5) -> dict:
    acc = mm.MOTAccumulator(auto_id=True)
    for fid in sorted(set(gt_all) | set(pred_all)):
        gts   = gt_all.get(fid, [])
        preds = pred_all.get(fid, [])
        gt_ids  = [g["track_id"] for g in gts]
        pred_ids = [p["track_id"] for p in preds]
        gt_bboxes   = [g["bbox"] for g in gts]
        pred_bboxes = [p["bbox"] for p in preds]
        dist = iou_distance(gt_bboxes, pred_bboxes)
        # Mask distances beyond threshold as np.nan
        dist[dist > (1.0 - threshold)] = np.nan
        acc.update(gt_ids, pred_ids, dist)

    mh = mm.metrics.create()
    summary = mh.compute(
        acc,
        metrics=["num_frames", "mota", "motp", "idf1",
                 "num_switches", "num_false_positives",
                 "num_misses", "precision", "recall"],
        name="metrics",
    )
    row = summary.iloc[0]
    return {
        "MOTA":    round(float(row["mota"]) * 100, 2),
        "MOTP":    round(float(row["motp"]) * 100, 2),
        "IDF1":    round(float(row["idf1"]) * 100, 2),
        "ID-Sw":   int(row["num_switches"]),
        "FP":      int(row["num_false_positives"]),
        "FN":      int(row["num_misses"]),
        "Prec":    round(float(row["precision"]) * 100, 2),
        "Recall":  round(float(row["recall"]) * 100, 2),
        "Frames":  int(row["num_frames"]),
    }


# ══════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════
def parse_args():
    p = argparse.ArgumentParser(description="VisionAI MOT Evaluation")
    p.add_argument("--seq-dir",  required=True, help="Path to sequences folder")
    p.add_argument("--ann-dir",  required=True, help="Path to annotations folder")
    p.add_argument("--model",    default="backend/models/yolov8s_visdrone_best.pt")
    p.add_argument("--conf",     type=float, default=0.25)
    p.add_argument("--iou",      type=float, default=0.45)
    p.add_argument("--max-seq",  type=int,   default=None,
                   help="Limit number of sequences (for quick testing)")
    p.add_argument("--output-dir", default="experiments/results")
    return p.parse_args()


def main():
    args = parse_args()

    Path(args.output_dir).mkdir(parents=True, exist_ok=True)

    # Load model once (shared for both tracker modes)
    print(f"\nLoading model: {args.model}")
    model = YOLO(args.model)

    seq_dir = Path(args.seq_dir)
    ann_dir = Path(args.ann_dir)
    sequences = sorted(seq_dir.iterdir())
    if args.max_seq:
        sequences = sequences[:args.max_seq]

    print(f"Evaluating {len(sequences)} sequences...\n")

    # Accumulate per-tracker GT and predictions across all sequences
    gt_global_bt = {}
    pred_global_bt = {}
    gt_global_ct = {}
    pred_global_ct = {}
    global_frame_offset = 0

    for seq in sequences:
        ann_file = ann_dir / f"{seq.name}.txt"
        if not ann_file.exists():
            print(f"  [SKIP] No annotation for {seq.name}")
            continue

        frame_paths = sorted([
            str(p) for p in seq.iterdir()
            if p.suffix.lower() in {".jpg", ".png", ".jpeg"}
        ])
        if not frame_paths:
            print(f"  [SKIP] No frames in {seq.name}")
            continue

        gt = load_gt(str(ann_file))
        n = len(frame_paths)

        print(f"  ByteTrack  — {seq.name} ({n} frames)...", end=" ", flush=True)
        t0 = time.time()
        pred_bt = run_sequence_bytetrack(model, frame_paths, args.conf, args.iou)
        print(f"{time.time()-t0:.1f}s")

        print(f"  Centroid   — {seq.name} ({n} frames)...", end=" ", flush=True)
        t0 = time.time()
        pred_ct = run_sequence_centroid(model, frame_paths, args.conf, args.iou)
        print(f"{time.time()-t0:.1f}s")

        # Merge into global dicts with offset to avoid frame_id collisions
        for fid, objs in gt.items():
            gt_global_bt[fid + global_frame_offset] = objs
            gt_global_ct[fid + global_frame_offset] = objs
        for fid, objs in pred_bt.items():
            pred_global_bt[fid + global_frame_offset] = objs
        for fid, objs in pred_ct.items():
            pred_global_ct[fid + global_frame_offset] = objs

        global_frame_offset += n + 1   # +1 gap between sequences

    # Compute final metrics
    print("\nComputing metrics...")
    metrics_bt = compute_metrics(gt_global_bt, pred_global_bt)
    metrics_ct = compute_metrics(gt_global_ct, pred_global_ct)

    # Print comparison table
    header = f"{'Metric':<12} {'ByteTrack':>12} {'CentroidTracker':>18} {'Δ':>8}"
    print("\n" + "=" * len(header))
    print(header)
    print("=" * len(header))
    for key in ["MOTA", "MOTP", "IDF1", "Prec", "Recall", "ID-Sw", "FP", "FN"]:
        bt  = metrics_bt[key]
        ct  = metrics_ct[key]
        # For ID-Sw, FP, FN: lower is better (show negative delta as improvement)
        delta = bt - ct if key not in {"ID-Sw", "FP", "FN"} else ct - bt
        sign = "+" if delta > 0 else ""
        print(f"  {key:<10} {bt:>12} {ct:>18} {sign}{delta:>7.1f}")
    print("=" * len(header))

    # Save to CSV
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_csv = os.path.join(args.output_dir, f"mot_metrics_{ts}.csv")
    with open(out_csv, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["tracker"] + list(metrics_bt.keys()))
        writer.writeheader()
        writer.writerow({"tracker": "ByteTrack", **metrics_bt})
        writer.writerow({"tracker": "CentroidTracker", **metrics_ct})

    print(f"\nResults saved to: {out_csv}")
    print("\nKey metrics to report in README/thesis:")
    print(f"  ByteTrack  — MOTA: {metrics_bt['MOTA']}%  IDF1: {metrics_bt['IDF1']}%  ID-Switches: {metrics_bt['ID-Sw']}")
    print(f"  Centroid   — MOTA: {metrics_ct['MOTA']}%  IDF1: {metrics_ct['IDF1']}%  ID-Switches: {metrics_ct['ID-Sw']}")


if __name__ == "__main__":
    main()
