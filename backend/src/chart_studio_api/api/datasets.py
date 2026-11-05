"""Endpoints for uploading tables and inspecting them."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from chart_studio_api.config import Settings, get_settings
from chart_studio_api.schemas import DatasetTable
from chart_studio_api.services.datasets import DatasetError, describe_table, read_table

router = APIRouter(prefix="/api/v1/datasets", tags=["datasets"])


@router.post("/parse")
def parse_dataset(
    file: Annotated[UploadFile, File()],
    settings: Annotated[Settings, Depends(get_settings)],
) -> DatasetTable:
    content = file.file.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="The file is too large.")

    filename = file.filename or "upload"
    try:
        table = read_table(filename, content)
    except DatasetError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if len(table) > settings.max_rows:
        raise HTTPException(status_code=413, detail="The table has too many rows.")

    return describe_table(filename, table)
