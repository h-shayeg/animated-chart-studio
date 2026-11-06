from fastapi.testclient import TestClient

from chart_studio_api.config import Settings, get_settings
from chart_studio_api.main import app

URL = "/api/v1/datasets/parse"


def test_parse_returns_every_row(client: TestClient) -> None:
    lines = "".join(f"{i},{i * 2}\n" for i in range(100))
    response = client.post(URL, files={"file": ("data.csv", f"a,b\n{lines}".encode())})

    assert response.status_code == 200
    assert len(response.json()["data"]) == 100


def test_table_with_too_many_rows_is_rejected(client: TestClient) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(max_rows=1)
    try:
        response = client.post(URL, files={"file": ("data.csv", b"a,b\n1,2\n3,4\n")})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 413
