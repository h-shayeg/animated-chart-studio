"""Reading uploaded tables (CSV, Excel or instrument text files) and describing their columns."""

import codecs
import csv
import json
from io import BytesIO, StringIO
from itertools import islice
from pathlib import PurePath

import pandas as pd

from chart_studio_api.schemas import ColumnInfo, ColumnKind, DatasetTable
from chart_studio_api.services.numeric_block import find_numeric_block

# Text files as instruments write them: columns of numbers, often under some lines of notes.
INSTRUMENT_SUFFIXES = (".txt", ".tsv", ".dat", ".xy", ".xye", ".asc")
# A .csv file is read as a block of numbers only when it has at least this many lines of notes
# above the numbers. With fewer it is an ordinary table and is read as before.
CSV_MIN_NOTES = 2
# Building a table gets slow very fast as its columns grow: 30 000 columns already take seconds.
MAX_COLUMNS = 2_000


class DatasetError(ValueError):
    """Raised when an uploaded file cannot be turned into a usable table."""


def read_table(filename: str, content: bytes, *, header: bool = True) -> pd.DataFrame:
    suffix = PurePath(filename).suffix.lower()
    header_row = 0 if header else None
    if suffix == ".xlsx":
        table = _read_xlsx(content, header_row)
    elif suffix == ".csv" or suffix in INSTRUMENT_SUFFIXES:
        text = _decode(content)
        _check_width(text)
        block = find_numeric_block(
            text, header=header, min_notes=CSV_MIN_NOTES if suffix == ".csv" else 0
        )
        if block is not None:
            names = block.names or [
                f"Column {number}" for number in range(1, len(block.rows[0]) + 1)
            ]
            return pd.DataFrame(block.rows, columns=names)
        # No block of numbers: an ordinary table. A .csv file has its separator worked out by
        # the reader, as it always had; the other text files say it in their first lines.
        table = _read_csv(text, header_row, None if suffix == ".csv" else _separator(text))
    else:
        raise DatasetError(
            "Unsupported file type. Please upload a .csv, .xlsx, .txt, .tsv, .dat, .xy, .xye "
            "or .asc file."
        )

    if table.empty:
        raise DatasetError("The file does not contain any data rows.")
    if header:
        table.columns = [str(name) for name in table.columns]
    else:
        table.columns = [f"Column {number}" for number in range(1, len(table.columns) + 1)]
    return table


def describe_table(filename: str, table: pd.DataFrame) -> DatasetTable:
    columns = [_describe_column(str(name), table[name]) for name in table.columns]
    data = json.loads(table.to_json(orient="records", date_format="iso"))
    return DatasetTable(filename=filename, rows=len(table), columns=columns, data=data)


def _decode(content: bytes) -> str:
    if content.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        return content.decode("utf-16", errors="replace")
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError:
        # Older Windows programs save Persian and Arabic text in this code page.
        return content.decode("cp1256", errors="replace")


def _first_lines(text: str) -> list[str]:
    return list(islice((line for line in StringIO(text) if line.strip()), 5))


def _check_width(text: str) -> None:
    """Turns down a table with a huge number of columns before any time is spent on it."""
    for line in _first_lines(text):
        separators = max(line.count("\t"), line.count(";"), line.count(","), len(line.split()) - 1)
        if separators >= MAX_COLUMNS:
            raise DatasetError(f"The table has too many columns (more than {MAX_COLUMNS}).")


def _separator(text: str) -> str:
    """The separator of a text table: the first of tab, semicolon and comma that its first
    lines all have, and otherwise any run of spaces."""
    lines = _first_lines(text)
    for separator in ("\t", ";", ","):
        if lines and all(separator in line for line in lines):
            return separator
    return r"\s+"


def _read_csv(text: str, header: int | None, separator: str | None) -> pd.DataFrame:
    try:
        return pd.read_csv(StringIO(text), sep=separator, engine="python", header=header)
    except (csv.Error, pd.errors.EmptyDataError, pd.errors.ParserError) as exc:
        raise DatasetError("The file could not be read as a table.") from exc


def _read_xlsx(content: bytes, header: int | None) -> pd.DataFrame:
    try:
        return pd.read_excel(BytesIO(content), engine="openpyxl", header=header)
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
