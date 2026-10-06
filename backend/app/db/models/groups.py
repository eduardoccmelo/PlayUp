from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Computed,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    Text,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at_column, pg_enum, updated_at_column
from app.domain.enums import GroupRole, PlayerCondition, PlayerMobility, PlayerPosition

NORMALIZED = "lower(regexp_replace(trim(display_name), '[[:space:]]+', ' ', 'g'))"


class Group(Base):
    __tablename__ = "groups"
    __table_args__ = (
        CheckConstraint("char_length(trim(name)) BETWEEN 1 AND 80", name="name_length"),
        Index("groups_join_code_prefix_idx", "join_code_prefix"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    public_slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    join_code_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    join_code_prefix: Mapped[str] = mapped_column(Text, nullable=False)
    organizer_passcode_hash: Mapped[str] = mapped_column(Text, nullable=False)
    timezone: Mapped[str] = mapped_column(
        Text, server_default=text("'Europe/Lisbon'"), nullable=False
    )
    created_by_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime] = updated_at_column()
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GroupMembership(Base):
    __tablename__ = "group_memberships"
    __table_args__ = (
        Index(
            "group_memberships_one_active_idx",
            "group_id",
            "user_id",
            unique=True,
            postgresql_where=text("left_at IS NULL"),
        ),
        Index(
            "group_memberships_user_active_idx",
            "user_id",
            "group_id",
            postgresql_where=text("left_at IS NULL"),
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    group_id: Mapped[UUID] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[GroupRole] = mapped_column(pg_enum(GroupRole, "group_role"), nullable=False)
    joined_at: Mapped[datetime] = created_at_column()
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PlayerProfile(Base):
    __tablename__ = "player_profiles"
    __table_args__ = (
        CheckConstraint(
            "char_length(trim(display_name)) BETWEEN 1 AND 80", name="display_name_length"
        ),
        CheckConstraint("level BETWEEN 1 AND 5", name="level_range"),
        # A profile belongs to a group, to a user, or to both - never to neither.
        CheckConstraint(
            "group_id IS NOT NULL OR owner_user_id IS NOT NULL", name="has_an_owner"
        ),
        Index(
            "player_profiles_group_name_idx",
            "group_id",
            "display_name_normalized",
            unique=True,
            postgresql_where=text("group_id IS NOT NULL AND archived_at IS NULL"),
        ),
        Index(
            "player_profiles_one_owned_per_group_idx",
            "group_id",
            "owner_user_id",
            unique=True,
            postgresql_where=text("group_id IS NOT NULL AND owner_user_id IS NOT NULL"),
        ),
        Index(
            "player_profiles_legacy_ref_idx",
            "group_id",
            "legacy_ref",
            unique=True,
            postgresql_where=text("legacy_ref IS NOT NULL"),
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    group_id: Mapped[UUID | None] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"))
    owner_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    display_name_normalized: Mapped[str] = mapped_column(
        Text, Computed(text(NORMALIZED), persisted=True)
    )
    level: Mapped[int | None] = mapped_column(SmallInteger)
    mobility: Mapped[PlayerMobility] = mapped_column(
        pg_enum(PlayerMobility, "player_mobility"),
        server_default=text("'neutro'"),
        nullable=False,
    )
    condition: Mapped[PlayerCondition] = mapped_column(
        pg_enum(PlayerCondition, "player_condition"),
        server_default=text("'neutro'"),
        nullable=False,
    )
    field_position: Mapped[PlayerPosition] = mapped_column(
        pg_enum(PlayerPosition, "player_position"),
        server_default=text("'neutro'"),
        nullable=False,
    )
    legacy_ref: Mapped[str | None] = mapped_column(Text)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = created_at_column()
