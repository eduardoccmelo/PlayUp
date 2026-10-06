"""Team drawing - a port of `src/utils/teamBalancer.ts`.

Scores and the comparison order must stay identical to the frontend's, so a
draw computed here matches what organizers saw in the localStorage version.

Rule 15: the result is stored, never recomputed. Rule 16: every confirmed
player must have a level before a draw is allowed.
"""

from dataclasses import dataclass
from decimal import Decimal
from itertools import combinations
from math import ceil
from uuid import UUID

from app.domain.enums import PlayerCondition, PlayerMobility, PlayerPosition

#: Goalkeepers are scored on their own curve - a level 5 keeper is worth
#: slightly more than a level 5 outfield player, a level 1 keeper much less.
GOALKEEPER_LEVEL_SCORES: dict[int, float] = {1: 0.75, 2: 1.75, 3: 3.0, 4: 4.25, 5: 5.25}

MOBILITY_SCORES = {PlayerMobility.RAPIDO: 0.25, PlayerMobility.LENTO: -0.25}
CONDITION_SCORES = {PlayerCondition.BOA: 0.25, PlayerCondition.RUIM: -0.25}

#: Above this, an exhaustive search of every split gets expensive, so we fall
#: back to greedy seeding plus pairwise improvement.
EXHAUSTIVE_LIMIT = 20


class TeamDrawError(ValueError):
    """The draw cannot proceed - the message names the offending players."""


@dataclass(frozen=True)
class DrawPlayer:
    identifier: UUID
    level: int | None
    mobility: PlayerMobility = PlayerMobility.NEUTRO
    condition: PlayerCondition = PlayerCondition.NEUTRO
    position: PlayerPosition = PlayerPosition.NEUTRO
    display_name: str = ""


@dataclass(frozen=True)
class DrawResult:
    team_a: list[DrawPlayer]
    team_b: list[DrawPlayer]
    score_a: Decimal
    score_b: Decimal


@dataclass(frozen=True, order=True)
class _Balance:
    """Ordered by the frontend's tie-break priority: positions, then score,
    then the remaining attributes. Lower is better."""

    position_difference: int
    score_difference: float
    attribute_difference: int


def player_score(player: DrawPlayer) -> float:
    if player.level is None:
        raise TeamDrawError(f"Player {player.identifier} has no level")
    if player.position is PlayerPosition.GOLEIRO:
        level = GOALKEEPER_LEVEL_SCORES[player.level]
    else:
        level = float(player.level)
    return (
        level
        + MOBILITY_SCORES.get(player.mobility, 0.0)
        + CONDITION_SCORES.get(player.condition, 0.0)
    )


def team_score(players: list[DrawPlayer]) -> float:
    return sum(player_score(player) for player in players)


def validate_draw_players(players: list[DrawPlayer]) -> None:
    """Rule 16. Rejects the draw and names every unrated player."""
    unrated = [player.display_name or str(player.identifier)
               for player in players if player.level is None]
    if unrated:
        raise TeamDrawError(
            f"Every confirmed player needs a level: {', '.join(sorted(unrated))}"
        )


def _count(players: list[DrawPlayer], predicate) -> int:  # type: ignore[no-untyped-def]
    return sum(1 for player in players if predicate(player))


def _balance_of(team_a: list[DrawPlayer], team_b: list[DrawPlayer]) -> _Balance:
    position_difference = sum(
        abs(
            _count(team_a, lambda p, pos=position: p.position is pos)
            - _count(team_b, lambda p, pos=position: p.position is pos)
        )
        for position in PlayerPosition
    )
    attribute_difference = (
        abs(_count(team_a, lambda p: p.mobility is PlayerMobility.RAPIDO)
            - _count(team_b, lambda p: p.mobility is PlayerMobility.RAPIDO))
        + abs(_count(team_a, lambda p: p.mobility is PlayerMobility.LENTO)
              - _count(team_b, lambda p: p.mobility is PlayerMobility.LENTO))
        + abs(_count(team_a, lambda p: p.condition is PlayerCondition.BOA)
              - _count(team_b, lambda p: p.condition is PlayerCondition.BOA))
        + abs(_count(team_a, lambda p: p.condition is PlayerCondition.RUIM)
              - _count(team_b, lambda p: p.condition is PlayerCondition.RUIM))
    )
    return _Balance(
        position_difference=position_difference,
        score_difference=abs(team_score(team_a) - team_score(team_b)),
        attribute_difference=attribute_difference,
    )


def _splits_goalkeepers(
    team_a: list[DrawPlayer], team_b: list[DrawPlayer], total_goalkeepers: int
) -> bool:
    """With two or more keepers available, neither team may go without one."""
    if total_goalkeepers < 2:
        return True
    return (
        _count(team_a, lambda p: p.position is PlayerPosition.GOLEIRO) > 0
        and _count(team_b, lambda p: p.position is PlayerPosition.GOLEIRO) > 0
    )


def _exhaustive(players: list[DrawPlayer], team_a_size: int) -> list[DrawPlayer] | None:
    total_goalkeepers = _count(players, lambda p: p.position is PlayerPosition.GOLEIRO)
    best_team: list[DrawPlayer] | None = None
    best_balance: _Balance | None = None

    for indices in combinations(range(len(players)), team_a_size):
        selected = set(indices)
        team_a = [players[index] for index in indices]
        team_b = [p for index, p in enumerate(players) if index not in selected]
        if not _splits_goalkeepers(team_a, team_b, total_goalkeepers):
            continue
        balance = _balance_of(team_a, team_b)
        if best_balance is None or balance < best_balance:
            best_balance, best_team = balance, team_a
    return best_team


def _greedy(players: list[DrawPlayer], team_a_size: int) -> list[DrawPlayer]:
    """Seed by descending score, alternating teams, then improve by swaps."""
    ordered = sorted(players, key=player_score, reverse=True)
    team_a = [p for index, p in enumerate(ordered) if index % 2 == 0][:team_a_size]
    selected = {p.identifier for p in team_a}
    team_b = [p for p in ordered if p.identifier not in selected]

    total_goalkeepers = _count(players, lambda p: p.position is PlayerPosition.GOLEIRO)
    improved = True
    while improved:
        improved = False
        current = _balance_of(team_a, team_b)
        for a_index, a_player in enumerate(team_a):
            for b_index, b_player in enumerate(team_b):
                candidate_a = [*team_a[:a_index], b_player, *team_a[a_index + 1:]]
                candidate_b = [*team_b[:b_index], a_player, *team_b[b_index + 1:]]
                if not _splits_goalkeepers(candidate_a, candidate_b, total_goalkeepers):
                    continue
                if _balance_of(candidate_a, candidate_b) < current:
                    team_a, team_b, improved = candidate_a, candidate_b, True
                    break
            if improved:
                break
    return team_a


def generate_balanced_teams(players: list[DrawPlayer]) -> DrawResult:
    validate_draw_players(players)
    if len(players) < 2:
        raise TeamDrawError("A draw needs at least two confirmed players")

    team_a_size = ceil(len(players) / 2)
    if len(players) <= EXHAUSTIVE_LIMIT:
        team_a = _exhaustive(players, team_a_size) or players[:team_a_size]
    else:
        team_a = _greedy(players, team_a_size)

    selected = {player.identifier for player in team_a}
    team_b = [player for player in players if player.identifier not in selected]
    return DrawResult(
        team_a=team_a,
        team_b=team_b,
        score_a=Decimal(str(round(team_score(team_a), 2))),
        score_b=Decimal(str(round(team_score(team_b), 2))),
    )
