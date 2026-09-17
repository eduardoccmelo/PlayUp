"""Small builders so the database tests read as scenarios, not as setup."""

from datetime import date, time
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_secret
from app.db.models import PlayerProfile, User
from app.domain import games as games_domain
from app.domain import groups as groups_domain


async def make_user(session: AsyncSession, email: str, name: str = "Test User") -> User:
    user = User(email=email, display_name=name, access_code_hash=hash_secret("code"))
    session.add(user)
    await session.flush()
    return user


async def make_group(session: AsyncSession, creator_id: UUID, name: str = "Test Group"):
    created = await groups_domain.create_group(
        session, name=name, creator_id=creator_id, organizer_passcode="passcode"
    )
    return created.group


async def make_player(
    session: AsyncSession, group_id: UUID, name: str, level: int | None = 3
) -> PlayerProfile:
    player = PlayerProfile(group_id=group_id, display_name=name, level=level)
    session.add(player)
    await session.flush()
    return player


async def make_game(
    session: AsyncSession, group_id: UUID, creator_id: UUID, max_players: int = 4
):
    created = await games_domain.create_game(
        session,
        group_id=group_id,
        created_by_user_id=creator_id,
        game_date=date(2026, 6, 1),
        start_time=time(19),
        duration_minutes=75,
        max_players=max_players,
    )
    return created.game
