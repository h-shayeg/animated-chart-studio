from typing import Any, Literal

from pydantic import BaseModel, Field

ColumnKind = Literal["numeric", "datetime", "boolean", "text"]


class ColumnInfo(BaseModel):
    name: str
    kind: ColumnKind
    missing: int


class DatasetTable(BaseModel):
    filename: str
    rows: int
    columns: list[ColumnInfo]
    data: list[dict[str, Any]]


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


class XrdRequest(BaseModel):
    two_theta: list[float] = Field(min_length=20, max_length=200_000)
    intensity: list[float] = Field(min_length=20, max_length=200_000)
    wavelength: float = Field(default=1.5406, gt=0.1, lt=10)
    smoothing_window: int = Field(default=9, ge=0, le=201)
    baseline_method: Literal["none", "snip"] = "snip"
    baseline_window: float = Field(default=5.0, gt=0, le=60)
    min_prominence: float = Field(default=3.0, gt=0, le=100)
    min_distance: float = Field(default=0.2, ge=0, le=20)
    shape_factor: float = Field(default=0.9, gt=0, le=2)
    instrument_broadening: float = Field(default=0.0, ge=0, le=5)


class XrdPeak(BaseModel):
    position: float
    d_spacing: float
    height: float
    relative_intensity: float
    fwhm: float
    crystallite_size: float | None


class XrdResult(BaseModel):
    two_theta: list[float]
    smoothed: list[float]
    baseline: list[float]
    corrected: list[float]
    peaks: list[XrdPeak]
