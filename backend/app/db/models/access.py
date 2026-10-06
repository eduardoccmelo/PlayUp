from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Computed,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at_column, pg_enum, updated_at_column
from app.domain.enums import (
    AccessSource,
    AccessStatus,
    InviteType,
    NotificationType,
    RequestKind,
)

NORMALIZED_REQUEST = (
    "lower(regexp_replace(trim(requested_name), '[[:space:]]+', ' ', 'g'))"
)


class GameAccessRequest(Base):
    __tablename__ = "game_access_requests"
    __table_args__ = (
        CheckConstraint(
            "char_length(trim(requested_name)) BETWEEN 1 AND 80", name="requested_name_length"
        ),
        CheckConstraint(
            "(status = 'pending') = (reviewed_at IS NULL)", name="reviewed_at_matches"
        ),
        CheckConstraint("kind = 'join' OR game_id IS NOT NULL", name="non_join_needs_game"),
        Index(
            "game_access_requests_open_user_idx",
            "game_id",
            "user_id",
            "kind",
            unique=True,
            postgresql_where=text(
                "status = 'pending' AND game_id IS NOT NULL AND user_id IS NOT NULL"
            ),
        ),
        Index(
            "game_access_requests_open_name_idx",
            "group_id",
            "requested_name_normalized",
            "kind",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
        Index(
            "game_access_requests_user_idx",
            "user_id",
            "status",
            text("created_at DESC"),
        ),
        Index(
            "game_access_requests_pending_group_idx",
            "group_id",
            "created_at",
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    group_id: Mapped[UUID] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )
    game_id: Mapped[UUID | None] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"))
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[RequestKind] = mapped_column(
        pg_enum(RequestKind, "request_kind"), server_default=text("'join'"), nullable=False
    )
    source: Mapped[AccessSource] = mapped_column(
        pg_enum(AccessSource, "access_source"), nullable=False
    )
    status: Mapped[AccessStatus] = mapped_column(
        pg_enum(AccessStatus, "access_status"), server_default=text("'pending'"), nullable=False
    )
    requested_name: Mapped[str] = mapped_column(Text, nullable=False)
    requested_name_normalized: Mapped[str] = mapped_column(
        Text, Computed(text(NORMALIZED_REQUEST), persisted=True)
    )
    payment_confirmed: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false"), nullable=False
    )
    resolved_player_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("player_profiles.id", ondelete="SET NULL")
    )
    reviewed_by_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()


class Invite(Base):
    __tablename__ = "invites"
    __table_args__ = (
        CheckConstraint("max_uses IS NULL OR max_uses > 0", name="max_uses_positive"),
        CheckConstraint("use_count >= 0", name="use_count_not_negative"),
        CheckConstraint(
            "max_uses IS NULL OR use_count <= max_uses", name="use_count_within_max"
        ),
        CheckConstraint(
            "(type IN ('group_admin', 'group_participant') AND group_id IS NOT NULL"
            " AND game_id IS NULL)"
            " OR (type = 'game_guest' AND game_id IS NOT NULL AND group_id IS NULL)",
            name="target_matches_type",
        ),
        Index("invites_token_prefix_idx", "token_prefix"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    token_prefix: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[InviteType] = mapped_column(pg_enum(InviteType, "invite_type"), nullable=False)
    group_id: Mapped[UUID | None] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"))
    game_id: Mapped[UUID | None] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"))
    created_by_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    max_uses: Mapped[int | None] = mapped_column(Integer)
    use_count: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at_column()


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("notifications_group_created_idx", "group_id", text("created_at DESC")),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    group_id: Mapped[UUID] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )
    game_id: Mapped[UUID | None] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"))
    request_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("game_access_requests.id", ondelete="CASCADE")
    )
    type: Mapped[NotificationType] = mapped_column(
        pg_enum(NotificationType, "notification_type"), nullable=False
    )
    actor_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    player_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("player_profiles.id", ondelete="SET NULL")
    )
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb"), nullable=False
    )
    created_at: Mapped[datetime] = created_at_column()


class NotificationRecipient(Base):
    __tablename__ = "notification_recipients"
    __table_args__ = (
        Index(
            "notification_recipients_open_idx",
            "user_id",
            postgresql_where=text("dismissed_at IS NULL"),
        ),
    )

    notification_id: Mapped[UUID] = mapped_column(
        ForeignKey("notifications.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    dismissed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
