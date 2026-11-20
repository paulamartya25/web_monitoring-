import os
import json
import time
import logging
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from core.config import settings
from core.evaluator import ModelEvaluator
from db.database import get_db
from db.models import EvaluationRun

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/evaluate", tags=["evaluation"])


async def _run_evaluation_task(run_id: int, dataset_name: str, model_size: str, data_yaml: str | None, db_url: str):
    """Background task to run evaluation and update DB record."""
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from db.models import EvaluationRun

    engine = create_async_engine(db_url)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as session:
        try:
            # Mark as running
            result = await session.execute(select(EvaluationRun).where(EvaluationRun.id == run_id))
            run = result.scalar_one_or_none()
            if not run:
                return
            run.status = "running"
            await session.commit()

            # Run evaluation
            evaluator = ModelEvaluator()
            metrics = evaluator.evaluate_dataset(
                dataset_name=dataset_name,
                model_size=model_size,
                data_yaml=data_yaml,
            )

            # Update record with results
            run.status = "completed"
            run.map50 = metrics["map50"]
            run.map5095 = metrics["map5095"]
            run.precision = metrics["precision"]
            run.recall = metrics["recall"]
            run.f1_score = metrics["f1_score"]
            run.report_path = metrics["output_dir"]
            await session.commit()

        except Exception as e:
            logger.error(f"Evaluation task failed: {e}")
            result = await session.execute(select(EvaluationRun).where(EvaluationRun.id == run_id))
            run = result.scalar_one_or_none()
            if run:
                run.status = "failed"
                run.error_message = str(e)
                await session.commit()

        finally:
            await engine.dispose()


@router.post("/run")
async def start_evaluation(
    request: Request,
    background_tasks: BackgroundTasks,
    dataset_name: str = Query(default="coco128"),
    model_size: str = Query(default="yolov8n"),
    data_yaml: str = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Kick off a dataset evaluation run (runs in background)."""
    allowed_models = {"yolov8n", "yolov8s", "yolov8s_visdrone_best"}
    if model_size not in allowed_models:
        raise HTTPException(status_code=400, detail=f"Invalid model. Choose from: {allowed_models}")

    # ── Dataset / model compatibility check ───────────────────────────
    # The VisDrone model has 10 aerial classes; COCO has 80 different classes.
    # Evaluating across incompatible datasets gives meaningless metrics.
    VISDRONE_MODEL   = model_size == "yolov8s_visdrone_best"
    VISDRONE_DATASET = dataset_name == "visdrone"
    COCO_DATASET     = dataset_name in ("coco128", "coco")

    if VISDRONE_MODEL and COCO_DATASET:
        raise HTTPException(
            status_code=400,
            detail=(
                "Dataset mismatch: 'YOLOv8s VisDrone Best' was trained on VisDrone "
                "(10 aerial traffic classes) and cannot be meaningfully evaluated on "
                "COCO (80 different classes). "
                "Please select a COCO pretrained model (YOLOv8n or YOLOv8s) for COCO datasets, "
                "or the evaluation will produce scientifically invalid results."
            )
        )
    if not VISDRONE_MODEL and VISDRONE_DATASET:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Dataset mismatch: '{model_size}' is a COCO pretrained model (80 classes) "
                "and cannot be meaningfully evaluated on VisDrone (10 different aerial classes). "
                "Select 'YOLOv8s VisDrone — Best' to evaluate on VisDrone, "
                "or switch to COCO128 / COCO val2017."
            )
        )

    # Create pending DB record
    run = EvaluationRun(
        dataset_name=dataset_name,
        model_size=model_size,
        status="pending",
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    background_tasks.add_task(
        _run_evaluation_task,
        run.id,
        dataset_name,
        model_size,
        data_yaml,
        settings.DATABASE_URL,
    )

    return {
        "run_id": run.id,
        "status": "pending",
        "message": f"Evaluation started for {dataset_name} with {model_size}. Poll /evaluate/results/{run.id} for status.",
    }


@router.get("/results")
async def list_evaluation_results(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=20),
):
    """List all evaluation runs."""
    result = await db.execute(
        select(EvaluationRun).order_by(desc(EvaluationRun.timestamp)).limit(limit)
    )
    rows = result.scalars().all()
    return {
        "runs": [
            {
                "id": r.id,
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "dataset_name": r.dataset_name,
                "model_size": r.model_size,
                "status": r.status,
                "map50": r.map50,
                "map5095": r.map5095,
                "precision": r.precision,
                "recall": r.recall,
                "f1_score": r.f1_score,
                "error_message": r.error_message,
            }
            for r in rows
        ]
    }


@router.get("/results/{run_id}")
async def get_evaluation_result(run_id: int, db: AsyncSession = Depends(get_db)):
    """Get details + chart paths for a specific evaluation run."""
    result = await db.execute(select(EvaluationRun).where(EvaluationRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Evaluation run not found.")

    charts = {}
    if run.report_path and os.path.isdir(run.report_path):
        for chart in ["confusion_matrix", "roc_curve", "pr_curve"]:
            chart_path = os.path.join(run.report_path, f"{chart}.png")
            if os.path.exists(chart_path):
                charts[chart] = f"/evaluate/chart/{run_id}/{chart}"

    return {
        "id": run.id,
        "timestamp": run.timestamp.isoformat() if run.timestamp else None,
        "dataset_name": run.dataset_name,
        "model_size": run.model_size,
        "status": run.status,
        "map50": run.map50,
        "map5095": run.map5095,
        "precision": run.precision,
        "recall": run.recall,
        "f1_score": run.f1_score,
        "error_message": run.error_message,
        "report_path": run.report_path,
        "charts": charts,
    }


@router.get("/chart/{run_id}/{chart_type}")
async def get_chart(run_id: int, chart_type: str, db: AsyncSession = Depends(get_db)):
    """Serve a chart image for an evaluation run."""
    allowed_charts = {"confusion_matrix", "roc_curve", "pr_curve"}
    if chart_type not in allowed_charts:
        raise HTTPException(status_code=400, detail=f"chart_type must be one of {allowed_charts}")

    result = await db.execute(select(EvaluationRun).where(EvaluationRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run or not run.report_path:
        raise HTTPException(status_code=404, detail="Run not found or report not generated.")

    chart_path = os.path.join(run.report_path, f"{chart_type}.png")
    if not os.path.exists(chart_path):
        raise HTTPException(status_code=404, detail="Chart not yet generated.")

    return FileResponse(chart_path, media_type="image/png")


# ─────────────────────────────────────────────────────────────────────────────
# NEW ENDPOINTS: per-class AP, run comparison, speed benchmark
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/results/{run_id}/per-class")
async def get_per_class_ap(run_id: int, db: AsyncSession = Depends(get_db)):
    """Return per-class AP@0.5 for a completed evaluation run (read from metrics.json)."""
    result = await db.execute(select(EvaluationRun).where(EvaluationRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found.")
    if run.status != "completed":
        raise HTTPException(status_code=400, detail=f"Run is not completed (status={run.status}).")
    if not run.report_path:
        raise HTTPException(status_code=404, detail="No report path for this run.")

    metrics_path = os.path.join(run.report_path, "metrics.json")
    if not os.path.exists(metrics_path):
        raise HTTPException(status_code=404, detail="metrics.json not found for this run.")

    with open(metrics_path) as f:
        metrics = json.load(f)

    per_class = metrics.get("per_class_ap", {})
    class_names = metrics.get("class_names", [])

    return {
        "run_id": run_id,
        "model": run.model_size,
        "dataset": run.dataset_name,
        "per_class_ap50": per_class,
        "class_names": class_names,
        "map50": run.map50,
    }


@router.get("/compare")
async def compare_runs(
    run_a: int = Query(..., description="ID of first run"),
    run_b: int = Query(..., description="ID of second run"),
    db: AsyncSession = Depends(get_db),
):
    """Compare two evaluation runs side-by-side."""
    async def _get_run(rid):
        res = await db.execute(select(EvaluationRun).where(EvaluationRun.id == rid))
        r = res.scalar_one_or_none()
        if not r:
            raise HTTPException(status_code=404, detail=f"Run {rid} not found.")
        return r

    ra = await _get_run(run_a)
    rb = await _get_run(run_b)

    def _run_dict(r):
        return {
            "id":          r.id,
            "timestamp":   r.timestamp.isoformat() if r.timestamp else None,
            "model":       r.model_size,
            "dataset":     r.dataset_name,
            "status":      r.status,
            "map50":       r.map50,
            "map5095":     r.map5095,
            "precision":   r.precision,
            "recall":      r.recall,
            "f1_score":    r.f1_score,
            "error_message": r.error_message,
        }

    def _delta(va, vb):
        """Return signed difference vb - va, or None if either is missing."""
        if va is None or vb is None:
            return None
        return round(vb - va, 4)

    return {
        "run_a": _run_dict(ra),
        "run_b": _run_dict(rb),
        "delta": {
            "map50":     _delta(ra.map50,     rb.map50),
            "map5095":   _delta(ra.map5095,   rb.map5095),
            "precision": _delta(ra.precision, rb.precision),
            "recall":    _delta(ra.recall,    rb.recall),
            "f1_score":  _delta(ra.f1_score,  rb.f1_score),
        },
    }


@router.post("/speed-test")
async def speed_test(
    model_size: str = Query(default="yolov8s_visdrone_best"),
    n_runs: int = Query(default=30, ge=5, le=100),
):
    """
    Benchmark inference speed: run model on a synthetic test image n_runs times
    and return mean latency (ms) and estimated FPS.
    Uses a real 640×640 image to avoid I/O bias.
    """
    import numpy as np
    from ultralytics import YOLO

    allowed_models = {"yolov8n", "yolov8s", "yolov8s_visdrone_best"}
    if model_size not in allowed_models:
        raise HTTPException(status_code=400, detail=f"model_size must be one of {allowed_models}")

    CUSTOM_MODELS = {
        "yolov8s_visdrone_best": os.path.join(settings.MODELS_DIR, "yolov8s_visdrone_best.pt"),
    }
    model_path = CUSTOM_MODELS.get(model_size, f"{model_size}.pt")

    try:
        model = YOLO(model_path)
        # Warm up — first inference is always slow (model loading, JIT)
        dummy = np.random.randint(0, 255, (640, 640, 3), dtype=np.uint8)
        for _ in range(3):
            model.predict(dummy, verbose=False, device="cpu")

        # Timed runs
        times = []
        for _ in range(n_runs):
            img = np.random.randint(0, 255, (640, 640, 3), dtype=np.uint8)
            t0 = time.perf_counter()
            model.predict(img, verbose=False, device="cpu")
            times.append((time.perf_counter() - t0) * 1000)  # ms

        mean_ms  = round(float(np.mean(times)),   2)
        std_ms   = round(float(np.std(times)),    2)
        min_ms   = round(float(np.min(times)),    2)
        max_ms   = round(float(np.max(times)),    2)
        fps      = round(1000 / mean_ms,          1)

        return {
            "model":    model_size,
            "n_runs":   n_runs,
            "device":   "cpu",
            "imgsz":    640,
            "mean_ms":  mean_ms,
            "std_ms":   std_ms,
            "min_ms":   min_ms,
            "max_ms":   max_ms,
            "fps":      fps,
            "note":     "Inference only (no I/O). Warm-up runs excluded.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Speed test failed: {e}")
