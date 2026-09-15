#!/usr/bin/env python3
"""
VisionAI — YOLOv8 Fine-Tuning Script for Traffic/Road CCTV
===========================================================

Recommended dataset: VisDrone (CCTV/drone perspective)
Download: https://github.com/VisDrone/VisDrone-Dataset

Supports:
  - VisDrone (CCTV/drone, 10 classes including pedestrian, car, van, bus, truck)
  - BDD100K  (dashcam, 10 classes including traffic light, traffic sign)
  - Custom   (your own labeled dataset)

Usage:
  python fine_tune.py --dataset visdrone --epochs 50
  python fine_tune.py --dataset custom   --data-path ./my_data/data.yaml --epochs 100

Run on Google Colab (free T4 GPU):
  1. Upload this file to Colab
  2. Runtime → Change runtime type → T4 GPU
  3. !python fine_tune.py --dataset visdrone --epochs 50
"""

import argparse
import os
import sys
from pathlib import Path


def parse_args():
    p = argparse.ArgumentParser(description="VisionAI Fine-Tuning CLI")
    p.add_argument("--dataset",    default="visdrone",  choices=["visdrone", "bdd100k", "custom"])
    p.add_argument("--base-model", default="yolov8n",   choices=["yolov8n", "yolov8s", "yolov8m"])
    p.add_argument("--data-path",  default=None,        help="Path to data.yaml (required for --dataset custom)")
    p.add_argument("--epochs",     type=int, default=50)
    p.add_argument("--batch",      type=int, default=16)
    p.add_argument("--imgsz",      type=int, default=640)
    p.add_argument("--lr",         type=float, default=0.001)
    p.add_argument("--output-dir", default="./models/fine_tuned")
    p.add_argument("--resume",     action="store_true",  help="Resume from last checkpoint")
    return p.parse_args()


DATASET_CONFIGS = {
    "visdrone": {
        "yaml": "VisDrone.yaml",  # built into ultralytics
        "description": "VisDrone — 10 classes: pedestrian, people, bicycle, car, van, truck, tricycle, awning-tricycle, bus, motor",
        "classes": ["pedestrian", "people", "bicycle", "car", "van", "truck", "tricycle", "awning-tricycle", "bus", "motor"],
        "download_cmd": "# Auto-downloaded by ultralytics on first use",
    },
    "bdd100k": {
        "yaml": "bdd.yaml",  # note: requires manual download
        "description": "BDD100K — 10 classes including traffic lights, signs, vehicles, pedestrians",
        "classes": ["pedestrian", "rider", "car", "truck", "bus", "train", "motorcycle", "bicycle", "traffic light", "traffic sign"],
        "download_cmd": "# Download from: https://bdd-data.berkeley.edu/",
    },
}


def setup_visdrone_yaml():
    """Create VisDrone data.yaml if not using ultralytics built-in."""
    yaml_content = """
# VisDrone Dataset
# Source: https://github.com/VisDrone/VisDrone-Dataset
# Classes: pedestrian, people, bicycle, car, van, truck, tricycle, awning-tricycle, bus, motor

path: ./datasets/VisDrone  # dataset root
train: VisDrone2019-DET-train/images
val:   VisDrone2019-DET-val/images
test:  VisDrone2019-DET-test-dev/images

nc: 10
names:
  0: pedestrian
  1: people
  2: bicycle
  3: car
  4: van
  5: truck
  6: tricycle
  7: awning-tricycle
  8: bus
  9: motor
"""
    path = Path("./datasets/VisDrone/visdrone.yaml")
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(yaml_content.strip())
        print(f"  Created {path}")
    return str(path)


def main():
    args = parse_args()

    try:
        from ultralytics import YOLO
    except ImportError:
        print("Installing ultralytics...")
        os.system(f"{sys.executable} -m pip install ultralytics")
        from ultralytics import YOLO

    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\n{'='*60}")
    print(f"  VisionAI Fine-Tuning")
    print(f"  Base model : {args.base_model}")
    print(f"  Dataset    : {args.dataset}")
    print(f"  Epochs     : {args.epochs}")
    print(f"  Device     : {device.upper()}")
    print(f"{'='*60}\n")

    if device == "cpu":
        print("⚠️  WARNING: Training on CPU will be very slow.")
        print("    Recommended: Use Google Colab (free T4 GPU)")
        print("    → runtime.google.com/colab\n")

    # Determine data.yaml
    if args.dataset == "custom":
        if not args.data_path:
            print("ERROR: --data-path required for --dataset custom")
            sys.exit(1)
        data_yaml = args.data_path
    elif args.dataset == "visdrone":
        data_yaml = setup_visdrone_yaml()
        print("ℹ️  VisDrone dataset: place extracted dataset at ./datasets/VisDrone/")
        print("    Download: https://github.com/VisDrone/VisDrone-Dataset\n")
    else:
        data_yaml = DATASET_CONFIGS[args.dataset]["yaml"]

    # Load base model
    print(f"📦 Loading {args.base_model}.pt (pretrained on COCO)...")
    model = YOLO(f"{args.base_model}.pt")

    Path(args.output_dir).mkdir(parents=True, exist_ok=True)

    # ── Train ────────────────────────────────────────────────────────────
    print(f"\n🚀 Starting fine-tuning for {args.epochs} epochs...\n")
    results = model.train(
        data=data_yaml,
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
        lr0=args.lr,
        lrf=0.01,               # final lr = lr0 * lrf
        momentum=0.937,
        weight_decay=0.0005,
        warmup_epochs=3,
        patience=15,            # early stopping after 15 epochs no improvement
        device=device,
        project=args.output_dir,
        name=f"{args.base_model}_{args.dataset}",
        resume=args.resume,
        # Augmentations
        hsv_h=0.015, hsv_s=0.7, hsv_v=0.4,
        degrees=0.0,
        translate=0.1,
        scale=0.5,
        flipud=0.0,
        fliplr=0.5,
        mosaic=1.0,             # mosaic augmentation — critical for small objects
        mixup=0.0,
        copy_paste=0.0,
        # Traffic-specific: small objects (vehicles/pedestrians far away)
        # Increase multi-scale training
        rect=False,             # allow multi-scale
        verbose=True,
        plots=True,             # save training plots
    )

    # ── Export ───────────────────────────────────────────────────────────
    best_model_path = os.path.join(args.output_dir, f"{args.base_model}_{args.dataset}", "weights", "best.pt")

    if os.path.exists(best_model_path):
        print(f"\n✅ Training complete!")
        print(f"   Best model: {best_model_path}")
        print(f"   mAP@0.5:   {results.results_dict.get('metrics/mAP50(B)', 'N/A'):.4f}")
        print(f"   mAP@0.5:95:{results.results_dict.get('metrics/mAP50-95(B)', 'N/A'):.4f}")

        # Copy best model to models/ directory for the app to use
        import shutil
        dest = f"./models/{args.base_model}_{args.dataset}_best.pt"
        shutil.copy(best_model_path, dest)
        print(f"\n📁 Model saved to: {dest}")
        print(f"\n💡 To use this model in VisionAI:")
        print(f"   Edit .env → MODEL_SIZE={args.base_model}_{args.dataset}_best")
        print(f"   Or via API: POST /model/reload?model_size={args.base_model}_{args.dataset}_best")

        # Optional: export to ONNX for deployment
        print(f"\n🔧 Exporting to ONNX for edge deployment...")
        try:
            model_best = YOLO(best_model_path)
            model_best.export(format="onnx", dynamic=True, simplify=True)
            print(f"   ONNX model: {best_model_path.replace('.pt', '.onnx')}")
        except Exception as e:
            print(f"   ONNX export skipped: {e}")
    else:
        print("⚠️  Training may have been interrupted. Check output directory.")


if __name__ == "__main__":
    main()
