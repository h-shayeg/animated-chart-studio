from fastapi import APIRouter
from pydantic import BaseModel

from chart_studio_api.config import get_settings

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    version: str


@router.get("/health")
def read_health() -> HealthResponse:
    return HealthResponse(status="ok", version=get_settings().app_version)
