# VisionAI: Real-Time Object Detection and Traffic Analysis Platform

[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-purple)](https://ultralytics.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwindcss)](https://tailwindcss.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docker.com)

VisionAI is a full-stack application that runs YOLOv8 object detection on a live webcam stream, uploaded images, and uploaded videos. It detects vehicles, pedestrians, and cyclists, tracks them across frames, and includes a YOLOv8s model fine-tuned on the VisDrone dataset, an evaluation pipeline, small-object detection with SAHI, and an ablation study.

It is a portfolio project built to practise the full path from model training to a working web interface. It is a prototype, not a finished surveillance product. Parts that are incomplete are marked clearly below.

---

## Features

| Feature | Status | Description |
| --- | --- | --- |
| Live webcam detection | Working | Streams frames over WebSocket and returns annotated detections |
| Image and video upload | Working | JPEG/PNG images and MP4/AVI/MOV videos, adjustable confidence threshold |
| Fine-tuned VisDrone model | Working | YOLOv8s trained on 10 traffic-related classes (see results below) |
| Small-object detection (SAHI) | Working | Tiled inference to catch small objects a single pass misses |
| Ablation study | Done | Compares the effect of key settings on detection quality |
| Object tracking | Working | Persistent IDs across frames using a centroid tracker |
| Activity labels | Working (heuristic) | Describes tracked objects from their motion, not from a trained model |
| Evaluation pipeline | Working | mAP, precision, recall, F1, ROC-AUC, confusion matrix, PR curve |
| Analytics dashboard | Working | Detection history, class frequency, CSV export |
| Speed estimation | Experimental | Implemented but not yet accurate (see below) |
| Docker and Codespaces | Working | One-command setup |

---

## Fine-tuned model: VisDrone

I fine-tuned YOLOv8s on the [VisDrone](https://github.com/VisDrone/VisDrone-Dataset) dataset, which has 10 classes: pedestrian, people, bicycle, car, van, truck, tricycle, awning-tricycle, bus, and motor. Training was done in a separate Kaggle notebook: [web-monitor-py](https://www.kaggle.com/code/amartya02509/web-monitor-py).

| Setting / metric | Value |
| --- | --- |
| Epochs | 81 |
| Hardware and time | Tesla T4, about 8.4 hours |
| mAP@0.5 | 56.01% |
| mAP@0.5:0.95 | 34.3% |
| Precision | 64.10% |
| Recall | 53.18% |
| Inference speed | about 9.7 ms per image (as reported in the notebook) |

Per-class results vary a lot. Cars are detected best (mAP@0.5 of 88.6%). Awning-tricycles are weakest (23.3%). Small and crowded objects are the main difficulty, which is typical for drone imagery.

Weights: [add the path or download link for `best.pt`]. The `/model/reload` endpoint can load custom weights at runtime.

---

## Small-object detection with SAHI

Aerial and CCTV footage contains many small objects that a standard single-pass detector misses. I added [SAHI](https://github.com/obss/sahi) (Slicing Aided Hyper Inference). It splits each frame into overlapping tiles, runs detection on each tile, and merges the results.

| Setting | Value |
| --- | --- |
| Tile size | [e.g. 640 x 640] |
| Overlap | [e.g. 20%] |
| Merge method | [e.g. NMS, IoU threshold] |

| Method | mAP@0.5 | Recall | Time per image |
| --- | --- | --- | --- |
| Standard inference | [ ] | [ ] | [ ] |
| With SAHI | [ ] | [ ] | [ ] |

[Two sentences on what you found, for example the change in recall on small objects and the cost in speed.]

How to use it: [command or API option, and where the code lives]

---

## Ablation study

I compared the effect of [the factors you varied, e.g. model size, input resolution, confidence threshold, augmentation, SAHI on or off] on [dataset split].

| Experiment | Change | mAP@0.5 | mAP@0.5:0.95 | Notes |
| --- | --- | --- | --- | --- |
| Baseline | YOLOv8s, default settings | [ ] | [ ] | |
| [Variant 1] | [ ] | [ ] | [ ] | |
| [Variant 2] | [ ] | [ ] | [ ] | |

Main findings: [two or three plain sentences on what helped, what did not, and why].

Code and logs: `experiments/` [confirm path]

---

## Speed estimation (experimental)

The project includes a first attempt at estimating object speed from tracked movement. It does **not** currently give reliable results, so treat any speed value it shows as indicative only.

**How it works:** the tracker follows each object across frames, and speed is calculated from the distance moved between frames and the video frame rate.

**Known problems:**

- [Describe what you actually see, for example speeds that are too high or low, or values that jump between frames.]
- Pixel distance is converted to real distance with [describe: a fixed scale / no calibration].
- Object IDs from the centroid tracker can switch, which breaks the distance calculation.

**Planned fix:** calibrate the camera view (for example a homography that maps the road plane to metres using a known reference distance), smooth positions over several frames, and switch to a stronger tracker.

---

## Limitations

- The VisDrone model is trained on aerial views and will do worse on ordinary ground-level webcam footage.
- Recall is about 53%, so many objects are missed, especially small ones.
- The centroid tracker is simple. IDs can switch when objects overlap or leave and re-enter the frame.
- Activity labels are heuristics based on motion, not a trained action-recognition model.
- Speed estimation is not accurate yet.
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
│   ├── main.py              # FastAPI app
│   ├── core/
│   │   ├── detector.py      # YOLOv8 inference wrapper
│   │   ├── tracker.py       # Centroid tracker
│   │   ├── activity.py      # Motion-based activity labels
│   │   └── evaluator.py     # Metrics
│   ├── routers/             # detect, stream, evaluate endpoints
│   └── utils/               # Drawing and video helpers
├── frontend/
│   └── src/                 # Pages (Live, Upload, Evaluate, Dashboard) and components
├── training/                # [describe: fine-tuning code and configs]
├── experiments/             # [describe: ablation and SAHI experiments]
├── evaluation/
│   ├── run_eval.py          # CLI evaluation script
│   └── datasets/            # Place datasets here
├── docker-compose.yml
└── .devcontainer/           # Codespaces config
```

---

## Roadmap

These are ideas, not existing features:

- Fix and calibrate speed estimation
- Zone-based intrusion alerts
- Stronger tracking (for example ByteTrack)
- Multi-camera support
- API-key authentication and rate limiting

---

## Author

Amartya Paul. [GitHub](https://github.com/paulamartya25)
