from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, overridable with CHART_STUDIO_* environment variables."""

    app_name: str = "Animated Chart Studio API"
    app_version: str = "0.1.0"
    debug: bool = False
    max_upload_bytes: int = 10 * 1024 * 1024
    max_rows: int = 50_000

    model_config = SettingsConfigDict(env_prefix="CHART_STUDIO_", env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
