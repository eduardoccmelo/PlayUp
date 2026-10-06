"""Test fixtures.

The schema leans on partial indexes, generated columns and a deferrable
unique constraint, none of which SQLite can emulate, so the database tests
run against a real PostgreSQL.

Point `PLAYUP_TEST_DATABASE_URL` at an instance, or let testcontainers start
one. If neither is available the `db` tests skip rather than fail.
"""

import os
from collections.abc import AsyncIterator, Iterator

import pytest

TEST_URL_ENV = "PLAYUP_TEST_DATABASE_URL"


@pytest.fixture(scope="session")
def database_url() -> Iterator[str]:
    url = os.environ.get(TEST_URL_ENV)
    if url:
        yield url
        return

    try:
        from testcontainers.postgres import PostgresContainer
    except ImportError:  # pragma: no cover - depends on the dev extra
        pytest.skip(f"set {TEST_URL_ENV} or install testcontainers")

    try:
        with PostgresContainer("postgres:16", driver="psycopg") as container:
            yield container.get_connection_url()
    except Exception as error:  # noqa: BLE001 - any failure here means "no database"
        pytest.skip(f"could not start PostgreSQL: {error}")


@pytest.fixture(scope="session")
def migrated_database(database_url: str) -> str:
    """Apply every migration once, then hand the URL to the tests."""
    os.environ["PLAYUP_DATABASE_URL"] = database_url
    os.environ["PLAYUP_ENVIRONMENT"] = "test"

    from alembic import command
    from alembic.config import Config

    from app.core.config import get_settings

    get_settings.cache_clear()

    config = Config("alembic.ini")
    config.set_main_option("script_location", "migrations")
    command.upgrade(config, "head")
    return database_url


TABLES = (
    "notification_recipients, notifications, invites, game_access_requests,"
    " game_participants, games, player_profiles, group_memberships, groups,"
    " user_sessions, users"
)


async def _truncate(url: str) -> None:
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(url)
    async with engine.begin() as connection:
        await connection.execute(text(f"TRUNCATE {TABLES} RESTART IDENTITY CASCADE"))
    await engine.dispose()


@pytest.fixture
async def clean_database(migrated_database: str) -> AsyncIterator[str]:
    """Hand back an empty database, and empty it again afterwards.

    Every database test depends on this - without it the HTTP tests leak
    users and groups into each other.
    """
    await _truncate(migrated_database)
    yield migrated_database
    await _truncate(migrated_database)


@pytest.fixture
async def session(clean_database: str) -> AsyncIterator["AsyncSession"]:  # noqa: F821
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    engine = create_async_engine(clean_database)
    factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    async with factory() as db_session:
        yield db_session
        await db_session.rollback()
    await engine.dispose()
