"""Access codes and sessions.

A user proves identity with an emailed access code, then holds an opaque
session token. The code is Argon2-hashed; the token is SHA-256 hashed
because it is already 256 bits of entropy.
"""

from dataclasses import dataclass
from datetime import timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import (
    generate_code,
    generate_token,
    hash_secret,
    hash_token,
    verify_secret,
)
from app.core.time import utcnow
from app.db.models import User, UserSession
from app.domain.errors import NotAuthenticated

ACCESS_CODE_LENGTH = 8


@dataclass
class IssuedCode:
    user: User
    access_code: str
    created: bool


@dataclass
class IssuedSession:
    session: UserSession
    token: str
    user: User


async def start_sign_in(
    session: AsyncSession, *, email: str, display_name: str | None = None
) -> IssuedCode:
    """Find or create the user and issue a fresh access code.

    The plaintext code is returned to the caller so the API layer can hand it
    to the mailer. It is never stored.
    """
    user = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()

    access_code = generate_code(ACCESS_CODE_LENGTH)
    created = user is None
    if user is None:
        user = User(
            email=email,
            display_name=(display_name or email.split("@")[0])[:80],
            access_code_hash=hash_secret(access_code),
        )
        session.add(user)
    else:
        user.access_code_hash = hash_secret(access_code)
        user.access_code_updated_at = utcnow()
    await session.flush()
    return IssuedCode(user=user, access_code=access_code, created=created)


async def verify_access_code(
    session: AsyncSession, *, email: str, access_code: str, device_label: str | None = None
) -> IssuedSession:
    user = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if user is None or not verify_secret(user.access_code_hash, access_code):
        # Same message either way, so the endpoint does not confirm which
        # addresses are registered.
        raise NotAuthenticated("Invalid email or access code")

    if user.email_verified_at is None:
        user.email_verified_at = utcnow()
    return await issue_session(session, user=user, device_label=device_label)


async def issue_session(
    session: AsyncSession, *, user: User, device_label: str | None = None
) -> IssuedSession:
    token = generate_token()
    user_session = UserSession(
        user_id=user.id,
        token_hash=hash_token(token),
        device_label=device_label,
        expires_at=utcnow() + timedelta(days=get_settings().session_ttl_days),
    )
    session.add(user_session)
    await session.flush()
    return IssuedSession(session=user_session, token=token, user=user)


async def resolve_session(session: AsyncSession, *, token: str) -> tuple[User, UserSession]:
    user_session = (
        await session.execute(
            select(UserSession).where(UserSession.token_hash == hash_token(token))
        )
    ).scalar_one_or_none()
    if user_session is None or not user_session.is_active:
        raise NotAuthenticated("Session is invalid or expired")

    user = await session.get(User, user_session.user_id)
    if user is None:
        raise NotAuthenticated("Session is invalid or expired")

    user_session.last_seen_at = utcnow()
    return user, user_session


async def revoke_session(session: AsyncSession, *, user_session: UserSession) -> None:
    user_session.revoked_at = utcnow()
    await session.flush()


async def regenerate_access_code(session: AsyncSession, *, user_id: UUID) -> str:
    user = await session.get(User, user_id)
    if user is None:
        raise NotAuthenticated("Session is invalid or expired")
    access_code = generate_code(ACCESS_CODE_LENGTH)
    user.access_code_hash = hash_secret(access_code)
    user.access_code_updated_at = utcnow()
    await session.flush()
    return access_code
