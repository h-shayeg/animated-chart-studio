"""Endpoints that analyse tables sent as JSON rows."""

from fastapi import APIRouter, HTTPException

from chart_studio_api.schemas import AnalysisSummary, SummaryRequest
from chart_studio_api.services.analysis import build_table, summarize
from chart_studio_api.services.datasets import DatasetError

router = APIRouter(prefix="/api/v1/analysis", tags=["analysis"])


@router.post("/summary")
def summarize_rows(request: SummaryRequest) -> AnalysisSummary:
    try:
        table = build_table(request.rows)
    except DatasetError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return summarize(table)
