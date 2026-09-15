# VisionAI — Training Guide

## Fine-Tuning YOLOv8 for Road/Traffic Detection

### Recommended Datasets

| Dataset | Classes | Images | Best For |
|---|---|---|---|
| **VisDrone** | pedestrian, car, van, bus, truck, bicycle, motor (10) | 10K | CCTV/drone camera |
| **BDD100K** | person, car, truck, bus, traffic light, sign (10) | 100K | Dashcam / street level |
| **UA-DETRAC** | car, bus, van, others | 140K frames | CCTV vehicle tracking |

---

### Option A — Google Colab (Recommended, Free GPU)

1. Go to [colab.research.google.com](https://colab.research.google.com)
2. Upload `fine_tune.py` and your dataset
3. Set **Runtime → T4 GPU**
4. Run:
```python
!pip install ultralytics
!python fine_tune.py --dataset visdrone --epochs 50
```

---

### Option B — Local (If You Have GPU)
```bash
pip install ultralytics
python fine_tune.py --dataset visdrone --epochs 50 --batch 16
```

---

### Download VisDrone Dataset
```bash
# Images (~1.4GB)
wget https://github.com/VisDrone/VisDrone-Dataset
# Or from official Google Drive links in the repo README
```

Organize as:
```
datasets/VisDrone/
  VisDrone2019-DET-train/
    images/
    annotations/
  VisDrone2019-DET-val/
    images/
    annotations/
```

---

### Expected Results After Fine-Tuning

| Model | Pretrained COCO | Fine-tuned VisDrone |
|---|---|---|
| yolov8n | ~37% mAP | ~65–70% mAP |
| yolov8s | ~44% mAP | ~70–75% mAP |
| yolov8m | ~50% mAP | ~75–80% mAP |

---

### Use Fine-Tuned Model in VisionAI
After training, copy `best.pt` to the `models/` folder and update `.env`:
```
MODEL_SIZE=yolov8n_visdrone_best
```
Or hot-swap at runtime via the API:
```
POST /model/reload?model_size=yolov8n_visdrone_best
```
