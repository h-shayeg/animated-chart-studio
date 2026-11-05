from typing import Any, Literal

from pydantic import BaseModel

ColumnKind = Literal["numeric", "datetime", "boolean", "text"]


class ColumnInfo(BaseModel):
    name: str
    kind: ColumnKind
    missing: int


class DatasetPreview(BaseModel):
    filename: str
    rows: int
    columns: list[ColumnInfo]
    preview: list[dict[str, Any]]
