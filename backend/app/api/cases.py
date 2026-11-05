"""Cases and action management endpoints."""

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import get_current_user, require_permission, verify_csrf
from app.auth.scope import ScopeFilter, get_scope_filter
from app.cases.state_machine import (
    case_has_recorded_outcome,
    get_allowed_actions,
    resolve_escalation_target,
    validate_action_transition,
    validate_reassign_target,
)
from app.config import load_config
from app.db import get_connection
from app.schemas import (
    CaseActionItem,
    CaseActionRequest,
    CaseDetail,
    CaseDetailResponse,
    CaseListItem,
    CaseListResponse,
)

router = APIRouter(tags=["cases"])


def is_case_overdue(
    c_status: str,
    last_action_at: Optional[str],
    overdue_days: int = 7,
) -> bool:
    """Case is overdue if open and no action for more than overdue_days."""
    if c_status == "closed" or not last_action_at:
        return False
    try:
        dt = datetime.fromisoformat(last_action_at.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        diff_days = (now - dt).total_seconds() / 86400.0
        return diff_days > overdue_days
    except Exception:
        return False


@router.get("/cases", response_model=CaseListResponse)
def list_cases(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    assignee_id: Optional[str] = Query(default=None),
    district: Optional[str] = Query(default=None),
    taluka: Optional[str] = Query(default=None),
    band: Optional[str] = Query(default=None),
    overdue: Optional[bool] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: Dict[str, Any] = Depends(require_permission("cases:view")),
    scope_filter: ScopeFilter = Depends(get_scope_filter),
) -> CaseListResponse:
    """Returns scoped list of cases sorted by latest risk score descending."""
    scope_filter.validate_requested_area(district, taluka)

    cfg = load_config()
    overdue_days = cfg.get("cases", {}).get("overdue_days", 7)

    conn = get_connection()
    try:
        scope_sql, scope_params = scope_filter.sql_case_filter("c", "s")
        where_clauses = [scope_sql]
        params: List[Any] = list(scope_params)

        if status_filter:
            where_clauses.append("c.status = ?")
            params.append(status_filter)
        if assignee_id:
            where_clauses.append("c.assignee_id = ?")
            params.append(assignee_id)
        if district:
            where_clauses.append("s.district = ?")
            params.append(district)
        if taluka:
            where_clauses.append("s.taluka = ?")
            params.append(taluka)
        if band:
            where_clauses.append("c.band_latest = ?")
            params.append(band)

        where_str = " AND ".join(where_clauses)

        # Count total
        count_query = f"""
            SELECT COUNT(*) as cnt
            FROM cases c
            JOIN shops s ON c.shop_id = s.shop_id
            WHERE {where_str};
        """
        cursor = conn.cursor()
        cursor.execute(count_query, params)
        total = cursor.fetchone()["cnt"]

        query = f"""
            SELECT c.*, s.name as shop_name, s.district, s.taluka, u.name as assignee_name
            FROM cases c
            JOIN shops s ON c.shop_id = s.shop_id
            LEFT JOIN users u ON c.assignee_id = u.user_id
            WHERE {where_str}
            ORDER BY c.risk_score_latest DESC
            LIMIT ? OFFSET ?;
        """
        cursor.execute(query, params + [limit, offset])
        rows = cursor.fetchall()

        items: List[CaseListItem] = []
        for r in rows:
            is_od = is_case_overdue(r["status"], r["last_action_at"], overdue_days)
            if overdue is not None and is_od != overdue:
                continue

            items.append(
                CaseListItem(
                    case_id=r["case_id"],
                    shop_id=r["shop_id"],
                    shop_name=r["shop_name"],
                    district=r["district"],
                    taluka=r["taluka"],
                    status=r["status"],
                    risk_score_latest=float(r["risk_score_latest"]),
                    band_latest=r["band_latest"],
                    opened_week=r["opened_week"],
                    last_flagged_week=r["last_flagged_week"],
                    assignee_id=r["assignee_id"],
                    assignee_name=r["assignee_name"],
                    is_overdue=is_od,
                    last_action_at=r["last_action_at"] or r["created_at"],
                    created_at=r["created_at"],
                )
            )

        return CaseListResponse(total=total, items=items)
    finally:
        conn.close()


@router.get("/cases/{case_id}", response_model=CaseDetailResponse)
def get_case_detail(
    case_id: str,
    current_user: Dict[str, Any] = Depends(require_permission("cases:view")),
    scope_filter: ScopeFilter = Depends(get_scope_filter),
) -> CaseDetailResponse:
    """Returns single case detail, action timeline, and allowed_actions for current user."""
    conn = get_connection()
    try:
        case_dict = scope_filter.require_case_in_scope(conn, case_id)

        cfg = load_config()
        overdue_days = cfg.get("cases", {}).get("overdue_days", 7)
        is_od = is_case_overdue(case_dict["status"], case_dict["last_action_at"], overdue_days)

        # Get assignee name
        assignee_name = None
        if case_dict["assignee_id"]:
            u_row = conn.execute(
                "SELECT name FROM users WHERE user_id = ?;", (case_dict["assignee_id"],)
            ).fetchone()
            if u_row:
                assignee_name = u_row["name"]

        has_outcome = case_has_recorded_outcome(conn, case_id)
        allowed = get_allowed_actions(case_dict, current_user, has_outcome=has_outcome)

        # Fetch action timeline
        actions_rows = conn.execute(
            """
            SELECT ca.*, u.name as actor_name
            FROM case_actions ca
            LEFT JOIN users u ON ca.actor_id = u.user_id
            WHERE ca.case_id = ?
            ORDER BY ca.id ASC;
            """,
            (case_id,),
        ).fetchall()

        actions_list: List[CaseActionItem] = []
        for a in actions_rows:
            payload_data = {}
            if a["payload_json"]:
                try:
                    payload_data = json.loads(a["payload_json"])
                except Exception:
                    payload_data = {}

            actions_list.append(
                CaseActionItem(
                    id=a["id"],
                    case_id=a["case_id"],
                    actor_id=a["actor_id"],
                    actor_name=a["actor_name"],
                    actor_role=a["actor_role"],
                    type=a["type"],
                    payload=payload_data,
                    risk_score_at_action=float(a["risk_score_at_action"])
                    if a["risk_score_at_action"] is not None
                    else None,
                    created_at=a["created_at"],
                )
            )

        case_detail = CaseDetail(
            case_id=case_dict["case_id"],
            shop_id=case_dict["shop_id"],
            shop_name=case_dict["shop_name"],
            district=case_dict["district"],
            taluka=case_dict["taluka"],
            status=case_dict["status"],
            risk_score_latest=float(case_dict["risk_score_latest"]),
            band_latest=case_dict["band_latest"],
            opened_week=case_dict["opened_week"],
            last_flagged_week=case_dict["last_flagged_week"],
            assignee_id=case_dict["assignee_id"],
            assignee_name=assignee_name,
            is_overdue=is_od,
            closed_at=case_dict["closed_at"],
            last_action_at=case_dict["last_action_at"] or case_dict["created_at"],
            created_at=case_dict["created_at"],
        )

        return CaseDetailResponse(
            case=case_detail,
            allowed_actions=allowed,
            actions=actions_list,
        )
    finally:
        conn.close()


@router.post(
    "/cases/{case_id}/actions",
    response_model=CaseActionItem,
    dependencies=[Depends(verify_csrf)],
)
def post_case_action(
    case_id: str,
    body: CaseActionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    scope_filter: ScopeFilter = Depends(get_scope_filter),
) -> CaseActionItem:
    """Executes state machine action on a case in scope with validation and append-only audit."""
    conn = get_connection()
    try:
        case_dict = scope_filter.require_case_in_scope(conn, case_id)
        action_type = body.type

        cfg = load_config()
        cases_cfg = cfg.get("cases", {})
        action_taken_options = cases_cfg.get(
            "action_taken_options",
            [
                "no_action",
                "warning_issued",
                "stock_verification_ordered",
                "referred_to_higher_authority",
                "other",
            ],
        )

        # 1. Payload validation per action type
        payload_dict: Dict[str, Any] = {}

        if action_type == "start_inspection":
            if body.note:
                payload_dict["note"] = body.note

        elif action_type == "record_outcome":
            if not body.outcome or body.outcome not in ("confirmed", "not_confirmed"):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="outcome is required and must be 'confirmed' or 'not_confirmed'",
                )
            if not body.action_taken or body.action_taken not in action_taken_options:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"action_taken must be one of {action_taken_options}",
                )
            if body.action_taken == "other" and not body.note:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="note is required when action_taken is 'other'",
                )

            payload_dict["outcome"] = body.outcome
            payload_dict["action_taken"] = body.action_taken
            if body.note:
                payload_dict["note"] = body.note
            if body.checklist_results:
                payload_dict["checklist_results"] = [
                    cr.model_dump() for cr in body.checklist_results
                ]

        elif action_type == "add_note":
            if not body.note or len(body.note.strip()) == 0 or len(body.note) > 500:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="note is required and must be between 1 and 500 characters",
                )
            payload_dict["note"] = body.note

        elif action_type == "escalate":
            if not body.reason or len(body.reason.strip()) == 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="reason is required for escalation",
                )
            payload_dict["reason"] = body.reason

        elif action_type == "reassign":
            if not body.to_user_id:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="to_user_id is required for reassignment",
                )
            payload_dict["to_user_id"] = body.to_user_id
            if body.reason:
                payload_dict["reason"] = body.reason

        elif action_type in ("close", "reopen"):
            if not body.reason or len(body.reason.strip()) == 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"reason is required to {action_type} case",
                )
            payload_dict["reason"] = body.reason

        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unknown action type: {action_type}",
            )

        # 2. State machine transition check
        result_status = validate_action_transition(conn, case_dict, action_type, current_user)

        # 3. Action-specific resolution
        shop_meta = {
            "district": case_dict["district"],
            "taluka": case_dict["taluka"],
        }
        new_assignee_id = case_dict["assignee_id"]

        if action_type == "escalate":
            target_assignee = resolve_escalation_target(
                conn, case_dict, shop_meta, current_user
            )
            new_assignee_id = target_assignee
            payload_dict["escalated_to"] = target_assignee

        elif action_type == "reassign":
            if not body.to_user_id:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="to_user_id is required for reassign action",
                )
            validate_reassign_target(conn, current_user, body.to_user_id, shop_meta)
            new_assignee_id = body.to_user_id

        elif action_type == "reopen":
            # Restore assignee if null
            if not new_assignee_id:
                new_assignee_id = current_user["user_id"]

        # 4. Insert append-only case_action
        now_str = datetime.now(timezone.utc).isoformat()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO case_actions (
                case_id, actor_id, actor_role, type, payload_json,
                risk_score_at_action, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?);
            """,
            (
                case_id,
                current_user["user_id"],
                current_user["role"],
                action_type,
                json.dumps(payload_dict),
                case_dict["risk_score_latest"],
                now_str,
            ),
        )
        action_id = cursor.lastrowid

        # 5. Update cases row
        update_fields = ["last_action_at = ?"]
        update_params = [now_str]

        if result_status:
            update_fields.append("status = ?")
            update_params.append(result_status)

        if action_type in ("escalate", "reassign", "reopen"):
            update_fields.append("assignee_id = ?")
            update_params.append(new_assignee_id)

        if result_status == "closed":
            update_fields.append("closed_at = ?")
            update_params.append(now_str)
        elif result_status == "assigned":
            update_fields.append("closed_at = NULL")

        update_params.append(case_id)
        cursor.execute(
            f"UPDATE cases SET {', '.join(update_fields)} WHERE case_id = ?;",
            update_params,
        )

        conn.commit()

        return CaseActionItem(
            id=int(action_id or 0),
            case_id=case_id,
            actor_id=current_user["user_id"],
            actor_name=current_user["name"],
            actor_role=current_user["role"],
            type=action_type,
            payload=payload_dict,
            risk_score_at_action=case_dict["risk_score_latest"],
            created_at=now_str,
        )
    finally:
        conn.close()
