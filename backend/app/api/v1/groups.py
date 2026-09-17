from fastapi import APIRouter

from app.api.deps import GroupAdminDep, GroupMemberDep, SessionDep, ViewerDep
from app.domain import groups as groups_domain
from app.schemas.groups import (
    ChangePasscodeRequest,
    CreateGroupRequest,
    CreateGroupResponse,
    GroupResponse,
    JoinGroupRequest,
)

router = APIRouter(tags=["groups"])


@router.get("/groups", response_model=list[GroupResponse])
async def list_groups(session: SessionDep, viewer: ViewerDep) -> list[GroupResponse]:
    memberships = await groups_domain.list_memberships(session, user_id=viewer.user.id)
    responses: list[GroupResponse] = []
    for membership in memberships:
        group = await groups_domain.get_group(session, membership.group_id)
        responses.append(
            GroupResponse(
                id=group.id,
                name=group.name,
                public_slug=group.public_slug,
                timezone=group.timezone,
                role=membership.role,
            )
        )
    return responses


@router.post("/groups", response_model=CreateGroupResponse, status_code=201)
async def create_group(
    body: CreateGroupRequest, session: SessionDep, viewer: ViewerDep
) -> CreateGroupResponse:
    created = await groups_domain.create_group(
        session,
        name=body.name,
        creator_id=viewer.user.id,
        organizer_passcode=body.organizer_passcode,
        timezone=body.timezone,
    )
    return CreateGroupResponse(
        group=GroupResponse.model_validate(created.group), join_code=created.join_code
    )


@router.post("/groups/join", response_model=GroupResponse)
async def join_group(
    body: JoinGroupRequest, session: SessionDep, viewer: ViewerDep
) -> GroupResponse:
    membership = await groups_domain.join_group(
        session,
        join_code=body.join_code,
        user_id=viewer.user.id,
        display_name=body.display_name,
        role=body.role,
        organizer_passcode=body.organizer_passcode,
    )
    group = await groups_domain.get_group(session, membership.group_id)
    return GroupResponse(
        id=group.id,
        name=group.name,
        public_slug=group.public_slug,
        timezone=group.timezone,
        role=membership.role,
    )


@router.get("/groups/{group_id}", response_model=GroupResponse)
async def read_group(context: GroupMemberDep) -> GroupResponse:
    return GroupResponse(
        id=context.group.id,
        name=context.group.name,
        public_slug=context.group.public_slug,
        timezone=context.group.timezone,
        role=context.membership.role,
    )


@router.post("/groups/{group_id}/passcode", status_code=204)
async def change_passcode(
    body: ChangePasscodeRequest, context: GroupAdminDep, session: SessionDep
) -> None:
    await groups_domain.change_passcode(
        session,
        group_id=context.group.id,
        current_passcode=body.current_passcode,
        new_passcode=body.new_passcode,
    )


@router.post("/groups/{group_id}/leave", status_code=204)
async def leave_group(context: GroupMemberDep, session: SessionDep) -> None:
    await groups_domain.leave_group(
        session, group_id=context.group.id, user_id=context.viewer.user.id
    )
