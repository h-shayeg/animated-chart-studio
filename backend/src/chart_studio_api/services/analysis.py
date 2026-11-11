"""Statistical summaries of tables sent as JSON rows."""

import math
from typing import Any

import pandas as pd

from chart_studio_api.schemas import (
    AnalysisSummary,
    ColumnSummary,
    Correlation,
    NumericStats,
    TopValue,
)
from chart_studio_api.services.datasets import DatasetError, column_kind

TOP_VALUES = 5
# The correlation table grows with the square of its columns, so it stops at the first ones.
MAX_CORRELATION_COLUMNS = 30


def build_table(rows: list[dict[str, Any]]) -> pd.DataFrame:
    table = pd.DataFrame(rows)
    if len(table.columns) == 0:
        raise DatasetError("The rows do not contain any columns.")
    if table.map(lambda value: isinstance(value, list | dict)).to_numpy().any():
        raise DatasetError("Cells must be numbers, text, booleans or null.")
    table.columns = [str(name) for name in table.columns]
    return table


def summarize(table: pd.DataFrame) -> AnalysisSummary:
    columns = [_summarize_column(str(name), table[name]) for name in table.columns]
    numeric = [column.name for column in columns if column.kind == "numeric"]
    correlation = _correlation(table, numeric)
    return AnalysisSummary(rows=len(table), columns=columns, correlation=correlation)


def _summarize_column(name: str, series: pd.Series) -> ColumnSummary:
    kind = column_kind(series)
    return ColumnSummary(
        name=name,
        kind=kind,
        missing=int(series.isna().sum()),
        unique=int(series.nunique()),
        numeric=_numeric_stats(series) if kind == "numeric" else None,
        top_values=_top_values(series) if kind in ("text", "boolean") else [],
    )


def _numeric_stats(series: pd.Series) -> NumericStats | None:
    values = series.dropna()
    if values.empty:
        return None
    q25, median, q75 = (float(value) for value in values.quantile([0.25, 0.5, 0.75]))
    std = values.std()
    return NumericStats(
        count=int(values.count()),
        mean=float(values.mean()),
        std=None if pd.isna(std) else float(std),
        min=float(values.min()),
        q25=q25,
        median=median,
        q75=q75,
        max=float(values.max()),
    )


def _top_values(series: pd.Series) -> list[TopValue]:
    counts = series.value_counts().head(TOP_VALUES)
    return [TopValue(value=str(value), count=int(count)) for value, count in counts.items()]


def _correlation(table: pd.DataFrame, numeric: list[str]) -> Correlation | None:
    if len(numeric) < 2:
        return None
    numeric = numeric[:MAX_CORRELATION_COLUMNS]
    matrix = table[numeric].corr().to_numpy().tolist()
    rows = [[None if math.isnan(value) else round(value, 4) for value in row] for row in matrix]
    return Correlation(columns=numeric, matrix=rows)
