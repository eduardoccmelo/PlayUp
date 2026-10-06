"""Pure list-ordering rules for a game's roster and waiting list.

These functions decide *what* the two lists should look like. They never
touch the database; `app.domain.participants` applies the result inside the
locked transaction. Keeping them pure is what makes rules 13 and 14
testable without Postgres.

Rule 13 - the waiting list is FIFO and authoritative: promotion takes the
head, overflow from a shrunken roster is pushed to the front, new entries
append to the tail.

Rule 14 - the roster is stored paid-first, preserving relative order within
the paid and unpaid blocks. This is a stored order, not a display sort.
"""

from dataclasses import dataclass, replace
from uuid import UUID


@dataclass(frozen=True)
class ListEntry:
    """One participant's place in a list, as far as ordering cares."""

    id: UUID
    paid: bool = False
    position: int | None = None



def renumber[E: ListEntry](entries: list[E]) -> list[E]:
    """Assign contiguous positions 0..n-1 in the given order."""
    return [replace(entry, position=index) for index, entry in enumerate(entries)]


def paid_first[E: ListEntry](entries: list[E]) -> list[E]:
    """Rule 14. Stable: relative order inside each block is preserved."""
    return [e for e in entries if e.paid] + [e for e in entries if not e.paid]


def append_to_tail[E: ListEntry](entries: list[E], entry: E) -> list[E]:
    """Rule 13. A new waiting-list entry joins at the back of the queue."""
    return [*entries, entry]


def overflow_to_front[E: ListEntry](waiting: list[E], overflow: list[E]) -> list[E]:
    """Rule 13. Players bumped by a shrunken roster keep priority."""
    return [*overflow, *waiting]


def promote_from_head[E: ListEntry](
    confirmed: list[E], waiting: list[E], max_players: int
) -> tuple[list[E], list[E], list[E]]:
    """Fill free roster slots from the head of the waiting list.

    Returns (confirmed, waiting, promoted) - `promoted` is what the caller
    must notify about and flip to `confirmed`.
    """
    free_slots = max(max_players - len(confirmed), 0)
    promoted = waiting[:free_slots]
    return [*confirmed, *promoted], waiting[free_slots:], promoted


def shrink_to_capacity[E: ListEntry](
    confirmed: list[E], waiting: list[E], max_players: int
) -> tuple[list[E], list[E], list[E]]:
    """Trim the roster tail to `max_players`, pushing the overflow to the
    front of the waiting list.

    Returns (confirmed, waiting, overflow).
    """
    if len(confirmed) <= max_players:
        return confirmed, waiting, []
    kept, overflow = confirmed[:max_players], confirmed[max_players:]
    return kept, overflow_to_front(waiting, overflow), overflow


def settle[E: ListEntry](
    confirmed: list[E], waiting: list[E], max_players: int
) -> tuple[list[E], list[E], list[E], list[E]]:
    """Bring both lists to a legal state and renumber them.

    Applies, in order: paid-first on the roster (14), shrink overflow to the
    waiting-list front (13), promote from the head into any free slot (13),
    then contiguous renumbering of both lists.

    Returns (confirmed, waiting, promoted, overflow).
    """
    confirmed = paid_first(confirmed)
    confirmed, waiting, overflow = shrink_to_capacity(confirmed, waiting, max_players)
    confirmed, waiting, promoted = promote_from_head(confirmed, waiting, max_players)
    # A promoted player enters the roster unpaid, so re-apply rule 14 to keep
    # the stored order correct after the promotion.
    confirmed = paid_first(confirmed)
    return renumber(confirmed), renumber(waiting), promoted, overflow
