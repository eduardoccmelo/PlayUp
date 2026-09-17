"""The migration is the schema contract - these assert the parts the
application relies on but cannot enforce itself."""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from tests.factories import make_game, make_group, make_player, make_user

pytestmark = pytest.mark.db


async def test_every_table_and_the_summary_view_exist(session: AsyncSession) -> None:
    rows = await session.execute(
        text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
    )
    present = {row[0] for row in rows}
    assert {
        "users", "user_sessions", "groups", "group_memberships", "player_profiles",
        "games", "game_participants", "game_access_requests", "invites",
        "notifications", "notification_recipients", "game_summary",
    } <= present


async def test_names_are_unique_per_group_ignoring_case_and_spacing(
    session: AsyncSession,
) -> None:
    """Rule 11, enforced by the generated column plus partial unique index."""
    user = await make_user(session, "owner@example.com")
    group = await make_group(session, user.id)
    await make_player(session, group.id, "Alex Morgan")

    with pytest.raises(IntegrityError):
        await make_player(session, group.id, "  alex   MORGAN ")


async def test_an_archived_name_can_be_reused(session: AsyncSession) -> None:
    from app.core.time import utcnow

    user = await make_user(session, "owner@example.com")
    group = await make_group(session, user.id)
    first = await make_player(session, group.id, "Alex Morgan")
    first.archived_at = utcnow()
    await session.flush()

    await make_player(session, group.id, "Alex Morgan")  # must not raise


async def test_a_player_with_game_history_cannot_be_deleted(session: AsyncSession) -> None:
    """Rule 18 - archive, never delete. ON DELETE RESTRICT is what enforces it."""
    from app.domain.participants import join_game

    user = await make_user(session, "owner@example.com")
    group = await make_group(session, user.id)
    player = await make_player(session, group.id, "Alex Morgan")
    game = await make_game(session, group.id, user.id)
    await join_game(
        session, game_id=game.id, player_id=player.id, user_id=None, display_name="Alex Morgan"
    )

    with pytest.raises(IntegrityError):
        await session.execute(
            text("DELETE FROM player_profiles WHERE id = :id"), {"id": player.id}
        )


async def test_a_cancelled_game_must_record_when_it_was_cancelled(
    session: AsyncSession,
) -> None:
    """Rule 17 - the status and the timestamp cannot disagree."""
    user = await make_user(session, "owner@example.com")
    group = await make_group(session, user.id)
    game = await make_game(session, group.id, user.id)

    with pytest.raises(IntegrityError):
        await session.execute(
            text("UPDATE games SET status = 'cancelled' WHERE id = :id"), {"id": game.id}
        )


async def test_scores_require_a_draw(session: AsyncSession) -> None:
    """Rule 15 - a score cannot exist without the draw that produced it."""
    user = await make_user(session, "owner@example.com")
    group = await make_group(session, user.id)
    game = await make_game(session, group.id, user.id)

    with pytest.raises(IntegrityError):
        await session.execute(
            text("UPDATE games SET teams_drawn_at = now() WHERE id = :id"), {"id": game.id}
        )


async def test_the_list_order_constraint_is_deferred_to_commit(
    session: AsyncSession,
) -> None:
    """A renumber writes overlapping positions mid-transaction; the
    constraint must only complain at COMMIT."""
    from app.domain.participants import join_game

    user = await make_user(session, "owner@example.com")
    group = await make_group(session, user.id)
    game = await make_game(session, group.id, user.id, max_players=4)
    for index in range(2):
        player = await make_player(session, group.id, f"Player {index}")
        await join_game(
            session,
            game_id=game.id,
            player_id=player.id,
            user_id=None,
            display_name=f"Player {index}",
        )

    # Deliberately collide, then fix it before the statement batch ends.
    await session.execute(text("UPDATE game_participants SET list_position = 0"))
    await session.execute(
        text(
            "UPDATE game_participants SET list_position = sub.position FROM ("
            " SELECT id, row_number() OVER (ORDER BY joined_at) - 1 AS position"
            " FROM game_participants) sub WHERE game_participants.id = sub.id"
        )
    )
    await session.flush()  # would have raised already were it not deferred
