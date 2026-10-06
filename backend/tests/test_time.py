from datetime import UTC, date, datetime, time

from app.core.time import end_instant, to_instant, wall_clock_window


def test_wall_clock_conversion_respects_the_group_timezone() -> None:
    assert to_instant(date(2026, 1, 15), time(19), "Europe/Lisbon") == datetime(
        2026, 1, 15, 19, tzinfo=UTC
    )
    assert to_instant(date(2026, 1, 15), time(19), "America/Sao_Paulo") == datetime(
        2026, 1, 15, 22, tzinfo=UTC
    )


def test_summer_time_shifts_the_instant_not_the_wall_clock() -> None:
    # Lisbon is UTC+1 in July, so the same 19:00 kickoff is 18:00 UTC.
    assert to_instant(date(2026, 7, 15), time(19), "Europe/Lisbon") == datetime(
        2026, 7, 15, 18, tzinfo=UTC
    )


def test_end_instant_adds_the_duration() -> None:
    starts_at = datetime(2026, 1, 15, 19, tzinfo=UTC)
    assert end_instant(starts_at, 75) == datetime(2026, 1, 15, 20, 15, tzinfo=UTC)


def test_wall_clock_window_returns_the_local_end_time() -> None:
    starts_at, end_time, ends_at = wall_clock_window(
        date(2026, 1, 15), time(19), 75, "Europe/Lisbon"
    )
    assert starts_at == datetime(2026, 1, 15, 19, tzinfo=UTC)
    assert end_time == time(20, 15)
    assert ends_at == datetime(2026, 1, 15, 20, 15, tzinfo=UTC)
