import logging

from fastapi import APIRouter

from app.api.deps import SessionDep, ViewerDep
from app.core.config import get_settings
from app.domain import auth as auth_domain
from app.schemas.auth import (
    AccessCodeResponse,
    SessionResponse,
    StartSignInRequest,
    StartSignInResponse,
    UpdateMeRequest,
    UserResponse,
    VerifyRequest,
)

router = APIRouter(tags=["auth"])
logger = logging.getLogger(__name__)


@router.post("/auth/start", response_model=StartSignInResponse)
async def start_sign_in(body: StartSignInRequest, session: SessionDep) -> StartSignInResponse:
    issued = await auth_domain.start_sign_in(
        session, email=str(body.email), display_name=body.display_name
    )
    settings = get_settings()
    # TODO: hand this to the Mailer once it lands; for now development reads
    # the code from the response and other environments from the log.
    logger.info("Access code issued for %s", issued.user.email)
    return StartSignInResponse(
        sent=True,
        access_code=issued.access_code if settings.exposes_access_codes else None,
    )


@router.post("/auth/verify", response_model=SessionResponse)
async def verify(body: VerifyRequest, session: SessionDep) -> SessionResponse:
    issued = await auth_domain.verify_access_code(
        session,
        email=str(body.email),
        access_code=body.access_code,
        device_label=body.device_label,
    )
    return SessionResponse(
        token=issued.token, user=UserResponse.model_validate(issued.user)
    )


@router.get("/me", response_model=UserResponse)
async def read_me(viewer: ViewerDep) -> UserResponse:
    return UserResponse.model_validate(viewer.user)


@router.patch("/me", response_model=UserResponse)
async def update_me(body: UpdateMeRequest, viewer: ViewerDep) -> UserResponse:
    viewer.user.display_name = body.display_name
    return UserResponse.model_validate(viewer.user)


@router.post("/me/access-code/regenerate", response_model=AccessCodeResponse)
async def regenerate_access_code(session: SessionDep, viewer: ViewerDep) -> AccessCodeResponse:
    code = await auth_domain.regenerate_access_code(session, user_id=viewer.user.id)
    return AccessCodeResponse(access_code=code)


@router.delete("/sessions/current", status_code=204)
async def sign_out(session: SessionDep, viewer: ViewerDep) -> None:
    await auth_domain.revoke_session(session, user_session=viewer.session)
