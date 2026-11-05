"""Audit logging and account lockout enforcement."""

import json
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from app.config import get_auth_config


def log_audit_event(
    conn: sqlite3.Connection,
    event: str,
    actor_id: Optional[str] = None,
    target_user_id: Optional[str] = None,
    ip: Optional[str] = None,
    detail: Optional[Dict[str, Any]] = None,
) -> None:
    """Appends an event to the append-only audit_log table."""
    now = datetime.now(timezone.utc).isoformat()
    detail_str = json.dumps(detail or {})
    conn.execute(
        """
        INSERT INTO audit_log (event, actor_id, target_user_id, ip, detail_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (event, actor_id, target_user_id, ip, detail_str, now),
    )
    conn.commit()


def is_email_locked(conn: sqlite3.Connection, email: str) -> bool:
    """Checks whether an email is currently locked due to too many failed logins."""
    auth_cfg = get_auth_config()
    max_failed = auth_cfg.get("max_failed_logins", 5)
    lockout_mins = auth_cfg.get("lockout_minutes", 15)
    norm_email = email.lower().strip()

    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=lockout_mins)).isoformat()

    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT created_at FROM audit_log
        WHERE event = 'login_success'
          AND json_extract(detail_json, '$.email') = ?
        ORDER BY created_at DESC LIMIT 1
        """,
        (norm_email,),
    )
    last_success = cursor.fetchone()
    last_success_time = last_success["created_at"] if last_success else ""

    since_time = max(cutoff, last_success_time) if last_success_time else cutoff

    cursor.execute(
        """
        SELECT count(*) as cnt FROM audit_log
        WHERE event = 'login_failed'
          AND json_extract(detail_json, '$.email') = ?
          AND created_at >= ?
        """,
        (norm_email, since_time),
    )
    row = cursor.fetchone()
    return bool(row and row["cnt"] >= max_failed)
