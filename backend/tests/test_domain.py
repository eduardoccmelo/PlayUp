from datetime import UTC, date, datetime, time

import pytest

from app.core.time import to_instant
from app.domain.ordering import OrderedEntry, overflow_to_front, paid_first
from app.domain.teams import DrawPlayer, TeamDrawError, validate_draw_players


def test_wall_clock_conversion_respects_group_timezone() -> None:
    assert to_instant(date(2026, 1, 15), time(19), "Europe/Lisbon") == datetime(2026, 1, 15, 19, tzinfo=UTC)


def test_paid_first_preserves_order_within_each_block() -> None:
    entries = [OrderedEntry("a"), OrderedEntry("b", paid=True), OrderedEntry("c"), OrderedEntry("d", paid=True)]
    assert [entry.identifier for entry in paid_first(entries)] == ["b", "d", "a", "c"]


def test_overflow_is_pushed_to_waitlist_head() -> None:
    result = overflow_to_front([OrderedEntry("c")], [OrderedEntry("a"), OrderedEntry("b")])
    assert [entry.identifier for entry in result] == ["a", "b", "c"]


def test_draw_rejects_unrated_players() -> None:
    with pytest.raises(TeamDrawError, match="p2"):
        validate_draw_players([DrawPlayer("p1", 3), DrawPlayer("p2", None)])