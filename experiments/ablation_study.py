"""
experiments/ablation_study.py
Run all ablation configurations and log results to CSV.
Usage: python experiments/ablation_study.py
"""
import os, csv, time, torch, functools
from pathlib import Path
from datetime import datetime

# ── PyTorch 2.6 fix ──────────────────────────────────────────
if not getattr(torch.load, '_is_patched', False):
    _orig = torch.load
    @functools.wraps(_orig)
    def _safe_load(f, *a, **kw):
        kw.setdefault('weights_only', False)
        return _orig(f, *a, **kw)
    _safe_load._is_patched = True
    torch.load = _safe_load

from ultralytics import YOLO

RESULTS_DIR = Path("experiments/results")
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
CSV_PATH = RESULTS_DIR / f"ablation_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"

# ── Ablation configurations ───────────────────────────────────
CONFIGS = [
    {
        "name": "A1_baseline_coco",
        "description": "Pretrained COCO yolov8n, no fine-tuning",
        "model": "yolov8n.pt",
        "data": "VisDrone.yaml",
        "imgsz": 640,
        "fine_tune": False,
    },
    {
        "name": "A2_finetune_640",
        "description": "Fine-tuned VisDrone yolov8n @ 640px",
        "model": "yolov8n.pt",
        "data": "VisDrone.yaml",
        "imgsz": 640,
        "epochs": 50,
        "fine_tune": True,
    },
    {
        "name": "A3_finetune_1280",
        "description": "Fine-tuned VisDrone yolov8n @ 1280px",
        "model": "yolov8n.pt",
        "data": "VisDrone.yaml",
        "imgsz": 1280,
        "epochs": 50,
        "fine_tune": True,
    },
    {
        "name": "A4_yolov8s_1280",
        "description": "Fine-tuned VisDrone yolov8s @ 1280px",
        "model": "yolov8s.pt",
        "data": "VisDrone.yaml",
        "imgsz": 1280,
        "epochs": 100,
        "fine_tune": True,
    },
]

def measure_fps(model_path: str, imgsz: int, n_warmup=5, n_runs=50) -> float:
    """Measure inference FPS on a dummy image."""
    model = YOLO(model_path)
    dummy = torch.zeros(1, 3, imgsz, imgsz)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    # Warmup
    for _ in range(n_warmup):
        model.predict(dummy, device=device, verbose=False)
    # Timed runs
    start = time.time()
    for _ in range(n_runs):
        model.predict(dummy, device=device, verbose=False)
    elapsed = time.time() - start
    return round(n_runs / elapsed, 1)

def validate_model(model_path: str, data: str, imgsz: int) -> dict:
    """Run validation and return metrics dict."""
    model = YOLO(model_path)
    results = model.val(data=data, imgsz=imgsz, conf=0.25, iou=0.45,
                        verbose=False, plots=False)
    return {
        "map50":      round(results.box.map50  * 100, 2),
        "map5095":    round(results.box.map    * 100, 2),
        "precision":  round(results.box.mp     * 100, 2),
        "recall":     round(results.box.mr     * 100, 2),
        "f1":         round(2 * results.box.mp * results.box.mr /
                            max(results.box.mp + results.box.mr, 1e-6) * 100, 2),
    }

def run_ablation():
    rows = []
    fieldnames = ["config", "description", "model", "imgsz",
                  "map50", "map5095", "precision", "recall", "f1", "fps"]

    with open(CSV_PATH, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for cfg in CONFIGS:
            print(f"\n{'='*60}")
            print(f"Running: {cfg['name']} — {cfg['description']}")
            print(f"{'='*60}")

            if cfg["fine_tune"]:
                model = YOLO(cfg["model"])
                train_result = model.train(
                    data=cfg["data"],
                    epochs=cfg.get("epochs", 50),
                    imgsz=cfg["imgsz"],
                    batch=16 if cfg["imgsz"] == 640 else 8,
                    device="cuda" if torch.cuda.is_available() else "cpu",
                    project="experiments/runs",
                    name=cfg["name"],
                    patience=15,
                    mosaic=1.0,
                    save=True,
                    verbose=False,
                    plots=True,
                )
                model_path = f"experiments/runs/{cfg['name']}/weights/best.pt"
            else:
                model_path = cfg["model"]

            metrics = validate_model(model_path, cfg["data"], cfg["imgsz"])
            fps     = measure_fps(model_path, cfg["imgsz"])

            row = {
                "config":      cfg["name"],
                "description": cfg["description"],
                "model":       cfg["model"],
                "imgsz":       cfg["imgsz"],
                "fps":         fps,
                **metrics,
            }
            rows.append(row)
            writer.writerow(row)
            f.flush()

            print(f"  mAP@0.5:   {metrics['map50']}%")
            print(f"  Precision: {metrics['precision']}%")
            print(f"  Recall:    {metrics['recall']}%")
            print(f"  F1:        {metrics['f1']}%")
            print(f"  FPS:       {fps}")

    print(f"\n{'='*60}")
    print("ABLATION STUDY COMPLETE")
    print(f"Results saved to: {CSV_PATH}")
    print(f"{'='*60}\n")

    # Print final table
    print(f"{'Config':<25} {'mAP@0.5':>8} {'Prec':>8} {'Recall':>8} {'F1':>8} {'FPS':>6}")
    print("-" * 70)
    for row in rows:
        print(f"{row['config']:<25} {row['map50']:>7}% {row['precision']:>7}% "
              f"{row['recall']:>7}% {row['f1']:>7}% {row['fps']:>5}")

if __name__ == "__main__":
    run_ablation()
