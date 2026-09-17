"""Notification fan-out.

Rule 9: join, leave and payment changes notify every active admin of the
group. The notification row carries the event; `notification_recipients`
carries one row per admin so each can dismiss independently.
"""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import GroupMembership, Notification, NotificationRecipient
from app.domain.enums import GroupRole, NotificationType


async def active_group_admin_ids(session: AsyncSession, group_id: UUID) -> list[UUID]:
    result = await session.execute(
        select(GroupMembership.user_id).where(
            GroupMembership.group_id == group_id,
            GroupMembership.role == GroupRole.ADMIN,
            GroupMembership.left_at.is_(None),
        )
    )
    return list(result.scalars().all())


async def notify_group_admins(
    session: AsyncSession,
    *,
    group_id: UUID,
    type: NotificationType,
    game_id: UUID | None = None,
    request_id: UUID | None = None,
    actor_user_id: UUID | None = None,
    player_id: UUID | None = None,
    payload: dict[str, Any] | None = None,
) -> Notification:
    """Insert one notification addressed to every active admin.

    Runs inside the caller's transaction so a notification can never outlive
    a rolled-back change.
    """
    notification = Notification(
        group_id=group_id,
        game_id=game_id,
        request_id=request_id,
        type=type,
        actor_user_id=actor_user_id,
        player_id=player_id,
        payload=payload or {},
    )
    session.add(notification)
    await session.flush()

    for admin_id in await active_group_admin_ids(session, group_id):
        session.add(
            NotificationRecipient(notification_id=notification.id, user_id=admin_id)
        )
    await session.flush()
    return notification
