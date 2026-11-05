from io import BytesIO

import pandas as pd
from fastapi.testclient import TestClient

from chart_studio_api.config import Settings, get_settings
from chart_studio_api.main import app

URL = "/api/v1/datasets/parse"
CSV_TEXT = "date,city,sales,active\n2024-01-01,Tehran,10.5,true\n2024-01-02,Tabriz,,false\n"

# Persian words are written as escapes to keep this file ASCII-only.
CITY = "\u0634\u0647\u0631"  # "city"
SALES = "\u0641\u0631\u0648\u0634"  # "sales"
TEHRAN = "\u062a\u0647\u0631\u0627\u0646"  # "Tehran"


def test_parse_csv_describes_columns(client: TestClient) -> None:
    response = client.post(URL, files={"file": ("data.csv", CSV_TEXT.encode())})

    assert response.status_code == 200
    body = response.json()
    assert body["rows"] == 2
    kinds = {column["name"]: column["kind"] for column in body["columns"]}
    assert kinds == {
        "date": "datetime",
        "city": "text",
        "sales": "numeric",
        "active": "boolean",
    }
    assert body["columns"][2]["missing"] == 1
    assert body["data"][0]["city"] == "Tehran"


def test_parse_semicolon_csv_with_persian_text(client: TestClient) -> None:
    text = f"{CITY};{SALES}\n{TEHRAN};5\n"
    response = client.post(URL, files={"file": ("data.csv", text.encode("utf-8-sig"))})

    assert response.status_code == 200
    body = response.json()
    assert [column["name"] for column in body["columns"]] == [CITY, SALES]
    assert body["columns"][1]["kind"] == "numeric"


def test_parse_xlsx(client: TestClient) -> None:
    buffer = BytesIO()
    pd.DataFrame({"month": ["Jan", "Feb"], "value": [1, 2]}).to_excel(buffer, index=False)
    response = client.post(URL, files={"file": ("data.xlsx", buffer.getvalue())})

    assert response.status_code == 200
    assert response.json()["rows"] == 2


def test_unsupported_file_type_is_rejected(client: TestClient) -> None:
    response = client.post(URL, files={"file": ("notes.txt", b"hello")})

    assert response.status_code == 422


def test_empty_csv_is_rejected(client: TestClient) -> None:
    response = client.post(URL, files={"file": ("data.csv", b"")})

    assert response.status_code == 422


def test_too_large_file_is_rejected(client: TestClient) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(max_upload_bytes=10)
    try:
        response = client.post(URL, files={"file": ("data.csv", CSV_TEXT.encode())})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 413
