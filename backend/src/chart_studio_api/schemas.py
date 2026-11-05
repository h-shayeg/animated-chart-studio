from typing import Any, Literal

from pydantic import BaseModel, Field

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


class SummaryRequest(BaseModel):
    rows: list[dict[str, Any]] = Field(min_length=1, max_length=100_000)


class NumericStats(BaseModel):
    count: int
    mean: float
    std: float | None
    min: float
    q25: float
    median: float
    q75: float
    max: float


class TopValue(BaseModel):
    value: str
    count: int


class ColumnSummary(ColumnInfo):
    unique: int
    numeric: NumericStats | None = None
    top_values: list[TopValue] = Field(default_factory=list)


class Correlation(BaseModel):
    columns: list[str]
    matrix: list[list[float | None]]


class AnalysisSummary(BaseModel):
    rows: int
    columns: list[ColumnSummary]
    correlation: Correlation | None = None
