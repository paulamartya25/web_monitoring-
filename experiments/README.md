# VisionAI Research — Experiments

## Structure

```
experiments/
├── ablation_study.py      # Run all model configs, generate comparison table
├── sahi_integration.py    # SAHI vs standard inference benchmark
├── baseline_compare.py    # Compare with YOLOv5, RT-DETR baselines
├── results/               # CSV files auto-generated here
└── runs/                  # Training runs for each config
```

---

## Running the Ablation Study

```bash
# Install dependencies
pip install ultralytics sahi

# Run full ablation (takes several hours on GPU)
python experiments/ablation_study.py

# Results saved to experiments/results/ablation_YYYYMMDD_HHMM.csv
```

**Ablation Configurations:**

| Config | Model | Resolution | Epochs | Expected mAP |
|---|---|---|---|---|
| A1 | YOLOv8n (COCO pretrained) | 640px | 0 | ~37% |
| A2 | YOLOv8n fine-tuned | 640px | 50 | ~35-40% |
| A3 | YOLOv8n fine-tuned | 1280px | 50 | ~42-48% |
| A4 | YOLOv8s fine-tuned | 1280px | 100 | ~48-55% |

---

## Running SAHI Benchmark

```bash
# Single image inference with SAHI
python experiments/sahi_integration.py --image road.jpg

# Benchmark: SAHI vs standard (for ablation table)
python experiments/sahi_integration.py --image road.jpg --benchmark
```

**Expected output:**
```
Standard Inference:  35 detections, 30 FPS
SAHI Sliced:         52 detections, 12 FPS
Improvement:         +48% more detections at -60% FPS cost
```

---

## For Your MTech Report — Table Template

| Method | mAP@0.5 | Precision | Recall | F1 | FPS |
|---|---|---|---|---|---|
| YOLOv8n COCO (baseline) | 37.2% | 55.1% | 41.8% | 47.6% | 30 |
| + VisDrone fine-tune | 40.1% | 60.3% | 47.2% | 52.9% | 28 |
| + 1280px resolution | 47.8% | 67.1% | 55.4% | 60.6% | 15 |
| + YOLOv8s backbone | 53.2% | 71.4% | 61.3% | 66.0% | 12 |
| + SAHI inference | 58.7% | 74.2% | 65.8% | 69.7% | 8 |
| **VisionAI (ours)** | **58.7%** | **74.2%** | **65.8%** | **69.7%** | **8** |

*(Fill with your actual numbers after running experiments)*
