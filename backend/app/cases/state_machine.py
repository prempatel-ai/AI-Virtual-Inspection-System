"""Case state machine, transition validation, escalation, and allowed_actions computation."""

import sqlite3
from typing import Any, Dict, List, Optional, Set, cast

from fastapi import HTTPException, status

ALLOWED_STATUSES = {"new", "assigned", "in_progress", "inspected", "escalated", "closed"}

ACTION_STATUS_TRANSITIONS = {
    "start_inspection": {
        "allowed_from": {"assigned", "escalated"},
        "result_status": "in_progress",
    },
    "record_outcome": {
        "allowed_from": {"in_progress"},
        "result_status": "inspected",
    },
    "add_note": {
        "allowed_from": ALLOWED_STATUSES,
        "result_status": None,  # status unchanged
    },
    "escalate": {
        "allowed_from": {"assigned", "in_progress", "inspected", "escalated"},
        "result_status": "escalated",
    },
    "reassign": {
        "allowed_from": {"new", "assigned", "in_progress", "escalated"},
        "result_status": "assigned",
    },
    "close": {
        "allowed_from": {"inspected", "escalated"},
        "result_status": "closed",
    },
    "reopen": {
        "allowed_from": {"closed"},
        "result_status": "assigned",
    },
}


def case_has_recorded_outcome(conn: sqlite3.Connection, case_id: str) -> bool:
    """Checks if case has at least one recorded outcome action."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT 1 FROM case_actions WHERE case_id = ? AND type = 'record_outcome' LIMIT 1;",
        (case_id,),
    )
    return cursor.fetchone() is not None


def get_allowed_actions(
    case: Dict[str, Any],
    current_user: Dict[str, Any],
    has_outcome: bool = False,
) -> List[str]:
    """
    Computes list of action types the current user is permitted to perform on the case.
    The frontend renders action buttons directly from this list.
    """
    actions: List[str] = []
    c_status = case.get("status")
    assignee_id = case.get("assignee_id")
    user_id = current_user.get("user_id")
    role = current_user.get("role", "")
    is_assignee = user_id is not None and user_id == assignee_id

    # 1. start_inspection: allowed from assigned, escalated by assignee
    if c_status in ("assigned", "escalated") and is_assignee:
        actions.append("start_inspection")

    # 2. record_outcome: allowed from in_progress by assignee
    if c_status == "in_progress" and is_assignee:
        actions.append("record_outcome")

    # 3. add_note: allowed from any status by all authenticated roles
    actions.append("add_note")

    # 4. escalate: allowed from assigned, in_progress, inspected, escalated
    # Allowed for inspector, mamlatdar, district_officer
    if c_status in ("assigned", "in_progress", "inspected", "escalated") and role in (
        "inspector",
        "mamlatdar",
        "district_officer",
    ):
        actions.append("escalate")

    # 5. reassign: allowed from new, assigned, in_progress, escalated
    # Allowed for mamlatdar (taluka), district_officer (district), admin (state)
    if c_status in ("new", "assigned", "in_progress", "escalated") and role in (
        "mamlatdar",
        "district_officer",
        "admin",
    ):
        actions.append("reassign")

    # 6. close: allowed from inspected, or escalated with a recorded outcome
    # Allowed for mamlatdar, district_officer, admin
    if role in ("mamlatdar", "district_officer", "admin"):
        if c_status == "inspected" or (c_status == "escalated" and has_outcome):
            actions.append("close")

    # 7. reopen: allowed from closed
    # Allowed for mamlatdar, district_officer, admin
    if c_status == "closed" and role in ("mamlatdar", "district_officer", "admin"):
        actions.append("reopen")

    return actions


def resolve_escalation_target(
    conn: sqlite3.Connection,
    case: Dict[str, Any],
    shop: Dict[str, Any],
    current_user: Dict[str, Any],
) -> str:
    """
    Escalation chain per docs/V2_SPEC.md Section 3:
    - inspector -> mamlatdar (shop's taluka)
    - mamlatdar -> district_officer (shop's district)
    - district_officer -> vigilance (the vigilance user with the fewest open cases)
    """
    cursor = conn.cursor()
    role = current_user.get("role")
    district = shop.get("district")
    taluka = shop.get("taluka")

    if role == "inspector":
        cursor.execute(
            """
            SELECT user_id FROM users
            WHERE role = 'mamlatdar' AND district = ? AND taluka = ? AND is_active = 1
            LIMIT 1;
            """,
            (district, taluka),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"No active Mamlatdar available for {district} / {taluka} to escalate to",
            )
        return row["user_id"]

    elif role == "mamlatdar":
        cursor.execute(
            """
            SELECT user_id FROM users
            WHERE role = 'district_officer' AND district = ? AND is_active = 1
            LIMIT 1;
            """,
            (district,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"No active District Officer available for {district} to escalate to",
            )
        return row["user_id"]

    elif role == "district_officer":
        # Vigilance user with the fewest open cases
        cursor.execute(
            """
            SELECT u.user_id, COUNT(c.case_id) as open_cases
            FROM users u
            LEFT JOIN cases c ON u.user_id = c.assignee_id AND c.status != 'closed'
            WHERE u.role = 'vigilance' AND u.is_active = 1
            GROUP BY u.user_id
            ORDER BY open_cases ASC, u.user_id ASC
            LIMIT 1;
            """
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No active Vigilance officer available to escalate to",
            )
        return row["user_id"]

    else:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Role '{role}' cannot escalate cases",
        )


def validate_reassign_target(
    conn: sqlite3.Connection,
    current_user: Dict[str, Any],
    to_user_id: str,
    shop: Dict[str, Any],
) -> Dict[str, Any]:
    """Validates that reassignment target user is active and within reassigner's scope."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT user_id, role, district, taluka, is_active FROM users WHERE user_id = ?;",
        (to_user_id,),
    )
    target = cursor.fetchone()
    if not target or target["is_active"] != 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Target user '{to_user_id}' does not exist or is inactive",
        )

    role = current_user.get("role")
    if role == "mamlatdar":
        # Can only reassign within their own taluka
        if (
            target["district"] != current_user.get("district")
            or target["taluka"] != current_user.get("taluka")
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Mamlatdar can only reassign to officers within their taluka",
            )
    elif role == "district_officer":
        # Can only reassign within their own district
        if target["district"] != current_user.get("district"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="District Officer can only reassign to officers within their district",
            )
    elif role == "admin":
        # Admin can reassign anywhere
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{role}' does not have reassign permission",
        )

    return dict(target)


def validate_action_transition(
    conn: sqlite3.Connection,
    case: Dict[str, Any],
    action_type: str,
    current_user: Dict[str, Any],
) -> Optional[str]:
    """
    Validates state machine transition.
    Raises:
    - 409 Conflict if transition is invalid from current case status.
    - 403 Forbidden if current user lacks required role/assignee status.
    Returns:
    - result_status (str or None)
    """
    if action_type not in ACTION_STATUS_TRANSITIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown action type: {action_type}",
        )

    rule = cast(Dict[str, Any], ACTION_STATUS_TRANSITIONS[action_type])
    c_status = case.get("status")
    user_id = current_user.get("user_id")
    role = current_user.get("role", "")
    assignee_id = case.get("assignee_id")
    has_outcome = case_has_recorded_outcome(conn, case["case_id"])

    allowed_from = cast(Set[str], rule["allowed_from"])
    # 1. Check if allowed from current status
    if c_status not in allowed_from:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Action '{action_type}' is not allowed from status '{c_status}'",
        )

    # 2. Check action-specific role / assignee permissions
    if action_type in ("start_inspection", "record_outcome"):
        if user_id != assignee_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Only current assignee ('{assignee_id}') can perform '{action_type}'",
            )

    elif action_type == "escalate":
        if role not in ("inspector", "mamlatdar", "district_officer"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role}' cannot escalate cases",
            )

    elif action_type == "reassign":
        if role not in ("mamlatdar", "district_officer", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role}' cannot reassign cases",
            )

    elif action_type == "close":
        if role not in ("mamlatdar", "district_officer", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role}' cannot close cases",
            )
        if c_status == "escalated" and not has_outcome:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot close an escalated case without a recorded outcome",
            )

    elif action_type == "reopen":
        if role not in ("mamlatdar", "district_officer", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role}' cannot reopen cases",
            )

    return cast(Optional[str], rule["result_status"])
