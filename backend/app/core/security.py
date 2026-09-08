import hashlib
import secrets

from argon2 import PasswordHasher

password_hasher = PasswordHasher()


def hash_secret(value: str) -> str:
    return password_hasher.hash(value)


def verify_secret(hash_value: str, value: str) -> bool:
    try:
        return password_hasher.verify(hash_value, value)
    except Exception:
        return False


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()