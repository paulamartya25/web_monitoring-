# 🎯 VisionAI — Real-Time Traffic Surveillance Platform

[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-purple)](https://ultralytics.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Tests](https://img.shields.io/badge/Tests-51%20passing-brightgreen)](tests/)
[![CI](https://github.com/paulamartya25/web_monitoring-/actions/workflows/ci.yml/badge.svg)](https://github.com/paulamartya25/web_monitoring-/actions/workflows/ci.yml)
[![mAP](https://img.shields.io/badge/mAP%400.5-56.01%25-blue)](experiments/ablation_results.csv)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

> Real-time traffic surveillance system using a custom fine-tuned YOLOv8s model on VisDrone2019 — **56% mAP@0.5**, 81 epochs, 10 object classes.

---

## 🧠 Machine Learning & Deep Learning

- **YOLOv8 (You Only Look Once v8)** — Single-stage real-time object detection architecture
- **Transfer Learning** — Fine-tuned pretrained YOLOv8n/s weights on domain-specific VisDrone dataset
- **Custom Dataset Training** — VisDrone2019-DET (38,759 annotated instances, 10 traffic classes)
- **Multi-scale Training** — 640×640 and 1280×1280 input resolution experiments
- **Data Augmentation** — Mosaic, flipping, scaling, HSV jitter during training
- **Early Stopping** — Training halted at 81 epochs based on validation mAP plateau
- **Ablation Study** — 4-configuration systematic experiment (A1–A4) measuring impact of model size and resolution
- **mAP@0.5 / mAP@0.5:0.95** — Standard COCO-style object detection evaluation metrics
- **Precision, Recall, F1-Score** — Per-class and overall model performance metrics
- **Confusion Matrix** — Class-level prediction error analysis
- **PR Curve (Precision-Recall Curve)** — Threshold-independent model performance visualization
- **ROC-AUC** — One-vs-rest per-class confidence score ranking quality
- **Confidence Thresholding** — Post-processing filter to suppress low-confidence detections
- **IoU (Intersection over Union)** — Bounding box overlap metric used in NMS and evaluation
- **NMS (Non-Maximum Suppression)** — Removes duplicate bounding boxes for the same object

---

## 👁️ Computer Vision

- **Bounding Box Regression** — Predicting [x1, y1, x2, y2] coordinates for detected objects
- **BGR ↔ RGB Conversion** — OpenCV reads BGR; YOLOv8 expects RGB input
- **JPEG Base64 Encoding** — Encoding annotated frames as base64 strings for WebSocket transmission
- **Frame Sampling** — Sending every Nth frame over WebSocket to control bandwidth
- **Centroid Tracking** — Persistent object ID assignment across frames using Euclidean distance
- **Hungarian Algorithm (greedy)** — Optimal assignment of detected objects to existing tracks
- **Cosine/Euclidean Distance** — Measuring centroid proximity for track association (scipy)
- **Displacement Vector** — Per-object pixel movement between frames used for activity estimation
- **Aspect Ratio Preservation** — Letterboxing input frames before inference
- **Annotated Frame Rendering** — Drawing bounding boxes, class labels, confidence scores with OpenCV
- **SAHI (Sliced Inference)** — Tiled inference for small object detection in high-resolution images

---

## 🔄 Object Tracking & Behavior Analysis

- **Multi-Object Tracking (MOT)** — Maintaining consistent IDs for multiple objects across video frames
- **Track History (Deque)** — Sliding window of recent centroids (maxlen=30) per track ID
- **Track Deregistration** — Removing lost tracks after `max_disappeared` frames
- **Rule-Based Activity Classification** — Pixel displacement thresholds map to Stationary / Walking / Running / Speeding / Parked
- **Class-Aware Activity Labels** — Vehicles get "Moving/Parked/Speeding"; pedestrians get "Walking/Running/Standing"
- **Proximity Detection** — Euclidean distance between centroids to detect interacting objects
- **Illegal Parking Detection** — Tracking consecutive stopped frames > threshold (2 seconds)
- **Vehicle Counting** — Line-crossing event detection using centroid Y-coordinate comparison
- **Zone Monitoring** — Polygon-based region of interest alerting

---

## ⚙️ Backend & API Engineering

- **FastAPI** — Async Python web framework for REST API and WebSocket endpoints
- **WebSocket Protocol** — Full-duplex bidirectional communication for real-time video streaming
- **Async/Await (asyncio)** — Non-blocking I/O for concurrent frame processing
- **Pydantic Settings** — Type-safe configuration loading from `.env` file
- **Dependency Injection** — FastAPI's `app.state` for sharing detector/tracker across requests
- **Lifespan Context Manager** — Model loading on startup, cleanup on shutdown
- **HTTP Middleware** — API key authentication middleware protecting all routes
- **CORS Middleware** — Cross-Origin Resource Sharing for frontend-backend communication
- **SQLAlchemy (Async)** — ORM for asynchronous database operations
- **aiosqlite** — Async SQLite driver for detection history persistence
- **Multipart File Upload** — `python-multipart` for image/video file ingestion
- **Static File Serving** — FastAPI StaticFiles for serving uploaded/annotated media
- **Hot Model Reload** — Swapping YOLOv8 model at runtime without server restart
- **Request Logging** — Structured logging with timestamps and log levels

---

## 🖥️ Frontend Engineering

- **React 18** — Component-based UI with hooks (`useState`, `useEffect`, `useRef`, `useCallback`)
- **Vite** — Fast build tool and dev server with HMR (Hot Module Replacement)
- **Tailwind CSS** — Utility-first CSS for responsive dark-theme UI
- **WebSocket Client** — Browser-native WebSocket API for live frame streaming
- **Canvas API** — `HTMLCanvasElement` for rendering annotated frames in real time
- **requestAnimationFrame (RAF)** — Smooth 60fps frame capture loop from webcam
- **MediaDevices API** — `getUserMedia()` for webcam access in the browser
- **Axios** — HTTP client for REST API calls with upload progress tracking
- **React Dropzone** — Drag-and-drop file upload component
- **Base64 Blob Download** — Converting base64 annotated image to downloadable file
- **Environment Variables (Vite)** — `VITE_API_BASE` / `VITE_WS_BASE` for cloud vs local config
- **Lucide React** — Icon library for UI elements

---

## 📊 Evaluation & Metrics Pipeline

- **model.val()** — Ultralytics built-in validation for mAP computation on dataset
- **scikit-learn Metrics** — `confusion_matrix`, `precision_recall_curve`, `roc_curve`, `auc`, `f1_score`
- **Per-Class Evaluation** — Metrics computed independently for each of the 10 VisDrone classes
- **CSV Export** — Ablation results saved to `experiments/ablation_results.csv`
- **Matplotlib / Seaborn** — Confusion matrix heatmap, PR curve, ROC-AUC chart generation

---

## 🗄️ Data & Storage

- **SQLite** — Lightweight embedded relational database for detection history
- **Async SQLAlchemy ORM** — Detection and EvaluationRun table models
- **VisDrone2019-DET** — Aerial drone dataset: 10 classes, 288 video sequences, 261,908 frames
- **YAML Dataset Config** — Ultralytics data.yaml format specifying train/val/test paths and class names
- **Model Checkpointing** — `best.pt` saved at peak validation mAP during training

---

## 🔧 Software Engineering

- **Centroid Tracker (col→oid mapping)** — Correct Hungarian match-based ID assignment (fixed index-based bug)
- **Unit Testing (pytest)** — 51 tests across tracker, traffic analyzer, zone config modules
- **Test Isolation** — Each test creates fresh component instances; no shared state
- **Continuous Integration (GitHub Actions)** — Auto-runs 51 tests on every push to master
- **Dockerization** — `Dockerfile` for backend containerization
- **Docker Compose** — Multi-service orchestration (backend + frontend)
- **Git Commit Discipline** — Conventional commits (`feat:`, `fix:`, `docs:`, `ci:`, `chore:`)
- **Environment Separation** — `.env.development` vs `.env.production` for local/cloud config
- **API Key Auth Middleware** — Optional `X-API-Key` header protection (enabled via `.env`)
- **`.gitignore`** — Excludes venv, `__pycache__`, uploads, DB files

---

## ☁️ Deployment & DevOps

- **Vercel** — Frontend CDN deployment with automatic GitHub integration
- **Oracle Cloud Always Free** — ARM VM (4 vCPU, 24GB RAM) for backend hosting
- **Docker on Cloud** — Containerized backend deployment with `--restart unless-stopped`
- **SCP (Secure Copy)** — Transferring model `.pt` files to cloud VM over SSH
- **iptables** — Firewall rule to open port 8000 on Oracle Cloud Ubuntu VM
- **GitHub Actions CI** — `ubuntu-latest` runner, Python 3.11, pip cache, pytest

---

## ⚠️ Known Limitations

| Limitation | Detail |
|---|---|
| **Domain mismatch** | VisDrone models trained on aerial footage — accuracy drops on ground-level webcam |
| **Speed not calibrated** | `~X km/h` = relative pixel displacement × empirical scale, NOT true speed |
| **Activity labels** | Rule-based pixel displacement thresholds — not pose estimation |
| **SQLite** | Not suitable for high-concurrency production; PostgreSQL recommended |
| **mAP ceiling** | VisDrone SOTA is ~70%+ with SAHI + transformers; our 56% is a strong baseline |

---

MIT © 2026 Amartya Paul
