from datetime import date, datetime, time
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Computed,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    Text,
    Time,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at_column, pg_enum, updated_at_column
from app.domain.enums import (
    CancelReason,
    CurrencyCode,
    GameStatus,
    ParticipantStatus,
    TeamSide,
)

NORMALIZED_SNAPSHOT = (
    "lower(regexp_replace(trim(display_name_snapshot), '[[:space:]]+', ' ', 'g'))"
)


class Game(Base):
    __tablename__ = "games"
    __table_args__ = (
        CheckConstraint("duration_minutes > 0", name="duration_positive"),
        CheckConstraint("court_cost_cents >= 0", name="cost_not_negative"),
        CheckConstraint("max_players >= 2", name="max_players_min_two"),
        CheckConstraint(
            "min_players IS NULL OR min_players >= 2", name="min_players_min_two"
        ),
        CheckConstraint(
            "auto_cancellation_hours IS NULL OR auto_cancellation_hours > 0",
            name="auto_cancellation_positive",
        ),
        CheckConstraint("min_players IS NULL OR min_players <= max_players", name="min_le_max"),
        CheckConstraint(
            "(status = 'cancelled') = (cancelled_at IS NOT NULL)", name="cancelled_at_matches"
        ),
        CheckConstraint(
            "cancel_reason IS NULL OR status = 'cancelled'", name="cancel_reason_requires_cancel"
        ),
        CheckConstraint(
            "(teams_drawn_at IS NULL) OR (team_a_score IS NOT NULL AND team_b_score IS NOT NULL)",
            name="scores_require_draw",
        ),
        Index("games_group_start_idx", "group_id", "game_date", "start_time"),
        Index(
            "games_group_active_idx",
            "group_id",
            "starts_at",
            postgresql_where=text("status = 'active'"),
        ),
        Index("games_starts_at_idx", "starts_at", postgresql_where=text("status = 'active'")),
        Index("games_join_code_prefix_idx", "join_code_prefix"),
        Index(
            "games_legacy_ref_idx",
            "group_id",
            "legacy_ref",
            unique=True,
            postgresql_where=text("legacy_ref IS NOT NULL"),
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    group_id: Mapped[UUID] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )
    public_slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    join_code_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    join_code_prefix: Mapped[str] = mapped_column(Text, nullable=False)

    # Wall-clock fields are what the organizer typed; starts_at/ends_at are the
    # instants derived from them plus the group timezone. Rule 6.2: any write
    # touching date, time or duration recomputes both in the same statement.
    game_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time | None] = mapped_column(Time)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    location: Mapped[str] = mapped_column(Text, server_default=text("''"), nullable=False)
    court_number: Mapped[str] = mapped_column(Text, server_default=text("''"), nullable=False)
    court_cost_cents: Mapped[int] = mapped_column(
        Integer, server_default=text("0"), nullable=False
    )
    currency: Mapped[CurrencyCode] = mapped_column(
        pg_enum(CurrencyCode, "currency_code"), server_default=text("'EUR'"), nullable=False
    )
    max_players: Mapped[int] = mapped_column(Integer, nullable=False)
    min_players: Mapped[int | None] = mapped_column(Integer)
    auto_cancellation_hours: Mapped[int | None] = mapped_column(Integer)

    status: Mapped[GameStatus] = mapped_column(
        pg_enum(GameStatus, "game_status"), server_default=text("'active'"), nullable=False
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_reason: Mapped[CancelReason | None] = mapped_column(
        pg_enum(CancelReason, "cancel_reason")
    )

    payment_info: Mapped[str] = mapped_column(Text, server_default=text("''"), nullable=False)
    player_notice: Mapped[str] = mapped_column(Text, server_default=text("''"), nullable=False)

    # Rule 15: teams are stored, never recomputed.
    teams_drawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    team_a_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    team_b_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))

    legacy_ref: Mapped[str | None] = mapped_column(Text)
    created_by_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()


class GameParticipant(Base):
    __tablename__ = "game_participants"
    __table_args__ = (
        CheckConstraint(
            "char_length(trim(display_name_snapshot)) BETWEEN 1 AND 80",
            name="display_name_length",
        ),
        CheckConstraint("list_position >= 0", name="list_position_not_negative"),
        CheckConstraint("level_at_draw BETWEEN 1 AND 5", name="level_at_draw_range"),
        UniqueConstraint("game_id", "player_id", name="game_participants_one_per_player"),
        # Deferrable so a renumber can shuffle positions inside one transaction
        # without tripping the constraint on every intermediate UPDATE.
        UniqueConstraint(
            "game_id",
            "status",
            "list_position",
            name="game_participants_list_order",
            deferrable=True,
            initially="DEFERRED",
        ),
        CheckConstraint(
            "(status IN ('confirmed', 'waiting_list')) = (list_position IS NOT NULL)",
            name="position_matches_status",
        ),
        CheckConstraint(
            "(status IN ('left', 'removed')) = (left_at IS NOT NULL)", name="left_at_matches_status"
        ),
        CheckConstraint("team IS NULL OR status = 'confirmed'", name="team_requires_confirmed"),
        Index("game_participants_game_status_idx", "game_id", "status", "list_position"),
        # Rule 11: names unique per active game list, case/whitespace insensitive.
        Index(
            "game_participants_active_name_idx",
            "game_id",
            "display_name_normalized",
            unique=True,
            postgresql_where=text("status IN ('confirmed', 'waiting_list')"),
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    game_id: Mapped[UUID] = mapped_column(
        ForeignKey("games.id", ondelete="CASCADE"), nullable=False
    )
    # RESTRICT enforces rule 18: a profile with game history cannot be deleted.
    player_id: Mapped[UUID] = mapped_column(
        ForeignKey("player_profiles.id", ondelete="RESTRICT"), nullable=False
    )
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    display_name_snapshot: Mapped[str] = mapped_column(Text, nullable=False)
    display_name_normalized: Mapped[str] = mapped_column(
        Text, Computed(text(NORMALIZED_SNAPSHOT), persisted=True)
    )
    status: Mapped[ParticipantStatus] = mapped_column(
        pg_enum(ParticipantStatus, "participant_status"), nullable=False
    )
    list_position: Mapped[int | None] = mapped_column(Integer)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    team: Mapped[TeamSide | None] = mapped_column(pg_enum(TeamSide, "team_side"))
    level_at_draw: Mapped[int | None] = mapped_column(SmallInteger)
    joined_at: Mapped[datetime] = created_at_column()
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = updated_at_column()
