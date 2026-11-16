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
| Tile size | 512 x 512 |
| Overlap | 20% (0.2 height and width ratio) |
| Merge method | Non-Maximum Merging (NMM), IoU threshold 0.5 |

| Method | Time per image |
| --- | --- |
| Standard inference (1280 px) | about 33 ms (about 30 FPS) |
| With SAHI (512 px tiles) | about 85 ms (about 12 FPS) |

Timings measured on an NVIDIA Tesla T4 GPU (Kaggle cloud runtime).

In dense aerial scenes, SAHI produced about 48% more detection candidates than standard inference. This counts detections, not verified accuracy; I have not yet reported mAP for the SAHI pipeline on the full validation set. The cost is speed: running many overlapping tiles per frame makes inference roughly 2.5 times slower. That makes SAHI better suited to high-resolution still images or batch processing than to 30 FPS live video.

How to use it:

```bash
python experiments/sahi_integration.py --image path/to/image.jpg --benchmark
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

## Speed estimation (experimental)

The project includes a first attempt at estimating vehicle speed from tracked movement and flagging "speeding" vehicles. It does **not** currently give reliable results, so treat any speed value or speeding alert as indicative only. The code is in `backend/core/traffic_analyzer.py`.

**Known problems:**

- Estimates fluctuate between consecutive frames (for example jumping between 15 km/h and 60 km/h), because bounding-box positions jitter slightly, especially for slow or stationary vehicles.
- Pixel distance is converted to real distance with a fixed scale factor (`displacement_px * 0.12 * 30 fps`). It uses no camera calibration, camera angle, or real-world reference, and it assumes 30 FPS.
- The centroid tracker can switch object IDs during occlusions. That produces large artificial jumps in position and can trigger false speeding alerts.

**Planned fix:** calibrate the view (for example a homography that maps the road plane to metres using a known reference distance), read the real frame rate from the video, smooth positions over several frames, and switch to a stronger tracker.

---

## Limitations

- The VisDrone model is trained on aerial views and will do worse on ordinary ground-level webcam footage.
- Recall is about 53%, so many objects are missed, especially small ones.
- SAHI finds more small objects but is too slow for 30 FPS live video, and its accuracy has not been measured on the full validation set.
- The centroid tracker is simple. IDs can switch when objects overlap or leave and re-enter the frame.
- Activity labels are heuristics based on motion, not a trained action-recognition model.
- Speed estimation and speeding alerts are not accurate yet.
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
