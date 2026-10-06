"""Rules 15 and 16, and parity with the frontend balancer."""

from uuid import uuid4

import pytest

from app.domain.enums import PlayerCondition, PlayerMobility, PlayerPosition
from app.domain.teams import (
    DrawPlayer,
    TeamDrawError,
    generate_balanced_teams,
    player_score,
)


def player(
    level: int | None = 3,
    position: PlayerPosition = PlayerPosition.NEUTRO,
    mobility: PlayerMobility = PlayerMobility.NEUTRO,
    condition: PlayerCondition = PlayerCondition.NEUTRO,
    name: str = "",
) -> DrawPlayer:
    return DrawPlayer(
        identifier=uuid4(),
        level=level,
        position=position,
        mobility=mobility,
        condition=condition,
        display_name=name,
    )


def test_outfield_score_adds_mobility_and_condition() -> None:
    assert player_score(
        player(level=4, mobility=PlayerMobility.RAPIDO, condition=PlayerCondition.RUIM)
    ) == pytest.approx(4.0)


def test_goalkeepers_use_their_own_level_curve() -> None:
    assert player_score(player(level=5, position=PlayerPosition.GOLEIRO)) == pytest.approx(5.25)
    assert player_score(player(level=1, position=PlayerPosition.GOLEIRO)) == pytest.approx(0.75)


def test_draw_rejects_unrated_players_by_name() -> None:
    with pytest.raises(TeamDrawError, match="Dana"):
        generate_balanced_teams(
            [player(name="Ana"), player(level=None, name="Dana")]
        )


def test_two_goalkeepers_are_never_on_the_same_team() -> None:
    players = [
        player(position=PlayerPosition.GOLEIRO, name="keeper-a"),
        player(position=PlayerPosition.GOLEIRO, name="keeper-b"),
        *[player(name=f"outfield-{index}") for index in range(6)],
    ]
    result = generate_balanced_teams(players)

    keepers_a = [p for p in result.team_a if p.position is PlayerPosition.GOLEIRO]
    keepers_b = [p for p in result.team_b if p.position is PlayerPosition.GOLEIRO]
    assert len(keepers_a) == 1 and len(keepers_b) == 1


def test_teams_split_evenly_and_scores_are_close() -> None:
    players = [player(level=(index % 5) + 1, name=f"p{index}") for index in range(10)]
    result = generate_balanced_teams(players)

    assert len(result.team_a) == 5 and len(result.team_b) == 5
    assert abs(result.score_a - result.score_b) <= 1
    assert {p.identifier for p in result.team_a}.isdisjoint(
        {p.identifier for p in result.team_b}
    )


def test_a_draw_needs_two_players() -> None:
    with pytest.raises(TeamDrawError):
        generate_balanced_teams([player()])
