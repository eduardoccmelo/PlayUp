"""Group creation, joining and membership."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    generate_code,
    generate_slug,
    hash_secret,
    hash_token,
    verify_secret,
)
from app.core.time import utcnow
from app.db.models import Group, GroupMembership, PlayerProfile, User
from app.domain.enums import GroupRole
from app.domain.errors import Conflict, NotFound, PermissionDenied

JOIN_CODE_LENGTH = 8
JOIN_CODE_PREFIX_LENGTH = 4


@dataclass
class CreatedGroup:
    group: Group
    join_code: str


def _code_prefix(code: str) -> str:
    return code[:JOIN_CODE_PREFIX_LENGTH]


async def create_group(
    session: AsyncSession,
    *,
    name: str,
    creator_id: UUID,
    organizer_passcode: str,
    timezone: str = "Europe/Lisbon",
) -> CreatedGroup:
    """Rule 1: creating a group creates an active admin membership for its
    creator, in the same transaction."""
    join_code = generate_code(JOIN_CODE_LENGTH)
    group = Group(
        name=name,
        public_slug=generate_slug(name),
        join_code_hash=hash_token(join_code),
        join_code_prefix=_code_prefix(join_code),
        organizer_passcode_hash=hash_secret(organizer_passcode),
        timezone=timezone,
        created_by_user_id=creator_id,
    )
    session.add(group)
    await session.flush()

    session.add(
        GroupMembership(group_id=group.id, user_id=creator_id, role=GroupRole.ADMIN)
    )

    # Rule 4: joining a game goes through a linked profile, and an organizer
    # plays in their own games, so give the creator one here too.
    creator = await session.get(User, creator_id)
    if creator is None:
        raise NotFound("Creator not found")
    session.add(
        PlayerProfile(
            group_id=group.id, owner_user_id=creator_id, display_name=creator.display_name
        )
    )
    await session.flush()
    return CreatedGroup(group=group, join_code=join_code)


async def get_group(session: AsyncSession, group_id: UUID) -> Group:
    group = await session.get(Group, group_id)
    if group is None:
        raise NotFound("Group not found")
    return group


async def find_membership(
    session: AsyncSession, *, group_id: UUID, user_id: UUID
) -> GroupMembership | None:
    return (
        await session.execute(
            select(GroupMembership).where(
                GroupMembership.group_id == group_id,
                GroupMembership.user_id == user_id,
                GroupMembership.left_at.is_(None),
            )
        )
    ).scalar_one_or_none()


async def list_memberships(session: AsyncSession, *, user_id: UUID) -> list[GroupMembership]:
    return list(
        (
            await session.execute(
                select(GroupMembership).where(
                    GroupMembership.user_id == user_id,
                    GroupMembership.left_at.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )


async def join_group(
    session: AsyncSession,
    *,
    join_code: str,
    user_id: UUID,
    display_name: str,
    role: GroupRole = GroupRole.PARTICIPANT,
    organizer_passcode: str | None = None,
) -> GroupMembership:
    """Join by code. Admin mode additionally requires the group passcode."""
    group = (
        await session.execute(
            select(Group).where(Group.join_code_hash == hash_token(join_code))
        )
    ).scalar_one_or_none()
    if group is None:
        raise NotFound("No group matches that code")
    if group.archived_at is not None:
        raise Conflict("That group is archived")

    if role is GroupRole.ADMIN and (
        organizer_passcode is None
        or not verify_secret(group.organizer_passcode_hash, organizer_passcode)
    ):
        raise PermissionDenied("The organizer passcode is incorrect")

    existing = await find_membership(session, group_id=group.id, user_id=user_id)
    if existing is not None:
        return existing

    membership = GroupMembership(group_id=group.id, user_id=user_id, role=role)
    session.add(membership)

    # Rule 4: a member joins games through a linked profile, so make sure
    # one exists in this group.
    linked = (
        await session.execute(
            select(PlayerProfile).where(
                PlayerProfile.group_id == group.id,
                PlayerProfile.owner_user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if linked is None:
        session.add(
            PlayerProfile(
                group_id=group.id, owner_user_id=user_id, display_name=display_name
            )
        )
    await session.flush()
    return membership


async def change_passcode(
    session: AsyncSession, *, group_id: UUID, current_passcode: str, new_passcode: str
) -> None:
    """Rule 12: requires the current passcode, and leaves memberships intact."""
    group = await get_group(session, group_id)
    if not verify_secret(group.organizer_passcode_hash, current_passcode):
        raise PermissionDenied("The current passcode is incorrect")
    group.organizer_passcode_hash = hash_secret(new_passcode)
    await session.flush()


async def leave_group(session: AsyncSession, *, group_id: UUID, user_id: UUID) -> None:
    membership = await find_membership(session, group_id=group_id, user_id=user_id)
    if membership is None:
        raise NotFound("You are not a member of that group")
    membership.left_at = utcnow()
    await session.flush()
