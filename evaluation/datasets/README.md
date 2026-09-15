# Datasets Directory

Place your dataset files here for evaluation.

## Supported Formats

### 1. COCO128 (Auto-Downloaded)
YOLOv8 automatically downloads COCO128 on first use. Just run:
```bash
python run_eval.py --dataset coco128
```

### 2. Full COCO val2017
Download from [https://cocodataset.org](https://cocodataset.org) and run:
```bash
python run_eval.py --dataset coco
```

### 3. Custom Dataset (YOLO Format)
Organize your dataset like:
```
datasets/
  my_dataset/
    images/
      train/  ← training images
      val/    ← validation images
    labels/
      train/  ← .txt label files (one per image)
      val/
    data.yaml ← dataset config file
```

**data.yaml format:**
```yaml
path: ./datasets/my_dataset
train: images/train
val: images/val
nc: 3                         # number of classes
names: ['cat', 'dog', 'car']  # class names
```

Then run:
```bash
python run_eval.py --dataset custom --data-path ./datasets/my_dataset/data.yaml
```

## Label Format (YOLO txt)
Each `.txt` label file has one row per object:
```
<class_id> <x_center> <y_center> <width> <height>
```
All values are normalized 0–1 relative to image dimensions.

## Output
After evaluation, reports are saved to `reports/eval_<timestamp>/`:
- `metrics.json` — all metric values
- `confusion_matrix.png` — normalized class confusion heatmap
- `roc_curve.png` — ROC-AUC curves per class
- `pr_curve.png` — Precision-Recall curves per class
- `f1_curve.png` — F1 vs Confidence threshold
