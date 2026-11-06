from fastapi.testclient import TestClient

URL = "/api/v1/datasets/parse"
CSV = b"a,b\n1,2\n3,4\n5,6\n"


def test_first_row_is_the_header_by_default(client: TestClient) -> None:
    response = client.post(URL, files={"file": ("data.csv", CSV)})

    body = response.json()
    assert body["rows"] == 3
    assert [column["name"] for column in body["columns"]] == ["a", "b"]


def test_header_can_be_turned_off(client: TestClient) -> None:
    response = client.post(URL, files={"file": ("data.csv", CSV)}, data={"header": "false"})

    body = response.json()
    assert body["rows"] == 4
    assert [column["name"] for column in body["columns"]] == ["Column 1", "Column 2"]
    assert body["data"][0] == {"Column 1": "a", "Column 2": "b"}
