"""Admin plane endpoints: users management, password reset, and access log."""

import json
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.auth.audit import log_audit_event
from app.auth.dependencies import require_permission, verify_csrf
from app.auth.permissions import VALID_ROLES
from app.auth.security import hash_password
from app.db import get_connection
from app.schemas import (
    AdminUserItem,
    AdminUserListResponse,
    AuditLogItem,
    AuditLogResponse,
    CreateUserRequest,
    CreateUserResponse,
    ResetPasswordResponse,
    UpdateUserRequest,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=AdminUserListResponse)
def list_admin_users(
    current_user: Dict[str, Any] = Depends(require_permission("users:manage")),
) -> AdminUserListResponse:
    """Lists all users (admin only). Never returns password_hash."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT user_id, name, email, role, district, taluka,
                   is_active, last_login_at, created_at
            FROM users
            ORDER BY created_at DESC;
            """
        )
        rows = cursor.fetchall()
        items = [
            AdminUserItem(
                user_id=r["user_id"],
                name=r["name"],
                email=r["email"],
                role=r["role"],
                district=r["district"],
                taluka=r["taluka"],
                is_active=bool(r["is_active"]),
                last_login_at=r["last_login_at"],
                created_at=r["created_at"],
            )
            for r in rows
        ]
        return AdminUserListResponse(items=items)
    finally:
        conn.close()


@router.post(
    "/users",
    response_model=CreateUserResponse,
    dependencies=[Depends(verify_csrf)],
)
def create_admin_user(
    body: CreateUserRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(require_permission("users:manage")),
) -> CreateUserResponse:
    """Creates a new user and returns a temporary password once (admin only)."""
    norm_email = body.email.strip().lower()
    if body.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid role '{body.role}'. Must be one of {VALID_ROLES}",
        )

    # Generate temporary password (at least 10 chars per spec)
    temp_password = secrets.token_urlsafe(12)  # 16 alphanumeric characters
    pw_hash = hash_password(temp_password)

    user_id = f"usr-{secrets.token_hex(4)}"
    now_str = datetime.now(timezone.utc).isoformat()
    ip = request.client.host if request.client else "127.0.0.1"

    conn = get_connection()
    try:
        cursor = conn.cursor()
        # Check email uniqueness
        cursor.execute("SELECT 1 FROM users WHERE email = ?;", (norm_email,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email '{norm_email}' is already registered",
            )

        cursor.execute(
            """
            INSERT INTO users (
                user_id, name, email, password_hash, role, district, taluka, is_active, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?);
            """,
            (
                user_id,
                body.name.strip(),
                norm_email,
                pw_hash,
                body.role,
                body.district,
                body.taluka,
                now_str,
            ),
        )

        log_audit_event(
            conn,
            event="user_created",
            actor_id=current_user["user_id"],
            target_user_id=user_id,
            ip=ip,
            detail={"role": body.role, "district": body.district, "taluka": body.taluka},
        )
        conn.commit()

        user_item = AdminUserItem(
            user_id=user_id,
            name=body.name.strip(),
            email=norm_email,
            role=body.role,
            district=body.district,
            taluka=body.taluka,
            is_active=True,
            last_login_at=None,
            created_at=now_str,
        )
        return CreateUserResponse(user=user_item, temporary_password=temp_password)
    finally:
        conn.close()


@router.patch(
    "/users/{user_id}",
    response_model=AdminUserItem,
    dependencies=[Depends(verify_csrf)],
)
def update_admin_user(
    user_id: str,
    body: UpdateUserRequest,
    request: Request,
    current_user: Dict[str, Any] = Depends(require_permission("users:manage")),
) -> AdminUserItem:
    """Updates role, scope, or active status of a user (admin only)."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE user_id = ?;", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User {user_id} not found",
            )

        updates: List[str] = []
        params: List[Any] = []
        detail: Dict[str, Any] = {}

        if body.role is not None:
            if body.role not in VALID_ROLES:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Invalid role '{body.role}'",
                )
            updates.append("role = ?")
            params.append(body.role)
            detail["role"] = body.role

        if body.district is not None:
            updates.append("district = ?")
            params.append(body.district)
            detail["district"] = body.district

        if body.taluka is not None:
            updates.append("taluka = ?")
            params.append(body.taluka)
            detail["taluka"] = body.taluka

        is_deactivating = False
        if body.is_active is not None:
            val = 1 if body.is_active else 0
            updates.append("is_active = ?")
            params.append(val)
            detail["is_active"] = body.is_active
            if not body.is_active and user["is_active"] == 1:
                is_deactivating = True

        if updates:
            params.append(user_id)
            cursor.execute(f"UPDATE users SET {', '.join(updates)} WHERE user_id = ?;", params)

            event = "user_deactivated" if is_deactivating else "user_updated"
            ip = request.client.host if request.client else "127.0.0.1"
            log_audit_event(
                conn,
                event=event,
                actor_id=current_user["user_id"],
                target_user_id=user_id,
                ip=ip,
                detail=detail,
            )
            conn.commit()

        # Re-fetch updated user
        cursor.execute("SELECT * FROM users WHERE user_id = ?;", (user_id,))
        updated = cursor.fetchone()
        return AdminUserItem(
            user_id=updated["user_id"],
            name=updated["name"],
            email=updated["email"],
            role=updated["role"],
            district=updated["district"],
            taluka=updated["taluka"],
            is_active=bool(updated["is_active"]),
            last_login_at=updated["last_login_at"],
            created_at=updated["created_at"],
        )
    finally:
        conn.close()


@router.post(
    "/users/{user_id}/reset-password",
    response_model=ResetPasswordResponse,
    dependencies=[Depends(verify_csrf)],
)
def reset_admin_user_password(
    user_id: str,
    request: Request,
    current_user: Dict[str, Any] = Depends(require_permission("users:manage")),
) -> ResetPasswordResponse:
    """Resets user password and returns temporary password once (admin only)."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT user_id FROM users WHERE user_id = ?;", (user_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User {user_id} not found",
            )

        temp_password = secrets.token_urlsafe(12)
        pw_hash = hash_password(temp_password)

        cursor.execute(
            "UPDATE users SET password_hash = ? WHERE user_id = ?;",
            (pw_hash, user_id),
        )

        ip = request.client.host if request.client else "127.0.0.1"
        log_audit_event(
            conn,
            event="password_reset",
            actor_id=current_user["user_id"],
            target_user_id=user_id,
            ip=ip,
            detail={},
        )
        conn.commit()

        return ResetPasswordResponse(user_id=user_id, temporary_password=temp_password)
    finally:
        conn.close()


@router.get("/audit", response_model=AuditLogResponse)
def get_admin_audit_log(
    event: Optional[str] = Query(default=None),
    user_id: Optional[str] = Query(default=None),
    from_date: Optional[str] = Query(default=None, alias="from"),
    to_date: Optional[str] = Query(default=None, alias="to"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: Dict[str, Any] = Depends(require_permission("audit:view")),
) -> AuditLogResponse:
    """Lists access log entries from append-only audit_log (admin only)."""
    where_clauses = ["1=1"]
    params: List[Any] = []

    if event:
        where_clauses.append("event = ?")
        params.append(event)
    if user_id:
        where_clauses.append("(actor_id = ? OR target_user_id = ?)")
        params.extend([user_id, user_id])
    if from_date:
        where_clauses.append("created_at >= ?")
        params.append(from_date)
    if to_date:
        where_clauses.append("created_at <= ?")
        params.append(to_date)

    where_sql = " AND ".join(where_clauses)

    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(f"SELECT COUNT(*) as cnt FROM audit_log WHERE {where_sql};", params)
        total = cursor.fetchone()["cnt"]

        cursor.execute(
            f"""
            SELECT id, event, actor_id, target_user_id, ip, detail_json, created_at
            FROM audit_log
            WHERE {where_sql}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?;
            """,
            params + [limit, offset],
        )
        rows = cursor.fetchall()

        items: List[AuditLogItem] = []
        for r in rows:
            d_dict = {}
            if r["detail_json"]:
                try:
                    d_dict = json.loads(r["detail_json"])
                except Exception:
                    d_dict = {}
            items.append(
                AuditLogItem(
                    id=r["id"],
                    event=r["event"],
                    actor_id=r["actor_id"],
                    target_user_id=r["target_user_id"],
                    ip=r["ip"],
                    detail=d_dict,
                    created_at=r["created_at"],
                )
            )

        return AuditLogResponse(total=total, items=items)
    finally:
        conn.close()
