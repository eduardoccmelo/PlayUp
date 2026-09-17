"""Game scheduling and the viewer's calculated permissions."""

from dataclasses import dataclass
from datetime import date, time
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import generate_code, generate_slug, hash_token
from app.core.time import wall_clock_window
from app.db.models import Game, GameAccessRequest, GameParticipant, Group
from app.domain.enums import (
    AccessStatus,
    CancelReason,
    GameStatus,
    GroupRole,
    ParticipantStatus,
)
from app.domain.errors import Conflict, NotFound
from app.domain.groups import find_membership, get_group

JOIN_CODE_LENGTH = 8


@dataclass
class CreatedGame:
    game: Game
    join_code: str


@dataclass
class ViewerAccess:
    """§6.3. The frontend must never infer authorization from ids or UI
    state, so every capability is decided here and sent explicitly."""

    kind: str  # "admin" | "member" | "guest" | "none"
    status: str | None
    can_view_details: bool
    can_view_group_players: bool
    can_join: bool
    can_leave: bool
    can_update_own_payment: bool
    can_draw_teams: bool
    can_manage_game: bool



async def create_game(
    session: AsyncSession,
    *,
    group_id: UUID,
    created_by_user_id: UUID,
    game_date: date,
    start_time: time,
    duration_minutes: int,
    max_players: int,
    **fields: object,
) -> CreatedGame:
    group = await get_group(session, group_id)
    starts_at, end_time, ends_at = wall_clock_window(
        game_date, start_time, duration_minutes, group.timezone
    )
    join_code = generate_code(JOIN_CODE_LENGTH)
    game = Game(
        group_id=group_id,
        public_slug=generate_slug(f"{group.name}-{game_date.isoformat()}"),
        join_code_hash=hash_token(join_code),
        join_code_prefix=join_code[:4],
        game_date=game_date,
        start_time=start_time,
        end_time=end_time,
        duration_minutes=duration_minutes,
        starts_at=starts_at,
        ends_at=ends_at,
        max_players=max_players,
        created_by_user_id=created_by_user_id,
        **fields,
    )
    session.add(game)
    await session.flush()
    return CreatedGame(game=game, join_code=join_code)


async def get_game(session: AsyncSession, game_id: UUID) -> Game:
    game = await session.get(Game, game_id)
    if game is None:
        raise NotFound("Game not found")
    return game


def recompute_schedule(game: Game, group: Group) -> None:
    """§6.2: any write touching date, time, duration or the group timezone
    recomputes both instants in the same statement."""
    game.starts_at, game.end_time, game.ends_at = wall_clock_window(
        game.game_date, game.start_time, game.duration_minutes, group.timezone
    )


async def cancel_game(
    session: AsyncSession, *, game_id: UUID, reason: CancelReason
) -> Game:
    """Rule 17: cancellation always records its cause."""
    from app.core.time import utcnow

    game = await get_game(session, game_id)
    if game.status is GameStatus.CANCELLED:
        raise Conflict("Game is already cancelled")
    game.status = GameStatus.CANCELLED
    game.cancelled_at = utcnow()
    game.cancel_reason = reason
    await session.flush()
    return game


async def confirmed_count(session: AsyncSession, game_id: UUID) -> int:
    return (
        await session.execute(
            select(func.count())
            .select_from(GameParticipant)
            .where(
                GameParticipant.game_id == game_id,
                GameParticipant.status == ParticipantStatus.CONFIRMED,
            )
        )
    ).scalar_one()


async def viewer_access(
    session: AsyncSession, *, game: Game, user_id: UUID | None
) -> ViewerAccess:
    if user_id is None:
        return ViewerAccess(
            kind="none",
            status=None,
            can_view_details=False,
            can_view_group_players=False,
            can_join=False,
            can_leave=False,
            can_update_own_payment=False,
            can_draw_teams=False,
            can_manage_game=False,
        )

    membership = await find_membership(session, group_id=game.group_id, user_id=user_id)
    open_game = game.status is GameStatus.ACTIVE

    if membership is not None:
        is_admin = membership.role is GroupRole.ADMIN
        return ViewerAccess(
            kind="admin" if is_admin else "member",
            status="active",
            can_view_details=True,
            # Rule 5 only withholds the directory from guests.
            can_view_group_players=True,
            can_join=open_game,
            can_leave=open_game,
            can_update_own_payment=True,
            can_draw_teams=is_admin and open_game,
            can_manage_game=is_admin,
        )

    request = (
        await session.execute(
            select(GameAccessRequest)
            .where(
                GameAccessRequest.game_id == game.id,
                GameAccessRequest.user_id == user_id,
            )
            .order_by(GameAccessRequest.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    if request is None:
        return ViewerAccess(
            kind="none",
            status=None,
            can_view_details=False,
            can_view_group_players=False,
            can_join=False,
            can_leave=False,
            can_update_own_payment=False,
            can_draw_teams=False,
            can_manage_game=False,
        )

    approved = request.status is AccessStatus.APPROVED
    # Rule 6: a pending guest sees the game but every action is blocked.
    # Rule 8: approval grants this one game, never the group directory.
    return ViewerAccess(
        kind="guest",
        status=request.status.value,
        can_view_details=request.status
        in (AccessStatus.PENDING, AccessStatus.APPROVED),
        can_view_group_players=False,
        can_join=approved and open_game,
        can_leave=approved and open_game,
        can_update_own_payment=approved,
        can_draw_teams=False,
        can_manage_game=False,
    )
