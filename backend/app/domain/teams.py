from dataclasses import dataclass


@dataclass(frozen=True)
class DrawPlayer:
    identifier: str
    level: int | None


class TeamDrawError(ValueError):
    pass


def validate_draw_players(players: list[DrawPlayer]) -> None:
    unrated = [player.identifier for player in players if player.level is None]
    if unrated:
        raise TeamDrawError(f"Every confirmed player needs a level: {', '.join(unrated)}")