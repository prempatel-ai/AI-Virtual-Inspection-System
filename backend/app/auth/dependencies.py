"""FastAPI dependencies for authentication, CSRF validation, and authorization."""

from typing import Any, Callable, Dict, Optional

from fastapi import Depends, HTTPException, Request, status

from app.auth.audit import log_audit_event
from app.auth.permissions import has_permission
from app.auth.security import decode_session_token
from app.db import get_connection


async def verify_csrf(request: Request) -> None:
    """Verifies X-Requested-With: fetch header on state-changing requests."""
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        header_val = request.headers.get("x-requested-with", "").strip().lower()
        if header_val != "fetch":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "CSRF_REQUIRED",
                    "message": "Missing or invalid X-Requested-With header",
                },
            )


def get_current_user_optional(request: Request) -> Optional[Dict[str, Any]]:
    """Returns current user from session cookie if present and valid, otherwise None."""
    token = request.cookies.get("session")
    if not token:
        return None

    payload = decode_session_token(token)
    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT user_id, name, email, role, district, taluka,
                   is_active, last_login_at, created_at
            FROM users WHERE user_id = ?
            """,
            (user_id,),
        )
        row = cursor.fetchone()
        if not row or row["is_active"] != 1:
            return None
        return dict(row)
    finally:
        conn.close()


def get_current_user(request: Request) -> Dict[str, Any]:
    """Requires an authenticated active user session, re-reading from DB."""
    user = get_current_user_optional(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHENTICATED", "message": "Authentication required"},
        )
    return user


def require_permission(permission: str) -> Callable:
    """Dependency factory checking that the authenticated user possesses the given permission."""

    def _dependency(
        request: Request,
        current_user: Dict[str, Any] = Depends(get_current_user),
    ) -> Dict[str, Any]:
        if not has_permission(current_user["role"], permission):
            conn = get_connection()
            try:
                client_ip = request.client.host if request.client else None
                log_audit_event(
                    conn,
                    event="access_denied",
                    actor_id=current_user["user_id"],
                    ip=client_ip,
                    detail={"permission": permission, "path": request.url.path},
                )
            finally:
                conn.close()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Permission denied"},
            )
        return current_user

    return _dependency
