"""Finds the block of numbers in a text file written by an instrument.

Such files often start with lines of notes (sample name, date, settings), may have no row of
column names, and separate their columns with tabs, spaces, commas or semicolons. The block is
the run of lines made only of numbers that goes on to the end of the file.
"""

import re
from dataclasses import dataclass
from typing import Literal

# Written so that a long run of digits can only be read in one way, which keeps matching fast.
NUMBER = re.compile(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?")
# A comma as the decimal mark, as in "12,5". It only counts when columns are not split by commas.
COMMA_NUMBER = re.compile(r"[+-]?\d+,\d+(?:[eE][+-]?\d+)?")

# Tried in this order. None stands for any run of spaces.
SEPARATORS: tuple[str | None, ...] = ("\t", ";", ",", None)
# A block has at least this many lines.
MIN_ROWS = 3
# The separator is worked out from this many lines in the middle of the file and as many at
# its end, where the numbers are: the notes sit at the top.
SAMPLE_LINES = 25
# Marks that some programs put in front of a line of notes or column names.
NOTE_MARKS = "#;!%*'\" "

# What a line is, seen as a row of the block:
#   data   every cell is a number
#   gap    numbers with one or more empty cells
#   mixed  numbers next to text
#   note   anything else
LineKind = Literal["data", "gap", "mixed", "note"]


@dataclass(frozen=True)
class NumericBlock:
    names: list[str] | None
    rows: list[list[float]]


def _cells(line: str, separator: str | None) -> list[str]:
    return [cell.strip() for cell in line.split(separator)]


def _number(cell: str, separator: str | None) -> float | None:
    if NUMBER.fullmatch(cell):
        return float(cell)
    if separator != "," and COMMA_NUMBER.fullmatch(cell):
        return float(cell.replace(",", "."))
    return None


def _numbers(line: str, separator: str | None) -> list[float] | None:
    """The numbers of a line, or None when a cell is not a number or there is only one cell."""
    cells = _cells(line, separator)
    if len(cells) < 2:
        return None
    values = [_number(cell, separator) for cell in cells]
    return None if None in values else [value for value in values if value is not None]


def _kind(line: str, separator: str | None, width: int) -> LineKind:
    cells = _cells(line, separator)
    if len(cells) != width:
        return "note"
    numbers = sum(_number(cell, separator) is not None for cell in cells)
    if numbers == width:
        return "data"
    if numbers == 0:
        return "note"
    return "gap" if numbers + cells.count("") == width else "mixed"


def _separator(lines: list[str]) -> tuple[bool, str | None]:
    """How the columns are separated, and whether the file holds lines of numbers at all."""
    middle = len(lines) // 2
    sample = lines[max(0, middle - SAMPLE_LINES // 2) : middle + SAMPLE_LINES // 2 + 1]
    sample += lines[-SAMPLE_LINES:]
    best: tuple[int, str | None] = (0, None)
    for separator in SEPARATORS:
        hits = sum(_numbers(line, separator) is not None for line in sample)
        if hits > best[0]:
            best = (hits, separator)
    return best[0] >= MIN_ROWS, best[1]


def _longest_run(rows: list[list[float] | None]) -> tuple[int, int]:
    """The first and last-plus-one index of the longest run of rows with the same width."""
    best = (0, 0)
    start = 0
    for index in range(1, len(rows) + 1):
        previous = rows[index - 1]
        current = rows[index] if index < len(rows) else None
        if previous is not None and current is not None and len(current) == len(previous):
            continue
        if previous is not None and index - start > best[1] - best[0]:
            best = (start, index)
        start = index
    return best


def _only_notes_around(before: list[LineKind], after: list[LineKind]) -> bool:
    """Whether the lines outside the block are notes and not rows of a table.

    A row with a gap or with text in it means the file is an ordinary table, which the table
    reader handles better: no row is dropped without a word.
    """
    if any(kind != "note" for kind in after) or "gap" in before:
        return False
    if "data" not in before:
        return True
    # A stray pair of numbers among the notes is fine when a real line of notes follows it.
    last_data = len(before) - 1 - before[::-1].index("data")
    return "note" in before[last_data + 1 :]


def _names(line: str, separator: str | None, width: int) -> list[str] | None:
    """The column names in the line above the block, or None when it is a line of notes."""
    cells = [cell.strip("\"'") for cell in _cells(line.lstrip(NOTE_MARKS), separator)]
    if len(cells) != width or not all(cells) or len(set(cells)) != width:
        return None
    # "Step 0.02" or "Sample: Si" is a setting, not a pair of column names.
    if any(NUMBER.fullmatch(cell) or cell.endswith(":") or "=" in cell for cell in cells):
        return None
    return cells


def find_numeric_block(text: str, *, header: bool, min_notes: int = 0) -> NumericBlock | None:
    """Returns the block of numbers of a text, or None when the text is not laid out that way.

    With ``header`` the line right above the block gives the column names, if it fits.
    ``min_notes`` asks for at least that many lines above the block.
    """
    lines = [line for line in text.splitlines() if line.strip()]
    found, separator = _separator(lines)
    if not found:
        return None
    # A quick way out for an ordinary table, before every line is read.
    if 0 < min_notes < len(lines) and _numbers(lines[min_notes - 1], separator) is not None:
        return None
    parsed = [_numbers(line, separator) for line in lines]
    start, end = _longest_run(parsed)
    if end - start < MIN_ROWS or start < min_notes:
        return None
    rows = [row for row in parsed[start:end] if row is not None]
    width = len(rows[0])

    before = [_kind(line, separator, width) for line in lines[:start]]
    after = [_kind(line, separator, width) for line in lines[end:]]
    if not _only_notes_around(before, after):
        return None

    names = _names(lines[start - 1], separator, width) if header and start > 0 else None
    return NumericBlock(names=names, rows=rows)
