"""Secret handling.

Argon2id for human-chosen secrets (group passcodes, access codes).
SHA-256 for session and invite tokens: they are already 256-bit random, so
Argon2 there would only add latency to every authenticated request.
"""

import hashlib
import secrets
import string

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

password_hasher = PasswordHasher()

#: Unambiguous alphabet: no O/0, I/1, so codes survive being read aloud.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
TOKEN_PREFIX_LENGTH = 8


def hash_secret(value: str) -> str:
    return password_hasher.hash(value)


def verify_secret(hash_value: str, value: str) -> bool:
    try:
        return password_hasher.verify(hash_value, value)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(hash_value: str) -> bool:
    return password_hasher.check_needs_rehash(hash_value)


def generate_token() -> str:
    """A session or invite token. Returned to the client exactly once."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def token_prefix(token: str) -> str:
    """Stored alongside the hash so a lookup can use an index."""
    return token[:TOKEN_PREFIX_LENGTH]


def generate_code(length: int = 8) -> str:
    """A shareable join code."""
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(length))


def generate_slug(name: str, suffix_length: int = 4) -> str:
    """A public slug: a readable stem plus random suffix to keep it unique."""
    stem = "".join(
        char if char in string.ascii_lowercase + string.digits else "-"
        for char in name.strip().lower()
    ).strip("-")
    while "--" in stem:
        stem = stem.replace("--", "-")
    suffix = "".join(secrets.choice(string.ascii_lowercase + string.digits)
                     for _ in range(suffix_length))
    return f"{stem[:40]}-{suffix}" if stem else suffix


def normalize_name(value: str) -> str:
    """Mirror of the SQL display_name_normalized generated column (rule 11)."""
    return " ".join(value.strip().lower().split())
