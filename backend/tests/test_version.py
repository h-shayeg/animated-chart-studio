"""The version number is written in four places. They must agree."""

import json
import re
import tomllib
from pathlib import Path

from fastapi.testclient import TestClient

from chart_studio_api.config import Settings

ROOT = Path(__file__).resolve().parents[2]
VERSION: str = Settings.model_fields["app_version"].default


def test_version_is_the_same_in_the_backend_and_the_frontend() -> None:
    project = tomllib.loads((ROOT / "backend/pyproject.toml").read_text())["project"]["version"]
    page = json.loads((ROOT / "frontend/package.json").read_text())["version"]
    lock = json.loads((ROOT / "frontend/package-lock.json").read_text())["version"]

    assert project == VERSION
    assert page == VERSION
    assert lock == VERSION


def test_newest_entry_of_the_changelog_is_this_version() -> None:
    changelog = (ROOT / "CHANGELOG.md").read_text()
    newest = re.search(r"^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}$", changelog, re.MULTILINE)

    assert newest is not None
    assert newest.group(1) == VERSION
    assert f"[{VERSION}]: https://github.com/" in changelog


def test_health_reports_the_version(client: TestClient) -> None:
    assert client.get("/health").json()["version"] == VERSION
