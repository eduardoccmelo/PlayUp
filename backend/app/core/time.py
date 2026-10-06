"""Wall-clock <-> instant conversion.

Games are scheduled in the group's local wall clock. `starts_at`/`ends_at`
are the derived instants and must be recomputed whenever the date, time,
duration or group timezone changes.
"""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo


def utcnow() -> datetime:
    return datetime.now(UTC)


def to_instant(game_date: date, start: time, timezone: str) -> datetime:
    local = datetime.combine(game_date, start, tzinfo=ZoneInfo(timezone))
    return local.astimezone(UTC)


def end_instant(starts_at: datetime, duration_minutes: int) -> datetime:
    return starts_at + timedelta(minutes=duration_minutes)


def wall_clock_window(
    game_date: date, start: time, duration_minutes: int, timezone: str
) -> tuple[datetime, time, datetime]:
    """Return (starts_at, end_time, ends_at) for one scheduling change."""
    starts_at = to_instant(game_date, start, timezone)
    ends_at = end_instant(starts_at, duration_minutes)
    end_time = ends_at.astimezone(ZoneInfo(timezone)).time()
    return starts_at, end_time, ends_at
