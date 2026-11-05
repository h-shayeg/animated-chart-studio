import pytest
from fastapi.testclient import TestClient

from chart_studio_api.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
