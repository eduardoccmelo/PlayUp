from enum import StrEnum


class GroupRole(StrEnum):
    ADMIN = "admin"
    PARTICIPANT = "participant"


class GameStatus(StrEnum):
    ACTIVE = "active"
    CANCELLED = "cancelled"
    FINISHED = "finished"
    DELETED = "deleted"


class ParticipantStatus(StrEnum):
    CONFIRMED = "confirmed"
    WAITING_LIST = "waiting_list"
    LEFT = "left"
    REMOVED = "removed"


class RequestKind(StrEnum):
    JOIN = "join"
    LEAVE = "leave"
    PAYMENT = "payment"


class AccessStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVOKED = "revoked"


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