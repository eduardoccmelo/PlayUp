from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PlayUp API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://playup:playup@localhost:5432/playup"
    access_token_ttl_days: int = 30

    model_config = SettingsConfigDict(env_file=".env", env_prefix="PLAYUP_", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()