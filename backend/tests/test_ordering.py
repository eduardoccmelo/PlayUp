"""Rules 13 and 14, with no database in the way."""

from uuid import UUID, uuid4

from app.domain.ordering import (
    ListEntry,
    overflow_to_front,
    paid_first,
    promote_from_head,
    renumber,
    settle,
    shrink_to_capacity,
)


def entry(name: str, paid: bool = False) -> ListEntry:
    """A stable id per name, so assertions can read as names."""
    return ListEntry(id=UUID(int=abs(hash(name)) % (2**128)), paid=paid)


def names(entries: list[ListEntry], table: dict[UUID, str]) -> list[str]:
    return [table[e.id] for e in entries]


def build(*specs: tuple[str, bool]) -> tuple[list[ListEntry], dict[UUID, str]]:
    entries = []
    table: dict[UUID, str] = {}
    for name, paid in specs:
        identifier = uuid4()
        entries.append(ListEntry(id=identifier, paid=paid))
        table[identifier] = name
    return entries, table


def test_renumber_assigns_contiguous_positions() -> None:
    entries, _ = build(("a", False), ("b", False), ("c", False))
    assert [e.position for e in renumber(entries)] == [0, 1, 2]


def test_paid_first_preserves_order_within_each_block() -> None:
    entries, table = build(("a", False), ("b", True), ("c", False), ("d", True))
    assert names(paid_first(entries), table) == ["b", "d", "a", "c"]


def test_overflow_is_pushed_to_the_waiting_list_head() -> None:
    waiting, table = build(("c", False))
    overflow, overflow_table = build(("a", False), ("b", False))
    table |= overflow_table
    assert names(overflow_to_front(waiting, overflow), table) == ["a", "b", "c"]


def test_promotion_takes_the_waiting_list_head() -> None:
    confirmed, table = build(("a", False))
    waiting, waiting_table = build(("b", False), ("c", False))
    table |= waiting_table

    confirmed, waiting, promoted = promote_from_head(confirmed, waiting, max_players=2)

    assert names(confirmed, table) == ["a", "b"]
    assert names(waiting, table) == ["c"]
    assert names(promoted, table) == ["b"]


def test_shrinking_the_roster_bumps_the_tail_to_the_waiting_front() -> None:
    confirmed, table = build(("a", False), ("b", False), ("c", False))
    waiting, waiting_table = build(("d", False))
    table |= waiting_table

    confirmed, waiting, overflow = shrink_to_capacity(confirmed, waiting, max_players=2)

    assert names(confirmed, table) == ["a", "b"]
    # 'c' lost its slot to a shrink, so it keeps priority over 'd'.
    assert names(waiting, table) == ["c", "d"]
    assert names(overflow, table) == ["c"]


def test_settle_applies_paid_first_then_promotes_and_renumbers() -> None:
    confirmed, table = build(("unpaid", False), ("paid", True))
    waiting, waiting_table = build(("next", False))
    table |= waiting_table

    confirmed, waiting, promoted, overflow = settle(confirmed, waiting, max_players=3)

    assert names(confirmed, table) == ["paid", "unpaid", "next"]
    assert [e.position for e in confirmed] == [0, 1, 2]
    assert names(promoted, table) == ["next"]
    assert waiting == [] and overflow == []


def test_settle_is_idempotent() -> None:
    confirmed, _ = build(("a", True), ("b", False))
    waiting, _ = build(("c", False))

    once = settle(confirmed, waiting, max_players=2)
    twice = settle(list(once[0]), list(once[1]), max_players=2)

    assert [e.id for e in once[0]] == [e.id for e in twice[0]]
    assert [e.id for e in once[1]] == [e.id for e in twice[1]]
