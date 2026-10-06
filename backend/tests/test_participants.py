"""The transactional core: rules 4, 9, 11, 13 and 14 against real Postgres."""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Notification
from app.domain.enums import NotificationType, ParticipantStatus
from app.domain.errors import Conflict
from app.domain.participants import (
    join_game,
    leave_game,
    reorder_list,
    resettle_after_capacity_change,
    set_payment,
)
from tests.factories import make_game, make_group, make_player, make_user

pytestmark = pytest.mark.db


async def scenario(session: AsyncSession, max_players: int = 3, players: int = 0):
    user = await make_user(session, "owner@example.com")
    group = await make_group(session, user.id)
    game = await make_game(session, group.id, user.id, max_players=max_players)
    profiles = [
        await make_player(session, group.id, f"Player {index}") for index in range(players)
    ]
    return user, group, game, profiles


async def roster(session: AsyncSession, game_id) -> tuple[list[str], list[str]]:
    from app.db.models import GameParticipant

    rows = (
        (
            await session.execute(
                select(GameParticipant).where(GameParticipant.game_id == game_id)
            )
        )
        .scalars()
        .all()
    )
    confirmed = sorted(
        (r for r in rows if r.status is ParticipantStatus.CONFIRMED),
        key=lambda r: r.list_position,
    )
    waiting = sorted(
        (r for r in rows if r.status is ParticipantStatus.WAITING_LIST),
        key=lambda r: r.list_position,
    )
    return (
        [r.display_name_snapshot for r in confirmed],
        [r.display_name_snapshot for r in waiting],
    )


async def join_all(session, game, profiles) -> list:
    changes = []
    for profile in profiles:
        changes.append(
            await join_game(
                session,
                game_id=game.id,
                player_id=profile.id,
                user_id=None,
                display_name=profile.display_name,
            )
        )
    return changes


async def test_joining_a_full_game_lands_on_the_waiting_list_tail(
    session: AsyncSession,
) -> None:
    _, _, game, profiles = await scenario(session, max_players=2, players=4)
    await join_all(session, game, profiles)

    confirmed, waiting = await roster(session, game.id)
    assert confirmed == ["Player 0", "Player 1"]
    assert waiting == ["Player 2", "Player 3"]


async def test_positions_are_always_contiguous_from_zero(session: AsyncSession) -> None:
    from app.db.models import GameParticipant

    _, _, game, profiles = await scenario(session, max_players=2, players=4)
    await join_all(session, game, profiles)

    rows = (
        (
            await session.execute(
                select(GameParticipant).where(GameParticipant.game_id == game.id)
            )
        )
        .scalars()
        .all()
    )
    for status in (ParticipantStatus.CONFIRMED, ParticipantStatus.WAITING_LIST):
        positions = sorted(r.list_position for r in rows if r.status is status)
        assert positions == list(range(len(positions)))


async def test_leaving_promotes_the_waiting_list_head(session: AsyncSession) -> None:
    _, _, game, profiles = await scenario(session, max_players=2, players=4)
    changes = await join_all(session, game, profiles)

    await leave_game(
        session,
        game_id=game.id,
        participant_id=changes[0].participant.id,
        actor_user_id=None,
    )

    confirmed, waiting = await roster(session, game.id)
    assert confirmed == ["Player 1", "Player 2"]
    assert waiting == ["Player 3"]


async def test_paying_moves_a_player_ahead_of_the_unpaid_block(
    session: AsyncSession,
) -> None:
    """Rule 14 - and the order inside each block is preserved."""
    _, _, game, profiles = await scenario(session, max_players=4, players=4)
    changes = await join_all(session, game, profiles)

    await set_payment(
        session,
        game_id=game.id,
        participant_id=changes[2].participant.id,
        paid=True,
        actor_user_id=None,
    )

    confirmed, _ = await roster(session, game.id)
    assert confirmed == ["Player 2", "Player 0", "Player 1", "Player 3"]


async def test_shrinking_the_roster_bumps_the_tail_to_the_waiting_front(
    session: AsyncSession,
) -> None:
    """Rule 13 - the bumped player outranks people who were already waiting."""
    _, _, game, profiles = await scenario(session, max_players=3, players=4)
    await join_all(session, game, profiles)
    assert (await roster(session, game.id)) == (
        ["Player 0", "Player 1", "Player 2"],
        ["Player 3"],
    )

    game.max_players = 2
    await session.flush()
    await resettle_after_capacity_change(session, game_id=game.id)

    confirmed, waiting = await roster(session, game.id)
    assert confirmed == ["Player 0", "Player 1"]
    assert waiting == ["Player 2", "Player 3"]


async def test_growing_the_roster_promotes_from_the_head(session: AsyncSession) -> None:
    _, _, game, profiles = await scenario(session, max_players=2, players=4)
    await join_all(session, game, profiles)

    game.max_players = 4
    await session.flush()
    await resettle_after_capacity_change(session, game_id=game.id)

    confirmed, waiting = await roster(session, game.id)
    assert confirmed == ["Player 0", "Player 1", "Player 2", "Player 3"]
    assert waiting == []


async def test_duplicate_names_are_refused_ignoring_case_and_spacing(
    session: AsyncSession,
) -> None:
    """Rule 11, caught in the service so the caller gets a 409 not a 500."""
    _, group, game, profiles = await scenario(session, max_players=4, players=1)
    await join_all(session, game, profiles)
    other = await make_player(session, group.id, "Someone Else")

    with pytest.raises(Conflict):
        await join_game(
            session,
            game_id=game.id,
            player_id=other.id,
            user_id=None,
            display_name="  player   0 ",
        )


async def test_rejoining_after_leaving_reuses_the_row(session: AsyncSession) -> None:
    _, _, game, profiles = await scenario(session, max_players=2, players=1)
    changes = await join_all(session, game, profiles)
    await leave_game(
        session,
        game_id=game.id,
        participant_id=changes[0].participant.id,
        actor_user_id=None,
    )

    again = await join_game(
        session,
        game_id=game.id,
        player_id=profiles[0].id,
        user_id=None,
        display_name="Player 0",
    )

    assert again.participant.id == changes[0].participant.id
    assert (await roster(session, game.id))[0] == ["Player 0"]


async def test_a_manual_reorder_still_keeps_paid_players_first(
    session: AsyncSession,
) -> None:
    _, _, game, profiles = await scenario(session, max_players=4, players=3)
    changes = await join_all(session, game, profiles)
    await set_payment(
        session,
        game_id=game.id,
        participant_id=changes[0].participant.id,
        paid=True,
        actor_user_id=None,
    )

    await reorder_list(
        session,
        game_id=game.id,
        status=ParticipantStatus.CONFIRMED,
        ordered_ids=[
            changes[2].participant.id,
            changes[1].participant.id,
            changes[0].participant.id,
        ],
    )

    confirmed, _ = await roster(session, game.id)
    assert confirmed == ["Player 0", "Player 2", "Player 1"]


async def test_admins_are_notified_of_joins_leaves_and_payments(
    session: AsyncSession,
) -> None:
    """Rule 9."""
    _, group, game, profiles = await scenario(session, max_players=4, players=1)
    changes = await join_all(session, game, profiles)
    await set_payment(
        session,
        game_id=game.id,
        participant_id=changes[0].participant.id,
        paid=True,
        actor_user_id=None,
    )
    await leave_game(
        session,
        game_id=game.id,
        participant_id=changes[0].participant.id,
        actor_user_id=None,
    )

    rows = (
        (await session.execute(select(Notification).where(Notification.group_id == group.id)))
        .scalars()
        .all()
    )
    assert {row.type for row in rows} >= {
        NotificationType.PLAYER_JOINED,
        NotificationType.PAYMENT_STATUS_CHANGED,
        NotificationType.PLAYER_LEFT,
    }


async def test_a_cancelled_game_refuses_new_joins(session: AsyncSession) -> None:
    from app.domain.enums import CancelReason
    from app.domain.games import cancel_game

    _, _, game, profiles = await scenario(session, max_players=4, players=1)
    await cancel_game(session, game_id=game.id, reason=CancelReason.MANUAL)

    with pytest.raises(Conflict):
        await join_game(
            session,
            game_id=game.id,
            player_id=profiles[0].id,
            user_id=None,
            display_name="Player 0",
        )
