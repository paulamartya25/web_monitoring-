import os
import logging
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
    allowed_models = {"yolov8n", "yolov8s", "yolov8m", "yolov8l", "yolov8x"}
    if model_size not in allowed_models:
        raise HTTPException(status_code=400, detail=f"Invalid model. Choose from: {allowed_models}")

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
