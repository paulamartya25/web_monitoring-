# VisionAI: Real-Time Object Detection Platform

[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-purple)](https://ultralytics.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docker.com)

VisionAI is a full-stack application for running YOLOv8 object detection on a live webcam stream, uploaded images, and uploaded videos. It also includes a simple object tracker, motion-based activity labels, an evaluation pipeline, and a YOLOv8s model fine-tuned on the VisDrone traffic dataset.

It is a portfolio project built to practise the whole path from model training to a deployed web interface. It is not a finished surveillance product.

---

## What it does

| Feature | Description |
| --- | --- |
| Live webcam detection | Streams frames over WebSocket and returns annotated detections |
| Image and video upload | Supports JPEG/PNG images and MP4/AVI/MOV videos, with an adjustable confidence threshold |
| Object tracking | Keeps a persistent ID per object across frames using a centroid tracker |
| Activity labels | Describes each tracked object (for example "walking" or "running") from its motion |
| Evaluation pipeline | Computes mAP, precision, recall, F1, ROC-AUC, confusion matrix, and PR curve on a dataset |
| Analytics dashboard | Shows detection history, class frequency, and CSV export |
| Docker and Codespaces | Runs with a single `docker-compose up` or inside GitHub Codespaces |

Two details worth knowing:

- The activity labels are heuristics based on tracked movement. They are not produced by a trained action-recognition model.
- The tracker matches objects by nearest centroid, so IDs can switch when objects overlap or leave and re-enter the frame.

---

## Fine-tuned model: VisDrone

I fine-tuned YOLOv8s on the [VisDrone](https://github.com/VisDrone/VisDrone-Dataset) dataset (10 classes: pedestrian, people, bicycle, car, van, truck, tricycle, awning-tricycle, bus, motor). Training was done in a separate Kaggle notebook: [web-monitor-py](https://www.kaggle.com/code/amartya02509/web-monitor-py).

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

Weights: [add the path or download link for `best.pt` here]. The `/model/reload` endpoint can load custom weights at runtime.

---

## Limitations

- Detection quality depends on the model. The VisDrone model is trained on aerial views and will do worse on ordinary ground-level webcam footage.
- Recall is about 53%, so a large share of objects are missed, especially small ones.
- The centroid tracker is simple and not designed for crowded scenes.
- There is no authentication or rate limiting, so it should not be exposed publicly as is.

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
├── experiments/             # [describe: experiment notes or runs]
├── evaluation/
│   ├── run_eval.py          # CLI evaluation script
│   └── datasets/            # Place datasets here
├── docker-compose.yml
└── .devcontainer/           # Codespaces config
```

---

## Roadmap

These are ideas, not features that exist yet:

- Zone-based intrusion alerts
- Speed estimation
- Small-object detection with tiled inference (SAHI)
- An ablation study across model sizes and settings
- Multi-camera support
- Stronger tracking (for example ByteTrack)
- API-key authentication and rate limiting

---

## Author

Amartya Paul. [GitHub](https://github.com/paulamartya25)
