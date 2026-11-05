from fastapi import FastAPI

from chart_studio_api.api import health
from chart_studio_api.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version=settings.app_version, debug=settings.debug)
    app.include_router(health.router)
    return app


app = create_app()
