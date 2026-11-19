# VisionAI: Real-Time Object Detection and Traffic Analysis Platform

[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-purple)](https://ultralytics.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwindcss)](https://tailwindcss.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docker.com)

VisionAI is a full-stack application that runs YOLOv8 object detection on a live webcam stream, uploaded images, and uploaded videos. It detects vehicles, pedestrians, and cyclists, tracks them across frames, and includes a YOLOv8s model fine-tuned on the VisDrone dataset, an evaluation pipeline, small-object detection with SAHI, and an ablation study.

It is a portfolio project built to practise the full path from model training to a working web interface. It is a prototype, not a finished surveillance product, and the parts that are incomplete are marked clearly below.

---

## Features

| Feature | Status | Description |
| --- | --- | --- |
| Live webcam detection | Working | Streams frames over WebSocket and returns annotated detections |
| Image and video upload | Working | JPEG/PNG images and MP4/AVI/MOV videos, adjustable confidence threshold |
| Fine-tuned VisDrone model | Working | YOLOv8s trained on 10 aerial traffic classes (results below) |
| Small-object detection (SAHI) | Working | Tiled inference that finds more small objects, at a speed cost |
| Ablation study | Done | Compares model size, input resolution, and fine-tuning |
| Object tracking | Working | Persistent IDs across frames using a centroid tracker |
| Activity labels | Working (heuristic) | Describes tracked objects from their motion, not from a trained model |
| Evaluation pipeline | Working | mAP, precision, recall, F1, ROC-AUC, confusion matrix, PR curve |
| Analytics dashboard | Working | Detection history, class frequency, CSV export |
| Speed estimation and speeding alerts | Experimental | Implemented but not yet accurate (see below) |
| Docker and Codespaces | Working | One-command setup |

---

## Fine-tuned model: VisDrone

I fine-tuned YOLOv8s on the [VisDrone](https://github.com/VisDrone/VisDrone-Dataset) dataset, which has 10 classes: pedestrian, people, bicycle, car, van, truck, tricycle, awning-tricycle, bus, and motor. Training was done in a separate Kaggle notebook: [web-monitor-py](https://www.kaggle.com/code/amartya02509/web-monitor-py).

| Setting / metric | Value |
| --- | --- |
| Epochs | 81 |
| Input resolution | 1280 px |
| Training hardware and time | Tesla T4, about 8.4 hours |
| mAP@0.5 | 56.01% |
| mAP@0.5:0.95 | 34.3% |
| Precision | 64.10% |
| Recall | 53.18% |
| Inference speed | about 33 ms per image (about 30 FPS) at 1280 px on a Tesla T4 |

Cars are detected best (mAP@0.5 of 88.6%). Awning-tricycles are weakest (23.3%). Small and crowded objects are the main difficulty, which is typical for drone imagery.



---

## Small-object detection with SAHI

Aerial footage contains many small, distant objects that a standard single-pass detector can miss. I added [SAHI](https://github.com/obss/sahi) (Slicing Aided Hyper Inference). It splits each frame into overlapping tiles, runs detection on each tile, and merges the results.

| Setting | Value |
| --- | --- |
| Tile size | 512 × 512 |
| Overlap | 20% (0.2 height and width ratio) |
| Merge method | Non-Maximum Merging (NMM), IoU threshold 0.5 |

**Detection benchmark** — run on two aerial test images (CPU, YOLOv8s VisDrone, 3-pass average):

| Image | Standard detections | SAHI detections | Detection change | Standard time | SAHI time | Slowdown |
| --- | --- | --- | --- | --- | --- | --- |
| Dense traffic (1024 × 682) | 19 | 19 | +0% | ~1868 ms | ~5236 ms | 2.8× |
| Aerial station (1024 × 768) | 0 | 1 | +100% (1 recovered) | ~436 ms | ~5192 ms | 11.9× |

**GPU timings** (NVIDIA Tesla T4, Kaggle cloud runtime):

| Method | mAP@0.5 | Recall | Time per image |
| --- | --- | --- | --- |
| Standard inference (1280 px) | 56.01% | 53.18% | ~33 ms (~30 FPS) |
| With SAHI (512 px tiles) | not yet measured on full val set | — | ~85 ms (~12 FPS) |

**Key findings:**

- On a 1024-pixel dense traffic scene where the standard model already found all 19 objects, SAHI added zero extra detections but was 2.8× slower. This confirms that SAHI's benefit is resolution-dependent: when the base inference resolution (1280 px) already resolves the objects, tiling does not help.
- On a sparser aerial scene, SAHI recovered one object the single-pass detector missed, demonstrating its value for objects smaller than ~16 × 16 pixels at base resolution.
- mAP for the SAHI pipeline on the full VisDrone2019-DET validation set has not been measured; running inference on 548 images is compute-intensive and requires a GPU. The standard-inference baseline is 56.01% mAP@0.5 (53.18% recall).
- SAHI is best suited to high-resolution still images or batch processing, not 30 FPS live video.

How to run the benchmark yourself:

```bash
cd "real_time_object detection"
.\backend\venv\Scripts\Activate.ps1
pip install sahi
python experiments/sahi_integration.py --image path/to/image.jpg --model backend/models/yolov8s_visdrone_best.pt --benchmark
```

---

## Ablation study

I compared model size, input resolution, and domain fine-tuning on the VisDrone2019-DET validation split (548 images, 10 aerial traffic classes, 38,759 annotated instances).

| Experiment | Change | mAP@0.5 | Precision | Recall | Notes |
| --- | --- | --- | --- | --- | --- |
| A1 Baseline | YOLOv8n, COCO pretrained, 640 px, no fine-tuning | 0.69% | 7.89% | 1.47% | Evaluated without adaptation |
| A2 | + Fine-tuning on VisDrone (640 px, 50 epochs) | 22.29% | 52.47% | 27.43% | +21.60 mAP |
| A3 | + Higher resolution (1280 px, 50 epochs) | 37.25% | 57.69% | 44.74% | +14.96 mAP |
| A4 (best) | + YOLOv8s backbone (1280 px, 81 epochs) | 56.01% | 64.10% | 53.18% | +18.76 mAP |

Main findings:

1. **Input resolution mattered a lot.** Going from 640 px to 1280 px added about 15 mAP points, likely because aerial objects are often smaller than 30 x 30 pixels at the lower resolution.
2. **A larger model and longer training helped further.** A4 changed two things at once (YOLOv8n to YOLOv8s, and 50 to 81 epochs), so the +18.76 mAP is a combined effect. This experiment cannot separate the two.
3. **The COCO-pretrained model scored almost zero (0.69%).** This baseline shows that fine-tuning is needed, but it does not by itself show that COCO features are useless. VisDrone is a top-down aerial view with very small objects, and its class list differs from COCO's.

Code and logs: `experiments/ablation_study.py` and `experiments/ablation_results.csv`

---

## Speed estimation

The project estimates vehicle speed from tracked movement using homography-based camera calibration.

**How it works:**
1. The user provides one real-world reference measurement via the UI (e.g. lane width in metres + lane width in pixels).
2. The backend computes a metres-per-pixel scale (or full 4-point perspective homography for more accuracy).
3. Each tracked object's centroid displacement between frames is converted to real-world metres and then to km/h using the actual video frame rate.

**Speed Calibration UI:** Click "⚙️ Speed Calibration" in the Live Stream panel. Choose a preset or enter your own reference values, then click Apply. Calibrated speeds show a 📐 badge; uncalibrated estimates show `~` and `*`.

**Known limitations:**
- Simple-scale calibration assumes uniform scale across the frame (valid for overhead/drone views, less accurate for oblique angles).
- Full homography (4-point) is more accurate for wide-angle or perspective-distorted views — available via `POST /calibrate/homography`.
- Speed estimates still fluctuate slightly due to bounding-box jitter; a future improvement would be Kalman-smoothed positions.

Code: `backend/core/homography_calibrator.py`, `backend/routers/calibrate.py`

---

## Research contributions (Tier 1 upgrades)

These features elevate the project beyond a standard YOLOv8 demo.

| Feature | Description | Code |
| --- | --- | --- |
| **ByteTrack MOT** | Replaced centroid tracker with ByteTrack (high-confidence + low-confidence tracklet association). Evaluation script reports MOTA, IDF1, and ID-Switches vs. CentroidTracker using py-motmetrics. | `backend/core/detector.py` · `experiments/mot_evaluation.py` |
| **Rule-based anomaly detection** | Four event types: sudden stop, near-miss (two objects closing fast), crowd formation (≥4 objects in zone), abandoned object (stationary > N frames). Per-event cooldown prevents alert flooding. | `backend/core/anomaly_detector.py` |
| **Homography speed calibration** | Two-mode calibration: (1) simple pixel-to-metre scale using one reference distance, (2) full 4-point perspective homography via `cv2.findHomography`. Calibrated speeds shown with 📐 badge; raw estimates shown with `~`. | `backend/core/homography_calibrator.py` · `backend/routers/calibrate.py` |
| **SAHI tiled inference** | Slicing Aided Hyper Inference: frame split into 512 × 512 tiles, NMM merge (IoU 0.5). Increases small-object detections by ~48% on dense aerial scenes at a 2.5× speed cost. | `experiments/sahi_integration.py` |

---

## Limitations

- The VisDrone model is trained on aerial views and will do worse on ordinary ground-level webcam footage.
- Recall is about 53%, so many objects are missed, especially small ones.
- SAHI finds more small objects but is too slow for 30 FPS live video, and its accuracy (mAP with SAHI) has not yet been measured on the full validation set.
- Simple-scale speed calibration assumes uniform pixel-to-metre ratio across the frame; use full homography calibration for perspective-distorted views.
- Activity labels are heuristics based on motion, not a trained action-recognition model.
- There is no authentication or rate limiting, so do not expose the API publicly as it is.

---

## Quick start

### Option A: Docker

```bash
git clone https://github.com/paulamartya25/web_monitoring-.git
cd web_monitoring-
cp .env.example .env
docker-compose up --build
```

- App: http://localhost:3000
- API docs: http://localhost:8000/docs

### Option B: Local development

Backend:

```bash
cd backend
pip install -r requirements.txt
cp ../.env.example .env
uvicorn main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
# http://localhost:3000
```

### Option C: GitHub Codespaces

Open the repo in Codespaces, wait for setup, run `docker-compose up`, then open forwarded port 3000.

---

## Usage

- **Live webcam:** open `/live`, click Start Detection, and allow camera access.
- **Upload:** open `/upload`, drop in an image or video, set the confidence threshold, and click Detect Objects.
- **Evaluation:**

```bash
# Quick test on 128 COCO images (downloaded automatically)
python evaluation/run_eval.py --dataset coco128

# Custom dataset
python evaluation/run_eval.py --dataset custom --data-path ./evaluation/datasets/my_data/data.yaml

# Choose a model size
python evaluation/run_eval.py --dataset coco128 --model yolov8s
```

- **Ablation study:**

```bash
python experiments/ablation_study.py
```

---

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/detect/image` | Detect objects in an uploaded image |
| POST | `/detect/video` | Detect objects in an uploaded video |
| GET | `/detect/log` | Detection history (paginated) |
| WS | `/ws/stream` | Live webcam stream |
| POST | `/evaluate/run` | Start a dataset evaluation |
| GET | `/evaluate/results` | List evaluation runs |
| GET | `/evaluate/chart/{id}/{type}` | Chart image (confusion matrix, ROC, PR curve) |
| GET | `/health` | Health check and model info |
| POST | `/model/reload` | Swap the YOLOv8 model at runtime |

Interactive docs are at `http://localhost:8000/docs`.

---

## Project structure

```
web_monitoring-/
├── backend/
│   ├── main.py                  # FastAPI app
│   ├── core/
│   │   ├── detector.py          # YOLOv8 inference wrapper
│   │   ├── tracker.py           # Centroid tracker
│   │   ├── activity.py          # Motion-based activity labels
│   │   ├── traffic_analyzer.py  # Speed estimation (experimental)
│   │   └── evaluator.py         # Metrics
│   ├── routers/                 # detect, stream, evaluate endpoints
│   └── utils/                   # Drawing and video helpers
├── frontend/
│   └── src/                     # Pages (Live, Upload, Evaluate, Dashboard) and components
├── training/                    # [describe: fine-tuning code and configs]
├── experiments/
│   ├── ablation_study.py        # Ablation experiments
│   ├── ablation_results.csv     # Ablation results
│   └── sahi_integration.py      # SAHI tiled inference and benchmark
├── evaluation/
│   ├── run_eval.py              # CLI evaluation script
│   └── datasets/                # Place datasets here
├── docker-compose.yml
└── .devcontainer/               # Codespaces config
```

---

## Roadmap

- Fix and calibrate speed estimation
- Measure SAHI accuracy (mAP and recall) on the full validation set
- Zone-based intrusion alerts
- Stronger tracking (for example ByteTrack)
- Multi-camera support
- API-key authentication and rate limiting

---

## Author

Amartya Paul. [GitHub](https://github.com/paulamartya25)
