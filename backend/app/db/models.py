from datetime import date, datetime, time
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text, Time, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.domain.enums import (
    AccessStatus, GameStatus, GroupRole, ParticipantStatus, PlayerCondition,
    PlayerMobility, PlayerPosition, RequestKind,
)


def enum_type(enum_class: type[Any], name: str) -> Enum[Any]:
    return Enum(enum_class, name=name, native_enum=True,
                values_callable=lambda members: [member.value for member in members])


class User(Base):
    __tablename__ = "users"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    display_name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(320), unique=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    access_code_hash: Mapped[str] = mapped_column(Text)
    is_staff: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class Group(Base):
    __tablename__ = "groups"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    public_slug: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    join_code_hash: Mapped[str] = mapped_column(Text, unique=True)
    join_code_prefix: Mapped[str] = mapped_column(String(16))
    timezone: Mapped[str] = mapped_column(String(64), default="Europe/Lisbon")
    created_by_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GroupMembership(Base):
    __tablename__ = "group_memberships"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    group_id: Mapped[UUID] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"))
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[GroupRole] = mapped_column(enum_type(GroupRole, "group_role"))
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PlayerProfile(Base):
    __tablename__ = "player_profiles"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    group_id: Mapped[UUID | None] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"))
    owner_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    display_name: Mapped[str] = mapped_column(String(80))
    level: Mapped[int | None] = mapped_column(Integer)
    mobility: Mapped[PlayerMobility] = mapped_column(enum_type(PlayerMobility, "player_mobility"), default=PlayerMobility.NEUTRO)
    condition: Mapped[PlayerCondition] = mapped_column(enum_type(PlayerCondition, "player_condition"), default=PlayerCondition.NEUTRO)
    field_position: Mapped[PlayerPosition] = mapped_column(enum_type(PlayerPosition, "player_position"), default=PlayerPosition.NEUTRO)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Game(Base):
    __tablename__ = "games"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    group_id: Mapped[UUID] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"))
    public_slug: Mapped[str] = mapped_column(String(80), unique=True)
    game_date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    duration_minutes: Mapped[int] = mapped_column(Integer)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    location: Mapped[str] = mapped_column(Text, default="")
    max_players: Mapped[int] = mapped_column(Integer)
    min_players: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[GameStatus] = mapped_column(enum_type(GameStatus, "game_status"), default=GameStatus.ACTIVE)
    created_by_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))


class GameParticipant(Base):
    __tablename__ = "game_participants"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    game_id: Mapped[UUID] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"))
    player_id: Mapped[UUID] = mapped_column(ForeignKey("player_profiles.id", ondelete="RESTRICT"))
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    display_name_snapshot: Mapped[str] = mapped_column(String(80))
    status: Mapped[ParticipantStatus] = mapped_column(enum_type(ParticipantStatus, "participant_status"))
    list_position: Mapped[int | None] = mapped_column(Integer)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    team: Mapped[str | None] = mapped_column(String(1))
    level_at_draw: Mapped[int | None] = mapped_column(Integer)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GameAccessRequest(Base):
    __tablename__ = "game_access_requests"
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    group_id: Mapped[UUID] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"))
    game_id: Mapped[UUID | None] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"))
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[RequestKind] = mapped_column(enum_type(RequestKind, "request_kind"), default=RequestKind.JOIN)
    status: Mapped[AccessStatus] = mapped_column(enum_type(AccessStatus, "access_status"), default=AccessStatus.PENDING)
    requested_name: Mapped[str] = mapped_column(String(80))
    payment_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_player_id: Mapped[UUID | None] = mapped_column(ForeignKey("player_profiles.id", ondelete="SET NULL"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))