"""Endpoints for X-ray diffraction (XRD) patterns."""

from fastapi import APIRouter, HTTPException

from chart_studio_api.schemas import XrdIdentifyRequest, XrdIdentifyResult, XrdRequest, XrdResult
from chart_studio_api.services.xrd import XrdError, analyze
from chart_studio_api.services.xrd_identify import IdentifyError, identify

router = APIRouter(prefix="/api/v1/xrd", tags=["xrd"])


@router.post("/analyze")
def analyze_pattern(request: XrdRequest) -> XrdResult:
    try:
        return analyze(request)
    except XrdError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/identify")
def identify_phases(request: XrdIdentifyRequest) -> XrdIdentifyResult:
    try:
        return identify(request)
    except IdentifyError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
