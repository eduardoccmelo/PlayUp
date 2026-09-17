from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PlayUp API"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://playup:playup@localhost:5432/playup"

    #: How long a session token stays valid after it is issued.
    session_ttl_days: int = 30
    #: Hours before kickoff that the sweep cancels a game short of min_players.
    default_auto_cancellation_hours: int = 4

    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    model_config = SettingsConfigDict(env_file=".env", env_prefix="PLAYUP_", extra="ignore")

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def exposes_access_codes(self) -> bool:
        """Outside production the access code comes back in the response, so
        local development and tests do not need a working mailbox."""
        return not self.is_production


@lru_cache
def get_settings() -> Settings:
    return Settings()
