"""
experiments/sahi_integration.py
SAHI (Slicing Aided Hyper Inference) integration for small object detection.
Significant improvement for CCTV/drone footage with tiny objects.

Usage:
  python experiments/sahi_integration.py --image path/to/image.jpg
  python experiments/sahi_integration.py --benchmark  (compare SAHI vs normal)
"""
import argparse, os, time, torch
from pathlib import Path


def install_sahi():
    import subprocess, sys
    subprocess.run([sys.executable, '-m', 'pip', 'install', 'sahi', '-q'])


def run_sahi_inference(model_path: str, image_path: str, output_dir: str = "sahi_output"):
    """Run SAHI sliced inference on an image."""
    from sahi import AutoDetectionModel
    from sahi.predict import get_sliced_prediction

    os.makedirs(output_dir, exist_ok=True)
    device = "cuda" if torch.cuda.is_available() else "cpu"

    print(f"🔍 Loading model: {model_path}")
    detection_model = AutoDetectionModel.from_pretrained(
        model_type='ultralytics',
        model_path=model_path,
        confidence_threshold=0.25,
        device=device,
    )

    print(f"🔪 Running sliced inference (512×512 patches, 20% overlap)...")
    start = time.time()
    result = get_sliced_prediction(
        image_path,
        detection_model,
        slice_height=512,
        slice_width=512,
        overlap_height_ratio=0.2,
        overlap_width_ratio=0.2,
        perform_standard_pred=True,   # also run full-image prediction
        postprocess_type="NMM",       # Non-Maximum Merging
        postprocess_match_threshold=0.5,
        verbose=False,
    )
    elapsed = time.time() - start

    print(f"\n✅ SAHI Results:")
    print(f"   Detections: {len(result.object_prediction_list)}")
    print(f"   Time:       {elapsed:.2f}s")

    # Count by class
    class_counts = {}
    for pred in result.object_prediction_list:
        cls = pred.category.name
        class_counts[cls] = class_counts.get(cls, 0) + 1

    print(f"\n   Detections by class:")
    for cls, count in sorted(class_counts.items(), key=lambda x: -x[1]):
        print(f"     {cls:20s}: {count}")

    result.export_visuals(export_dir=output_dir, file_name="sahi_result")
    print(f"\n📁 Annotated image saved to: {output_dir}/sahi_result.png")
    return result


def benchmark_sahi_vs_normal(model_path: str, image_path: str):
    """Compare standard inference vs SAHI — for ablation table."""
    from ultralytics import YOLO
    from sahi import AutoDetectionModel
    from sahi.predict import get_sliced_prediction

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\n{'='*55}")
    print(f"  SAHI vs Standard Inference Benchmark")
    print(f"{'='*55}")

    # ── Standard inference ────────────────────────────────────
    model = YOLO(model_path)
    times = []
    for _ in range(5):
        start = time.time()
        results = model.predict(image_path, conf=0.25, device=device, verbose=False)
        times.append(time.time() - start)

    std_detections = len(results[0].boxes)
    std_time       = sum(times) / len(times)
    std_fps        = round(1 / std_time, 1)

    print(f"\n  Standard Inference:")
    print(f"    Detections: {std_detections}")
    print(f"    Time:       {std_time*1000:.1f}ms")
    print(f"    FPS:        {std_fps}")

    # ── SAHI inference ────────────────────────────────────────
    detection_model = AutoDetectionModel.from_pretrained(
        model_type='ultralytics',
        model_path=model_path,
        confidence_threshold=0.25,
        device=device,
    )

    times = []
    for _ in range(3):
        start = time.time()
        result = get_sliced_prediction(
            image_path, detection_model,
            slice_height=512, slice_width=512,
            overlap_height_ratio=0.2, overlap_width_ratio=0.2,
            verbose=False,
        )
        times.append(time.time() - start)

    sahi_detections = len(result.object_prediction_list)
    sahi_time       = sum(times) / len(times)
    sahi_fps        = round(1 / sahi_time, 1)

    print(f"\n  SAHI Sliced Inference:")
    print(f"    Detections: {sahi_detections}")
    print(f"    Time:       {sahi_time*1000:.1f}ms")
    print(f"    FPS:        {sahi_fps}")

    improvement = round((sahi_detections - std_detections) / max(std_detections, 1) * 100, 1)
    fps_cost    = round((std_fps - sahi_fps) / std_fps * 100, 1)

    print(f"\n  Summary:")
    print(f"    Detection improvement: +{improvement}%")
    print(f"    FPS cost:              -{fps_cost}%")
    print(f"\n  {'='*53}")
    print(f"  → SAHI finds {improvement}% more objects at {fps_cost}% FPS cost")
    print(f"  {'='*53}")

    return {
        "standard": {"detections": std_detections, "fps": std_fps, "ms": round(std_time*1000,1)},
        "sahi":     {"detections": sahi_detections, "fps": sahi_fps, "ms": round(sahi_time*1000,1)},
        "improvement_pct": improvement,
        "fps_cost_pct": fps_cost,
    }


if __name__ == "__main__":
    install_sahi()

    parser = argparse.ArgumentParser()
    parser.add_argument("--model",     default="models/yolov8n_visdrone_best.pt")
    parser.add_argument("--image",     default=None)
    parser.add_argument("--benchmark", action="store_true")
    args = parser.parse_args()

    if args.benchmark and args.image:
        benchmark_sahi_vs_normal(args.model, args.image)
    elif args.image:
        run_sahi_inference(args.model, args.image)
    else:
        print("Usage:")
        print("  python experiments/sahi_integration.py --image road.jpg")
        print("  python experiments/sahi_integration.py --image road.jpg --benchmark")
