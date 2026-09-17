"""SQLAlchemy models. Importing this package registers every table on Base.metadata."""

from app.db.models.access import (
    GameAccessRequest,
    Invite,
    Notification,
    NotificationRecipient,
)
from app.db.models.games import Game, GameParticipant
from app.db.models.groups import Group, GroupMembership, PlayerProfile
from app.db.models.users import User, UserSession

__all__ = [
    "Game",
    "GameAccessRequest",
    "GameParticipant",
    "Group",
    "GroupMembership",
    "Invite",
    "Notification",
    "NotificationRecipient",
    "PlayerProfile",
    "User",
    "UserSession",
]
