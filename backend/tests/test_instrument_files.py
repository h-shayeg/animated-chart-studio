"""Text files as instruments write them: .xy, .xye, .dat, .asc, .txt and .tsv."""

from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

URL = "/api/v1/datasets/parse"
SAMPLES = Path(__file__).resolve().parents[2] / "samples"

POINTS = [(20 + index * 0.02, 100.0 + index) for index in range(40)]
SPACES = "\n".join(f"{angle:.2f} {counts:.1f}" for angle, counts in POINTS)

Body = dict[str, Any]


def parse(client: TestClient, name: str, text: str | bytes, **form: str) -> Body:
    content = text if isinstance(text, bytes) else text.encode()
    response = client.post(URL, files={"file": (name, content)}, data=form)
    assert response.status_code == 200, response.text
    body: Body = response.json()
    return body


def names(body: Body) -> list[str]:
    return [column["name"] for column in body["columns"]]


def kinds(body: Body) -> list[str]:
    return [column["kind"] for column in body["columns"]]


def test_xy_file_without_column_names_keeps_its_first_row(client: TestClient) -> None:
    body = parse(client, "pattern.xy", SPACES)

    assert body["rows"] == 40
    assert names(body) == ["Column 1", "Column 2"]
    assert kinds(body) == ["numeric", "numeric"]
    assert body["data"][0] == {"Column 1": 20.0, "Column 2": 100.0}
    assert body["data"][-1] == {"Column 1": 20.78, "Column 2": 139.0}


def test_notes_above_the_numbers_are_skipped_and_the_names_are_kept(client: TestClient) -> None:
    notes = "Sample: Si powder\nDate: 2026-01-02\nStep 0.02\nWavelength 1.5406\n"
    body = parse(client, "pattern.txt", f"{notes}Angle Intensity\n{SPACES}")

    assert body["rows"] == 40
    assert names(body) == ["Angle", "Intensity"]
    assert body["data"][0] == {"Angle": 20.0, "Intensity": 100.0}


def test_a_setting_right_above_the_numbers_is_not_taken_for_names(client: TestClient) -> None:
    body = parse(client, "pattern.txt", f"Sample: Si\nStep 0.02\n{SPACES}")

    assert body["rows"] == 40
    assert names(body) == ["Column 1", "Column 2"]


def test_names_can_be_left_out_on_request(client: TestClient) -> None:
    text = "2Theta\tIntensity\n" + SPACES.replace(" ", "\t")
    with_names = parse(client, "pattern.txt", text)
    without = parse(client, "pattern.txt", text, header="false")

    assert names(with_names) == ["2Theta", "Intensity"]
    assert names(without) == ["Column 1", "Column 2"]
    assert with_names["rows"] == without["rows"] == 40


def test_names_behind_a_comment_mark_are_used(client: TestClient) -> None:
    body = parse(client, "pattern.xy", f"# 2theta intensity\n{SPACES}")

    assert names(body) == ["2theta", "intensity"]


def test_a_quoted_line_of_notes_is_skipped(client: TestClient) -> None:
    note = '\'Id: "Si" Comment: "" Operator: "lab" Anode: "Cu" Scantype: "Coupled"\n'
    body = parse(client, "pattern.xy", note + SPACES)

    assert body["rows"] == 40
    assert names(body) == ["Column 1", "Column 2"]


def test_xye_file_has_three_columns(client: TestClient) -> None:
    text = "\n".join(f"{angle:.2f} {counts:.1f} {counts**0.5:.3f}" for angle, counts in POINTS)
    body = parse(client, "pattern.xye", text)

    assert names(body) == ["Column 1", "Column 2", "Column 3"]
    assert body["data"][0]["Column 3"] == 10.0


@pytest.mark.parametrize(
    ("name", "separator"),
    [("a.dat", "\t"), ("a.dat", "  "), ("a.asc", ";"), ("a.txt", " ; ")],
)
def test_decimal_commas_are_read_as_numbers(client: TestClient, name: str, separator: str) -> None:
    text = "\n".join(
        f"{angle:.2f}{separator}{counts:.1f}".replace(".", ",") for angle, counts in POINTS
    )
    body = parse(client, name, text)

    assert body["rows"] == 40
    assert body["data"][1] == {"Column 1": 20.02, "Column 2": 101.0}


@pytest.mark.parametrize(
    "layout",
    [
        "{angle:.2f}, {counts:.1f}",
        "   {angle:8.3f}     {counts:10.1f}",
        "{angle:.2f}\t{counts:.1f}\t",
        "\t{angle:.2f}\t{counts:.1f}",
        "{angle:.4e} {counts:.4E}",
    ],
)
def test_usual_layouts_of_two_columns(client: TestClient, layout: str) -> None:
    text = "\r\n".join(layout.format(angle=angle, counts=counts) for angle, counts in POINTS)
    body = parse(client, "pattern.txt", text + "\r\n\r\n")

    assert body["rows"] == 40
    assert body["data"][0] == {"Column 1": 20.0, "Column 2": 100.0}


def test_lines_after_the_numbers_are_skipped(client: TestClient) -> None:
    text = "\n".join(f"{angle:.4f} {counts:.4f} 1.0000" for angle, counts in POINTS)
    body = parse(client, "pattern.asc", f"*RAS_INT_START\n{text}\n*RAS_INT_END\n*RAS_DATA_END\n")

    assert body["rows"] == 40
    assert len(body["columns"]) == 3


def test_numbers_among_the_notes_are_not_data(client: TestClient) -> None:
    stray = parse(client, "pattern.txt", f"Generator\n40 30\nData\n{SPACES}")
    settings = parse(client, "pattern.txt", f"20.0 80.0 0.02\n1.5406 1.5444 0.5\n40 30 1\n{SPACES}")
    counts = parse(client, "pattern.txt", f"40\n20.00\n0.02\n{SPACES}")

    for body in (stray, settings, counts):
        assert body["rows"] == 40
        assert body["data"][0] == {"Column 1": 20.0, "Column 2": 100.0}


def test_utf16_file_is_decoded(client: TestClient) -> None:
    text = "Angle\tCounts\n" + SPACES.replace(" ", "\t")
    body = parse(client, "pattern.txt", text.encode("utf-16"))

    assert names(body) == ["Angle", "Counts"]
    assert body["rows"] == 40


def test_csv_with_notes_above_the_numbers(client: TestClient) -> None:
    notes = (
        "Sample identification,Si powder\n"
        "Measurement Date,2026-01-02\n"
        "K-Alpha1 wavelength,1.5405980\n"
        "[Scan points]\n"
        "Angle,Intensity\n"
    )
    body = parse(client, "pattern.csv", notes + SPACES.replace(" ", ","))

    assert body["rows"] == 40
    assert names(body) == ["Angle", "Intensity"]
    assert kinds(body) == ["numeric", "numeric"]


def test_text_table_with_words_is_still_read_as_a_table(client: TestClient) -> None:
    body = parse(client, "sales.txt", "month\tsales\nJan\t120\nFeb\t135\nMar\t160\n")

    assert body["rows"] == 3
    assert names(body) == ["month", "sales"]
    assert kinds(body) == ["text", "numeric"]


@pytest.mark.parametrize(
    "text",
    [
        "a\tb\n1\t\n3\t4\n5\t6\n7\t8\n",
        "a\tb\n1\t2\n3\t4\n5\t\n7\t8\n9\t10\n11\t12\n",
        "a\tb\n1\t2\n3\t4\n5\t6\n7\t\n",
    ],
)
def test_table_with_a_gap_keeps_every_row(client: TestClient, text: str) -> None:
    body = parse(client, "table.tsv", text)

    assert body["rows"] == text.count("\n") - 1
    assert names(body) == ["a", "b"]
    assert body["columns"][1]["missing"] == 1


def test_table_with_a_word_among_the_numbers_keeps_every_row(client: TestClient) -> None:
    body = parse(client, "table.txt", "a b\n1 2\n3 4\nx 6\n7 8\n9 10\n11 12\n")

    assert body["rows"] == 6
    assert kinds(body) == ["text", "numeric"]


def test_one_column_of_numbers_is_one_column(client: TestClient) -> None:
    body = parse(client, "counts.txt", "counts\n" + "\n".join(str(100 + n) for n in range(10)))

    assert names(body) == ["counts"]
    assert body["rows"] == 10


def test_ragged_text_is_rejected(client: TestClient) -> None:
    response = client.post(URL, files={"file": ("a.dat", b"a b\n1 2 3\n4\n5 6 7 8\n")})

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("name", "cell"), [("wide.csv", "1,"), ("wide.txt", "1 "), ("wide.tsv", "1\t")]
)
def test_table_with_a_huge_number_of_columns_is_turned_down(
    client: TestClient, name: str, cell: str
) -> None:
    response = client.post(URL, files={"file": (name, (cell * 50_000).encode())})

    assert response.status_code == 422
    assert "too many columns" in response.json()["detail"]


def test_sample_xy_file_matches_the_csv_sample(client: TestClient) -> None:
    xy = parse(client, "si.xy", (SAMPLES / "xrd-silicon-synthetic.xy").read_bytes())
    csv = parse(client, "si.csv", (SAMPLES / "xrd-silicon-synthetic.csv").read_bytes())

    assert xy["rows"] == csv["rows"] == 3000
    assert names(xy) == ["Column 1", "Column 2"]
    assert [list(row.values()) for row in xy["data"]] == [list(row.values()) for row in csv["data"]]
