"""Reading uploaded tables (CSV or Excel) and describing their columns."""

import csv
import json
from io import BytesIO
from pathlib import PurePath

import pandas as pd

from chart_studio_api.schemas import ColumnInfo, ColumnKind, DatasetPreview

CSV_ENCODINGS = ("utf-8-sig", "cp1256")


class DatasetError(ValueError):
    """Raised when an uploaded file cannot be turned into a usable table."""


def read_table(filename: str, content: bytes) -> pd.DataFrame:
    suffix = PurePath(filename).suffix.lower()
    if suffix == ".csv":
        table = _read_csv(content)
    elif suffix == ".xlsx":
        table = _read_xlsx(content)
    else:
        raise DatasetError("Unsupported file type. Please upload a .csv or .xlsx file.")

    if table.empty:
        raise DatasetError("The file does not contain any data rows.")
    table.columns = [str(name) for name in table.columns]
    return table


def describe_table(filename: str, table: pd.DataFrame, preview_rows: int) -> DatasetPreview:
    columns = [_describe_column(str(name), table[name]) for name in table.columns]
    preview = json.loads(table.head(preview_rows).to_json(orient="records", date_format="iso"))
    return DatasetPreview(filename=filename, rows=len(table), columns=columns, preview=preview)


def _read_csv(content: bytes) -> pd.DataFrame:
    for encoding in CSV_ENCODINGS:
        try:
            return pd.read_csv(BytesIO(content), sep=None, engine="python", encoding=encoding)
        except UnicodeDecodeError:
            continue
        except (csv.Error, pd.errors.EmptyDataError, pd.errors.ParserError) as exc:
            raise DatasetError("The CSV file could not be parsed.") from exc
    raise DatasetError("The CSV file encoding is not supported.")


def _read_xlsx(content: bytes) -> pd.DataFrame:
    try:
        return pd.read_excel(BytesIO(content), engine="openpyxl")
    except Exception as exc:
        raise DatasetError("The Excel file could not be read.") from exc


def _describe_column(name: str, series: pd.Series) -> ColumnInfo:
    return ColumnInfo(name=name, kind=column_kind(series), missing=int(series.isna().sum()))


def column_kind(series: pd.Series) -> ColumnKind:
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    if pd.api.types.is_datetime64_any_dtype(series) or _looks_like_iso_dates(series):
        return "datetime"
    return "text"


def _looks_like_iso_dates(series: pd.Series) -> bool:
    values = series.dropna()
    if values.empty:
        return False
    try:
        pd.to_datetime(values, format="ISO8601")
    except (ValueError, TypeError):
        return False
    return True
