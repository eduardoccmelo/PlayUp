from uuid import UUID

from app.domain.enums import GroupRole
from app.schemas.common import CamelModel


class CreateGroupRequest(CamelModel):
    name: str
    organizer_passcode: str
    timezone: str = "Europe/Lisbon"


class GroupResponse(CamelModel):
    id: UUID
    name: str
    public_slug: str
    timezone: str
    role: GroupRole | None = None


class CreateGroupResponse(CamelModel):
    group: GroupResponse
    #: Shown once, at creation. Only the hash is stored.
    join_code: str


class JoinGroupRequest(CamelModel):
    join_code: str
    display_name: str
    role: GroupRole = GroupRole.PARTICIPANT
    organizer_passcode: str | None = None


class ChangePasscodeRequest(CamelModel):
    current_passcode: str
    new_passcode: str
