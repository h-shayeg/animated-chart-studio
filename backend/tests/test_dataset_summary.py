"""The statistics that come back with a parsed file."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

PARSE_URL = "/api/v1/datasets/parse"
SUMMARY_URL = "/api/v1/analysis/summary"
SAMPLES = Path(__file__).resolve().parents[2] / "samples"

CSV = (
    "date,city,sales,cost,active\n"
    "2024-01-01,Tehran,10,20,true\n"
    "2024-01-02,Tehran,20,40,false\n"
    "2024-01-03,Tabriz,30,60,true\n"
    "2024-01-04,Tabriz,,80,true\n"
)


def test_parsed_file_comes_with_its_summary(client: TestClient) -> None:
    response = client.post(PARSE_URL, files={"file": ("sales.csv", CSV.encode())})

    assert response.status_code == 200
    summary = response.json()["summary"]
    assert summary["rows"] == 4
    columns = {column["name"]: column for column in summary["columns"]}
    assert list(columns) == ["date", "city", "sales", "cost", "active"]
    assert columns["date"]["kind"] == "datetime"
    assert columns["date"]["unique"] == 4

    sales = columns["sales"]
    assert sales["missing"] == 1
    assert sales["numeric"]["count"] == 3
    assert sales["numeric"]["mean"] == pytest.approx(20.0)
    assert sales["numeric"]["std"] == pytest.approx(10.0)
    assert sales["numeric"]["min"] == pytest.approx(10.0)
    assert sales["numeric"]["q25"] == pytest.approx(15.0)
    assert sales["numeric"]["median"] == pytest.approx(20.0)
    assert sales["numeric"]["q75"] == pytest.approx(25.0)
    assert sales["numeric"]["max"] == pytest.approx(30.0)
    assert sales["top_values"] == []

    assert columns["city"]["numeric"] is None
    assert columns["city"]["top_values"] == [
        {"value": "Tehran", "count": 2},
        {"value": "Tabriz", "count": 2},
    ]
    assert columns["active"]["kind"] == "boolean"
    assert columns["active"]["top_values"][0] == {"value": "True", "count": 3}


def test_summary_of_a_parsed_file_has_the_correlation_of_its_number_columns(
    client: TestClient,
) -> None:
    response = client.post(PARSE_URL, files={"file": ("sales.csv", CSV.encode())})

    correlation = response.json()["summary"]["correlation"]
    assert correlation["columns"] == ["sales", "cost"]
    assert correlation["matrix"][0][0] == pytest.approx(1.0)
    assert correlation["matrix"][0][1] == pytest.approx(1.0)


def test_summary_agrees_with_the_summary_endpoint(client: TestClient) -> None:
    parsed = client.post(PARSE_URL, files={"file": ("sales.csv", CSV.encode())}).json()
    summary = client.post(SUMMARY_URL, json={"rows": parsed["data"]}).json()

    assert parsed["summary"] == summary


def test_instrument_file_comes_with_its_summary(client: TestClient) -> None:
    content = (SAMPLES / "xrd-silicon-synthetic.xy").read_bytes()
    summary = client.post(PARSE_URL, files={"file": ("si.xy", content)}).json()["summary"]

    angle, intensity = summary["columns"]
    assert angle["numeric"]["min"] == pytest.approx(20.0)
    assert angle["numeric"]["max"] == pytest.approx(79.98)
    assert intensity["numeric"]["count"] == 3000
    assert summary["correlation"]["columns"] == ["Column 1", "Column 2"]


def test_correlation_stops_at_thirty_columns(client: TestClient) -> None:
    names = [f"c{index}" for index in range(35)]
    lines = [",".join(names)]
    lines += [
        ",".join(str((row + 1) * (column + 2) % 17) for column in range(35)) for row in range(6)
    ]
    response = client.post(PARSE_URL, files={"file": ("wide.csv", "\n".join(lines).encode())})

    summary = response.json()["summary"]
    assert len(summary["columns"]) == 35
    assert summary["correlation"]["columns"] == names[:30]
    assert len(summary["correlation"]["matrix"]) == 30
    assert len(summary["correlation"]["matrix"][0]) == 30
