from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo


def to_instant(game_date: date, start: time, timezone: str) -> datetime:
    local = datetime.combine(game_date, start, tzinfo=ZoneInfo(timezone))
    return local.astimezone(UTC)


def end_instant(starts_at: datetime, duration_minutes: int) -> datetime:
    return starts_at + timedelta(minutes=duration_minutes)