"""Authentication API endpoints: login, logout, me."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.auth.audit import is_email_locked, log_audit_event
from app.auth.dependencies import get_current_user, get_current_user_optional, verify_csrf
from app.auth.permissions import get_user_permissions, get_user_scope
from app.auth.security import (
    clear_session_cookie,
    create_session_token,
    set_session_cookie,
    verify_password,
)
from app.db import get_connection
from app.schemas import LoginRequest, LoginResponse, LogoutResponse, ScopeInfo, UserSummary

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse, dependencies=[Depends(verify_csrf)])
def login(req: LoginRequest, request: Request, response: Response) -> LoginResponse:
    """Authenticates an officer with email and password, setting an HttpOnly session cookie."""
    client_ip = request.client.host if request.client else None
    email_clean = req.email.strip().lower()

    conn = get_connection()
    try:
        # 1. Check account lockout
        if is_email_locked(conn, email_clean):
            log_audit_event(
                conn,
                event="login_failed",
                ip=client_ip,
                detail={"email": email_clean, "reason": "locked"},
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "code": "ACCOUNT_LOCKED",
                    "message": "Account temporarily locked due to repeated failed login attempts.",
                },
            )

        # 2. Look up user by email
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT user_id, name, email, password_hash, role, district, taluka, is_active
            FROM users WHERE lower(email) = ?
            """,
            (email_clean,),
        )
        user_row = cursor.fetchone()

        # 3. Validate credentials and active status
        if not user_row or not verify_password(user_row["password_hash"], req.password):
            log_audit_event(
                conn,
                event="login_failed",
                target_user_id=user_row["user_id"] if user_row else None,
                ip=client_ip,
                detail={"email": email_clean, "reason": "bad_credentials"},
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email or password"},
            )

        if user_row["is_active"] != 1:
            log_audit_event(
                conn,
                event="login_failed",
                target_user_id=user_row["user_id"],
                ip=client_ip,
                detail={"email": email_clean, "reason": "inactive_account"},
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email or password"},
            )

        # 4. Update last_login_at
        now_str = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            "UPDATE users SET last_login_at = ? WHERE user_id = ?",
            (now_str, user_row["user_id"]),
        )
        conn.commit()

        # 5. Issue session JWT and set cookie
        token = create_session_token(user_row["user_id"], user_row["role"])
        is_https = request.url.scheme == "https"
        set_session_cookie(response, token, is_https=is_https)

        # 6. Audit log successful login
        log_audit_event(
            conn,
            event="login_success",
            actor_id=user_row["user_id"],
            ip=client_ip,
            detail={"email": email_clean},
        )

        user_dict = dict(user_row)
        return LoginResponse(
            user=UserSummary(
                user_id=user_dict["user_id"],
                name=user_dict["name"],
                email=user_dict["email"],
                role=user_dict["role"],
                district=user_dict.get("district"),
                taluka=user_dict.get("taluka"),
            ),
            permissions=get_user_permissions(user_dict["role"]),
            scope=ScopeInfo(**get_user_scope(user_dict)),
        )
    finally:
        conn.close()


@router.post("/logout", response_model=LogoutResponse, dependencies=[Depends(verify_csrf)])
def logout(request: Request, response: Response) -> LogoutResponse:
    """Logs out current user, records audit event, and clears session cookie."""
    current_user = get_current_user_optional(request)
    client_ip = request.client.host if request.client else None

    if current_user:
        conn = get_connection()
        try:
            log_audit_event(
                conn,
                event="logout",
                actor_id=current_user["user_id"],
                ip=client_ip,
            )
        finally:
            conn.close()

    clear_session_cookie(response)
    return LogoutResponse(status="ok")


@router.get("/me", response_model=LoginResponse)
def get_me(current_user: dict = Depends(get_current_user)) -> LoginResponse:
    """Returns the authenticated user's profile, role permissions, and scope."""
    return LoginResponse(
        user=UserSummary(
            user_id=current_user["user_id"],
            name=current_user["name"],
            email=current_user["email"],
            role=current_user["role"],
            district=current_user.get("district"),
            taluka=current_user.get("taluka"),
        ),
        permissions=get_user_permissions(current_user["role"]),
        scope=ScopeInfo(**get_user_scope(current_user)),
    )
