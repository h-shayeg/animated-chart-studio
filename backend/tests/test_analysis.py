import pytest
from fastapi.testclient import TestClient

URL = "/api/v1/analysis/summary"

ROWS = [
    {"city": "Tehran", "sales": 10, "cost": 20, "date": "2024-01-01"},
    {"city": "Tehran", "sales": 20, "cost": 40, "date": "2024-01-02"},
    {"city": "Tabriz", "sales": 30, "cost": 60, "date": "2024-01-03"},
    {"city": "Tabriz", "sales": None, "cost": 80, "date": "2024-01-04"},
]


def test_summary_describes_each_column(client: TestClient) -> None:
    response = client.post(URL, json={"rows": ROWS})

    assert response.status_code == 200
    body = response.json()
    assert body["rows"] == 4
    columns = {column["name"]: column for column in body["columns"]}
    assert columns["city"]["kind"] == "text"
    assert columns["city"]["unique"] == 2
    assert columns["city"]["top_values"][0]["count"] == 2
    assert columns["date"]["kind"] == "datetime"
    assert columns["sales"]["missing"] == 1
    stats = columns["sales"]["numeric"]
    assert stats["count"] == 3
    assert stats["mean"] == pytest.approx(20.0)
    assert stats["median"] == pytest.approx(20.0)
    assert stats["max"] == pytest.approx(30.0)


def test_summary_includes_correlation_of_numeric_columns(client: TestClient) -> None:
    response = client.post(URL, json={"rows": ROWS})

    correlation = response.json()["correlation"]
    assert correlation["columns"] == ["sales", "cost"]
    assert correlation["matrix"][0][1] == pytest.approx(1.0)


def test_summary_without_two_numeric_columns_has_no_correlation(client: TestClient) -> None:
    rows = [{"a": 1, "city": "x"}, {"a": 2, "city": "y"}]
    response = client.post(URL, json={"rows": rows})

    assert response.status_code == 200
    assert response.json()["correlation"] is None


def test_summary_handles_a_column_with_only_missing_values(client: TestClient) -> None:
    rows = [{"a": 1, "b": None}, {"a": 2, "b": None}]
    response = client.post(URL, json={"rows": rows})

    assert response.status_code == 200
    column = {item["name"]: item for item in response.json()["columns"]}["b"]
    assert column["missing"] == 2
    assert column["unique"] == 0


@pytest.mark.parametrize(
    "payload",
    [{}, {"rows": []}, {"rows": [{}]}, {"rows": [{"a": [1, 2]}]}],
)
def test_invalid_payload_is_rejected(client: TestClient, payload: dict[str, object]) -> None:
    response = client.post(URL, json=payload)

    assert response.status_code == 422
