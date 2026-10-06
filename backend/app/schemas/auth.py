from uuid import UUID

from pydantic import EmailStr

from app.schemas.common import CamelModel


class StartSignInRequest(CamelModel):
    email: EmailStr
    display_name: str | None = None


class StartSignInResponse(CamelModel):
    sent: bool
    #: Only populated outside production, so local development does not need
    #: a working mailbox.
    access_code: str | None = None


class VerifyRequest(CamelModel):
    email: EmailStr
    access_code: str
    device_label: str | None = None


class SessionResponse(CamelModel):
    token: str
    user: "UserResponse"


class UserResponse(CamelModel):
    id: UUID
    display_name: str
    email: EmailStr
    is_staff: bool


class UpdateMeRequest(CamelModel):
    display_name: str


class AccessCodeResponse(CamelModel):
    access_code: str


SessionResponse.model_rebuild()
