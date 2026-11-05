"""Security utilities: password hashing (argon2) and session tokens (JWT)."""

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Response

from app.config import get_auth_config

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    """Hashes a password using argon2. Never logs or stores plaintext."""
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    """Verifies a password against an argon2 hash."""
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, Exception):
        return False


def get_jwt_secret() -> str:
    """Returns JWT_SECRET from environment or raises an error if missing."""
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET environment variable is required")
    return secret


def create_session_token(user_id: str, role: str) -> str:
    """Creates a signed JWT session token."""
    auth_cfg = get_auth_config()
    session_hours = auth_cfg.get("session_hours", 8)
    now = datetime.now(timezone.utc)
    exp = now + timedelta(hours=session_hours)
    payload: Dict[str, Any] = {
        "sub": user_id,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm="HS256")


def decode_session_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and verifies a JWT session token."""
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=["HS256"])
        return payload
    except Exception:
        return None


def set_session_cookie(response: Response, token: str, is_https: bool = False) -> None:
    """Sets the HttpOnly, SameSite=Lax session cookie."""
    auth_cfg = get_auth_config()
    session_hours = auth_cfg.get("session_hours", 8)
    max_age = session_hours * 3600
    response.set_cookie(
        key="session",
        value=token,
        max_age=max_age,
        httponly=True,
        samesite="lax",
        secure=is_https,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    """Clears the session cookie."""
    response.delete_cookie(
        key="session",
        path="/",
        httponly=True,
        samesite="lax",
    )
