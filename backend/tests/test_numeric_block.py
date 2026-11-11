import pytest

from chart_studio_api.services.numeric_block import find_numeric_block


def block_of(cell: str) -> list[list[float]] | None:
    """Three rows with the same cell next to a plain number, read as a block."""
    block = find_numeric_block("\n".join([f"{cell} 1"] * 3), header=False)
    return None if block is None else block.rows


@pytest.mark.parametrize(
    ("cell", "value"),
    [
        ("12", 12.0),
        ("12.", 12.0),
        ("12.5", 12.5),
        (".5", 0.5),
        ("-3.25", -3.25),
        ("+7", 7.0),
        ("1e3", 1000.0),
        ("2.5E-2", 0.025),
        ("12,5", 12.5),
        ("-1,5e2", -150.0),
    ],
)
def test_ways_of_writing_a_number(cell: str, value: float) -> None:
    assert block_of(cell) == [[value, 1.0]] * 3


@pytest.mark.parametrize(
    "cell", ["abc", "1.2.3", "--1", "1e", "e5", ".", "1,2,3", "nan", "inf", "0x1F"]
)
def test_cells_that_are_not_numbers(cell: str) -> None:
    assert block_of(cell) is None


def test_comma_is_a_separator_before_it_is_a_decimal_mark() -> None:
    block = find_numeric_block("1,5\n2,5\n3,5", header=False)

    assert block is not None
    assert block.rows == [[1.0, 5.0], [2.0, 5.0], [3.0, 5.0]]


def test_two_rows_are_too_few_for_a_block() -> None:
    assert find_numeric_block("1 2\n3 4", header=False) is None


def test_the_longest_run_of_rows_is_the_block() -> None:
    text = "1 2 3\n4 5 6\n7 8 9\nscan\n" + "\n".join(f"{n} {n * 2}" for n in range(10))
    block = find_numeric_block(text, header=True)

    assert block is not None
    assert block.names is None
    assert len(block.rows) == 10
    assert block.rows[0] == [0.0, 0.0]


def test_a_second_block_of_the_same_width_is_left_to_the_table_reader() -> None:
    rows = "\n".join(f"{n} {n * 2}" for n in range(10))

    assert find_numeric_block(f"{rows}\nRange 2\n{rows}", header=False) is None


def test_names_must_be_complete_and_different() -> None:
    rows = "\n".join(f"{n}\t{n * 2}" for n in range(5))

    assert find_numeric_block(f"x\tx\n{rows}", header=True).names is None  # type: ignore[union-attr]
    assert find_numeric_block(f"x\t\n{rows}", header=True).names is None  # type: ignore[union-attr]
    assert find_numeric_block(f"x\ty\n{rows}", header=True).names == ["x", "y"]  # type: ignore[union-attr]


def test_min_notes_asks_for_lines_above_the_block() -> None:
    rows = "\n".join(f"{n},{n * 2}" for n in range(5))

    assert find_numeric_block(f"a,b\n{rows}", header=True, min_notes=2) is None
    assert find_numeric_block(f"note\na,b\n{rows}", header=True, min_notes=2) is not None
