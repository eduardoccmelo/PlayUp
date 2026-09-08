from dataclasses import dataclass


@dataclass
class OrderedEntry:
    identifier: str
    paid: bool = False


def paid_first(entries: list[OrderedEntry]) -> list[OrderedEntry]:
    return [entry for entry in entries if entry.paid] + [entry for entry in entries if not entry.paid]


def overflow_to_front(waiting: list[OrderedEntry], overflow: list[OrderedEntry]) -> list[OrderedEntry]:
    return [*overflow, *waiting]