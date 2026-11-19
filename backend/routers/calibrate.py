"""
routers/calibrate.py
====================
REST endpoints for camera speed calibration.

POST /calibrate/homography  — 4-point full perspective calibration
POST /calibrate/simple      — 1-reference-distance simple scale
GET  /calibrate/status      — current calibration state
DELETE /calibrate/reset     — wipe calibration
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, field_validator

router = APIRouter(prefix="/calibrate", tags=["calibration"])


# ── Request schemas ───────────────────────────────────────────────────────────

class HomographyRequest(BaseModel):
    """4 pixel points ↔ 4 real-world metre coordinates."""
    pixel_points: list[list[float]]   # [[px, py], ...]  len == 4
    world_points: list[list[float]]   # [[X, Y], ...]    len == 4

    @field_validator("pixel_points", "world_points")
    @classmethod
    def must_be_four(cls, v):
        if len(v) != 4:
            raise ValueError("Exactly 4 points required.")
        for pt in v:
            if len(pt) != 2:
                raise ValueError("Each point must be [x, y].")
        return v


class SimpleScaleRequest(BaseModel):
    """
    One known reference distance mapped to its pixel length.

    Example: a lane is 3.5 m wide and spans 140 pixels in the frame
    →  pixels=140, real_metres=3.5
    """
    pixels: float
    real_metres: float

    @field_validator("pixels", "real_metres")
    @classmethod
    def must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Value must be positive.")
        return v


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/homography", summary="Set full homography (4-point)")
async def set_homography(request: Request, body: HomographyRequest):
    """
    Provide 4 pixel-space points and their real-world (metre) equivalents.
    The backend computes the perspective homography matrix H and stores it.
    All subsequent speed estimates use H for pixel → world projection.
    """
    calibrator = request.app.state.calibrator
    ok = calibrator.compute_homography(body.pixel_points, body.world_points)
    if not ok:
        raise HTTPException(status_code=400, detail="Homography computation failed — check that the 4 points are non-collinear.")
    return {"status": "ok", **calibrator.status()}


@router.post("/simple", summary="Set simple pixel-to-metre scale")
async def set_simple_scale(request: Request, body: SimpleScaleRequest):
    """
    Supply one reference measurement: how many pixels correspond to how many
    real-world metres (e.g. lane width).  Speed accuracy depends on how
    representative this ratio is across the whole frame.

    Preset guidance (drone altitude):
      ~50 m alt  → scale ≈ 0.05 m/px
      ~100 m alt → scale ≈ 0.025 m/px
    """
    calibrator = request.app.state.calibrator
    ok = calibrator.set_simple_scale(body.pixels, body.real_metres)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid scale parameters.")
    return {"status": "ok", **calibrator.status()}


@router.get("/status", summary="Current calibration state")
async def get_calibration_status(request: Request):
    """Returns whether calibration is active and which mode is in use."""
    return request.app.state.calibrator.status()


@router.delete("/reset", summary="Reset calibration")
async def reset_calibration(request: Request):
    """Wipes the stored calibration. Speeds revert to uncalibrated estimates."""
    request.app.state.calibrator.reset()
    return {"status": "ok", "calibrated": False}
