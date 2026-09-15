# 🎯 VisionAI — Real-Time Object Detection Platform

[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-purple)](https://ultralytics.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwindcss)](https://tailwindcss.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

> A **production-grade, full-stack real-time object detection platform** powered by YOLOv8.  
> Supports live webcam streaming, image/video file upload, per-object activity description (like CCTV analytics), and a full ML evaluation pipeline.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎥 **Live Webcam** | Real-time detection at 10–30 FPS via WebSocket stream |
| 📁 **File Upload** | Detect in images (JPEG/PNG) and videos (MP4/AVI/MOV) |
| 🧠 **Activity Labels** | Per-object behavior: "Walking", "Running", "Interacting" — like CCTV |
| 🔭 **Object Tracking** | Persistent IDs across frames using centroid tracker |
| 📊 **Evaluation Pipeline** | mAP, F1, Precision, Recall, ROC-AUC, Confusion Matrix on datasets |
| 📈 **Analytics Dashboard** | Detection history charts, class frequency, CSV export |
| 🐳 **Docker Ready** | Single `docker-compose up` command |
| ☁️ **Codespaces Ready** | Develop in browser with GitHub Codespaces |

---

## 🚀 Quick Start

### Option A — GitHub Codespaces (Recommended, No Installation)

1. Push this repo to GitHub
2. Click **Code → Open in Codespaces**
3. Wait for setup (auto-installs dependencies)
4. In terminal:
   ```bash
   docker-compose up
   ```
5. Open the forwarded port 3000 → **Your app is live in the browser!**

---

### Option B — Docker (Local)

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/visionai.git
cd visionai

# 2. Copy environment variables
cp .env.example .env

# 3. Start everything
docker-compose up --build

# App: http://localhost:3000
# API: http://localhost:8000/docs
```

---

### Option C — Local Development (No Docker)

**Backend:**
```bash
cd backend
pip install -r requirements.txt
cp ../.env.example .env
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## 📋 Usage

### Live Webcam Detection
1. Open `/live` in the browser
2. Click **Start Detection**
3. Grant camera permission
4. See bounding boxes + activity labels in real time!

### Upload Image / Video
1. Open `/upload`
2. Drag & drop an image or video
3. Adjust confidence threshold
4. Click **Detect Objects**
5. Download annotated video or view annotated image inline

### Evaluate on a Dataset
```bash
# Quick test (128 COCO images, auto-downloaded)
python evaluation/run_eval.py --dataset coco128

# Custom dataset
python evaluation/run_eval.py --dataset custom --data-path ./evaluation/datasets/my_data/data.yaml

# Choose model
python evaluation/run_eval.py --dataset coco128 --model yolov8s
```

**Metrics generated:** mAP@0.5, mAP@0.5:0.95, Precision, Recall, F1, Confusion Matrix, ROC-AUC, PR Curve

---

## 🌐 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/detect/image` | Detect objects in an uploaded image |
| `POST` | `/detect/video` | Detect objects in an uploaded video |
| `GET` | `/detect/log` | Get detection history (paginated) |
| `WS` | `/ws/stream` | Live webcam WebSocket stream |
| `POST` | `/evaluate/run` | Start dataset evaluation |
| `GET` | `/evaluate/results` | List evaluation runs |
| `GET` | `/evaluate/chart/{id}/{type}` | Get chart image (confusion_matrix, roc_curve, pr_curve) |
| `GET` | `/health` | Health check + model info |
| `POST` | `/model/reload` | Hot-swap YOLOv8 model at runtime |

Full interactive docs: **http://localhost:8000/docs**

---

## 📁 Project Structure

```
real_time_object_detection/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── core/
│   │   ├── detector.py      # YOLOv8 inference wrapper
│   │   ├── tracker.py       # Centroid object tracker
│   │   ├── activity.py      # Behavior description engine
│   │   └── evaluator.py     # ML metrics engine
│   ├── routers/
│   │   ├── detect.py        # Image + video endpoints
│   │   ├── stream.py        # WebSocket stream
│   │   └── evaluate.py      # Evaluation endpoints
│   └── utils/               # Drawing, video processing
│
├── frontend/
│   └── src/
│       ├── pages/           # LiveStream, Upload, Evaluate, Dashboard
│       └── components/      # Navbar, ActivityBadge, MetricsCard, ModelSelector
│
├── evaluation/
│   ├── run_eval.py          # CLI evaluation script
│   └── datasets/            # Place dataset files here
│
├── docker-compose.yml
└── .devcontainer/           # GitHub Codespaces config
```

---

## 🏭 Industrial Extensions Roadmap

| Feature | How to Add |
|---|---|
| **Multi-camera** | Separate WebSocket channel per camera ID |
| **Intrusion alerts** | Zone config → email/webhook on boundary crossing |
| **PPE detection** | Fine-tune YOLOv8 on helmet/vest dataset |
| **Edge deployment** | `model.export(format='tensorrt')` → Jetson Nano |
| **Cloud deploy** | Docker → GCP Cloud Run / AWS ECS / Railway.app |
| **PDF reports** | Add reportlab/weasyprint for detection report export |
| **SaaS API** | Add API key auth + rate limiting middleware |

---

## 📄 License

MIT © 2026 VisionAI
