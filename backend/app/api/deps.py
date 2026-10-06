"""Request dependencies.

Authorization is decided here, from `group_memberships` and
`game_access_requests` - never from a path id.
"""

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Game, Group, GroupMembership, User, UserSession
from app.db.session import session_factory
from app.domain import auth as auth_domain
from app.domain import games as games_domain
from app.domain import groups as groups_domain
from app.domain.enums import GroupRole
from app.domain.errors import NotAuthenticated, PermissionDenied


async def get_session() -> AsyncIterator[AsyncSession]:
    """One transaction per request: commit on success, roll back on error."""
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


SessionDep = Annotated[AsyncSession, Depends(get_session)]


@dataclass
class Viewer:
    user: User
    session: UserSession


def _bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise NotAuthenticated("Missing bearer token")
    return authorization.split(" ", 1)[1].strip()


async def current_viewer(
    session: SessionDep, authorization: Annotated[str | None, Header()] = None
) -> Viewer:
    user, user_session = await auth_domain.resolve_session(
        session, token=_bearer_token(authorization)
    )
    return Viewer(user=user, session=user_session)


async def optional_viewer(
    session: SessionDep, authorization: Annotated[str | None, Header()] = None
) -> Viewer | None:
    """For endpoints a signed-out visitor may reach, such as a game lookup."""
    if not authorization:
        return None
    try:
        return await current_viewer(session, authorization)
    except NotAuthenticated:
        return None


ViewerDep = Annotated[Viewer, Depends(current_viewer)]
OptionalViewerDep = Annotated[Viewer | None, Depends(optional_viewer)]


@dataclass
class GroupContext:
    group: Group
    membership: GroupMembership
    viewer: Viewer

    @property
    def is_admin(self) -> bool:
        return self.membership.role is GroupRole.ADMIN


async def require_group_member(
    group_id: UUID, session: SessionDep, viewer: ViewerDep
) -> GroupContext:
    group = await groups_domain.get_group(session, group_id)
    membership = await groups_domain.find_membership(
        session, group_id=group_id, user_id=viewer.user.id
    )
    if membership is None:
        raise PermissionDenied("You are not a member of that group")
    return GroupContext(group=group, membership=membership, viewer=viewer)


async def require_group_admin(
    context: Annotated[GroupContext, Depends(require_group_member)],
) -> GroupContext:
    """Rule 2: only active group admins may edit groups, games and players."""
    if not context.is_admin:
        raise PermissionDenied("Only group admins may do that")
    return context


GroupMemberDep = Annotated[GroupContext, Depends(require_group_member)]
GroupAdminDep = Annotated[GroupContext, Depends(require_group_admin)]


@dataclass
class GameContext:
    game: Game
    access: games_domain.ViewerAccess
    viewer: Viewer | None

    @property
    def user_id(self) -> UUID | None:
        return self.viewer.user.id if self.viewer else None


async def game_context(
    game_id: UUID, session: SessionDep, viewer: OptionalViewerDep
) -> GameContext:
    game = await games_domain.get_game(session, game_id)
    access = await games_domain.viewer_access(
        session, game=game, user_id=viewer.user.id if viewer else None
    )
    return GameContext(game=game, access=access, viewer=viewer)


async def require_game_viewer(
    context: Annotated[GameContext, Depends(game_context)],
) -> GameContext:
    if not context.access.can_view_details:
        raise PermissionDenied("You do not have access to that game")
    return context


async def require_game_manager(
    context: Annotated[GameContext, Depends(game_context)],
) -> GameContext:
    if not context.access.can_manage_game:
        raise PermissionDenied("Only group admins may manage that game")
    return context


GameViewerDep = Annotated[GameContext, Depends(require_game_viewer)]
GameManagerDep = Annotated[GameContext, Depends(require_game_manager)]
