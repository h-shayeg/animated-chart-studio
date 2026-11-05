from io import BytesIO

import pandas as pd
from fastapi.testclient import TestClient

URL = "/api/v1/datasets/parse"

# Persian words are written as escapes to keep this file ASCII-only.
CITY = "\u0634\u0647\u0631"
SALES = "\u0641\u0631\u0648\u0634"
TEHRAN = "\u062a\u0647\u0631\u0627\u0646"


def test_windows_1256_csv_is_decoded(client: TestClient) -> None:
    text = f"{CITY},{SALES}\n{TEHRAN},5\n"
    response = client.post(URL, files={"file": ("data.csv", text.encode("cp1256"))})

    assert response.status_code == 200
    assert response.json()["columns"][0]["name"] == CITY


def test_corrupted_xlsx_is_rejected(client: TestClient) -> None:
    response = client.post(URL, files={"file": ("data.xlsx", b"this is not an excel file")})

    assert response.status_code == 422


def test_xlsx_without_data_rows_is_rejected(client: TestClient) -> None:
    buffer = BytesIO()
    pd.DataFrame({"month": [], "value": []}).to_excel(buffer, index=False)
    response = client.post(URL, files={"file": ("data.xlsx", buffer.getvalue())})

    assert response.status_code == 422
