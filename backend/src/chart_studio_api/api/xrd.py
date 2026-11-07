"""Endpoints for X-ray diffraction (XRD) patterns."""

from fastapi import APIRouter, HTTPException

from chart_studio_api.schemas import XrdRequest, XrdResult
from chart_studio_api.services.xrd import XrdError, analyze

router = APIRouter(prefix="/api/v1/xrd", tags=["xrd"])


@router.post("/analyze")
def analyze_pattern(request: XrdRequest) -> XrdResult:
    try:
        return analyze(request)
    except XrdError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
