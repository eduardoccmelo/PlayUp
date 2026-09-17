"""StrEnums mirroring the PostgreSQL enum types created in migration 0001.

The labels here are the contract: they must match the PostgreSQL labels
character for character, because `values_callable` sends `member.value`
to the database.
"""

from enum import StrEnum


class GroupRole(StrEnum):
    ADMIN = "admin"
    PARTICIPANT = "participant"


class GameStatus(StrEnum):
    ACTIVE = "active"
    CANCELLED = "cancelled"
    FINISHED = "finished"
    DELETED = "deleted"


class CancelReason(StrEnum):
    MANUAL = "manual"
    MIN_PLAYERS = "min_players"


class PlayerMobility(StrEnum):
    RAPIDO = "rapido"
    NEUTRO = "neutro"
    LENTO = "lento"


class PlayerCondition(StrEnum):
    BOA = "boa"
    NEUTRO = "neutro"
    RUIM = "ruim"


class PlayerPosition(StrEnum):
    GOLEIRO = "goleiro"
    DEFESA = "defesa"
    ATAQUE = "ataque"
    NEUTRO = "neutro"


class CurrencyCode(StrEnum):
    EUR = "EUR"
    USD = "USD"
    GBP = "GBP"
    BRL = "BRL"


class ParticipantStatus(StrEnum):
    CONFIRMED = "confirmed"
    WAITING_LIST = "waiting_list"
    LEFT = "left"
    REMOVED = "removed"


class TeamSide(StrEnum):
    A = "A"
    B = "B"


class RequestKind(StrEnum):
    JOIN = "join"
    LEAVE = "leave"
    PAYMENT = "payment"


class AccessSource(StrEnum):
    INVITE = "invite"
    MANUAL_CODE = "manual_code"
    ADMIN_ADDED = "admin_added"


class AccessStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVOKED = "revoked"


class InviteType(StrEnum):
    GROUP_ADMIN = "group_admin"
    GROUP_PARTICIPANT = "group_participant"
    GAME_GUEST = "game_guest"


class NotificationType(StrEnum):
    GAME_ACCESS_REQUESTED = "game_access_requested"
    PLAYER_JOINED = "player_joined"
    PLAYER_LEFT = "player_left"
    PAYMENT_STATUS_CHANGED = "payment_status_changed"
    WAITING_LIST_PROMOTED = "waiting_list_promoted"
    GAME_CANCELLED = "game_cancelled"


#: Every enum that has a PostgreSQL type, keyed by the type name.
PG_ENUMS: dict[str, type[StrEnum]] = {
    "group_role": GroupRole,
    "game_status": GameStatus,
    "cancel_reason": CancelReason,
    "player_mobility": PlayerMobility,
    "player_condition": PlayerCondition,
    "player_position": PlayerPosition,
    "currency_code": CurrencyCode,
    "participant_status": ParticipantStatus,
    "team_side": TeamSide,
    "request_kind": RequestKind,
    "access_source": AccessSource,
    "access_status": AccessStatus,
    "invite_type": InviteType,
    "notification_type": NotificationType,
}
