"""Oversight endpoints: areas, officers, action feed."""

import json
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.dependencies import require_permission
from app.auth.permissions import ROLE_PERMISSIONS
from app.auth.scope import ScopeFilter, get_scope_filter
from app.config import load_config
from app.db import get_connection
from app.metrics import compute_area_metrics, compute_officer_stats, is_overdue_check
from app.schemas import (
    ActionFeedItem,
    ActionFeedResponse,
    AreaMetricItem,
    AreaMetricsResponse,
    CaseActionItem,
    CaseListItem,
    OfficerDetailResponse,
    OfficerListItem,
    OfficerListResponse,
    OfficerStats,
)

router = APIRouter(tags=["oversight"])


@router.get("/areas", response_model=AreaMetricsResponse)
def get_areas(
    level: Literal["district", "taluka"] = Query(default="district"),
    parent: Optional[str] = Query(default=None),
    current_user: Dict[str, Any] = Depends(require_permission("areas:view")),
    scope_filter: ScopeFilter = Depends(get_scope_filter),
) -> AreaMetricsResponse:
    """Returns area-level metrics filtered by caller's scope."""
    # Scope restrictions on areas
    user_role = current_user.get("role")
    user_district = current_user.get("district")
    user_taluka = current_user.get("taluka")

    if user_role == "district_officer":
        if parent and parent != user_district:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "AREA_NOT_FOUND", "message": f"District {parent} not found"},
            )
        if level == "taluka":
            parent = user_district

    elif user_role == "mamlatdar":
        if parent and parent != user_district:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "AREA_NOT_FOUND", "message": f"District {parent} not found"},
            )
        level = "taluka"
        parent = user_district

    conn = get_connection()
    try:
        cfg = load_config()
        all_metrics = compute_area_metrics(
            conn=conn,
            level=level,
            parent=parent,
            config=cfg,
        )

        # Further filter for district_officer or mamlatdar
        filtered_metrics = []
        for m in all_metrics:
            if user_role == "district_officer" and level == "district":
                if m["name"] != user_district:
                    continue
            elif user_role == "mamlatdar":
                if m["name"] != user_taluka:
                    continue
            filtered_metrics.append(AreaMetricItem(**m))

        return AreaMetricsResponse(items=filtered_metrics)
    finally:
        conn.close()


@router.get("/officers", response_model=OfficerListResponse)
def get_officers(
    role: Optional[str] = Query(default=None),
    district: Optional[str] = Query(default=None),
    taluka: Optional[str] = Query(default=None),
    active: Optional[bool] = Query(default=None),
    current_user: Dict[str, Any] = Depends(require_permission("officers:view")),
    scope_filter: ScopeFilter = Depends(get_scope_filter),
) -> OfficerListResponse:
    """Returns list of officers in caller's scope with aggregate performance stats."""
    scope_filter.validate_requested_area(district=district, taluka=taluka)

    user_role = current_user.get("role")
    user_id = current_user.get("user_id")
    user_district = current_user.get("district")
    user_taluka = current_user.get("taluka")

    where_clauses = ["1=1"]
    params: List[Any] = []

    # Enforce caller's scope on officers list
    if user_role == "inspector":
        where_clauses.append("user_id = ?")
        params.append(user_id)
    elif user_role == "mamlatdar":
        where_clauses.append("district = ? AND taluka = ?")
        params.extend([user_district, user_taluka])
    elif user_role == "district_officer":
        where_clauses.append("district = ?")
        params.append(user_district)

    # Apply query filters
    if role:
        where_clauses.append("role = ?")
        params.append(role)
    if district:
        where_clauses.append("district = ?")
        params.append(district)
    if taluka:
        where_clauses.append("taluka = ?")
        params.append(taluka)
    if active is not None:
        where_clauses.append("is_active = ?")
        params.append(1 if active else 0)

    where_sql = " AND ".join(where_clauses)

    conn = get_connection()
    try:
        cfg = load_config()
        overdue_days = cfg.get("cases", {}).get("overdue_days", 7)

        cursor = conn.cursor()
        cursor.execute(
            f"""
            SELECT user_id, name, role, district, taluka, is_active
            FROM users
            WHERE {where_sql}
            ORDER BY name ASC;
            """,
            params,
        )
        officer_rows = cursor.fetchall()

        items: List[OfficerListItem] = []
        for r in officer_rows:
            stats_dict = compute_officer_stats(conn, r["user_id"], overdue_days=overdue_days)
            items.append(
                OfficerListItem(
                    user_id=r["user_id"],
                    name=r["name"],
                    role=r["role"],
                    district=r["district"],
                    taluka=r["taluka"],
                    is_active=bool(r["is_active"]),
                    stats=OfficerStats(**stats_dict),
                )
            )

        return OfficerListResponse(items=items)
    finally:
        conn.close()


@router.get("/officers/{officer_id}", response_model=OfficerDetailResponse)
def get_officer_detail(
    officer_id: str,
    current_user: Dict[str, Any] = Depends(require_permission("officers:view")),
    scope_filter: ScopeFilter = Depends(get_scope_filter),
) -> OfficerDetailResponse:
    """Returns detailed profile, permissions, assigned cases, actions, and area flag rate."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT user_id, name, email, role, district, taluka, is_active, created_at
            FROM users
            WHERE user_id = ?;
            """,
            (officer_id,),
        )
        officer = cursor.fetchone()
        if not officer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "OFFICER_NOT_FOUND", "message": f"Officer {officer_id} not found"},
            )

        # Check scope access
        user_role = current_user.get("role")
        user_id = current_user.get("user_id")
        user_district = current_user.get("district")
        user_taluka = current_user.get("taluka")

        in_scope = False
        if user_role in ("admin", "vigilance"):
            in_scope = True
        elif user_role == "district_officer":
            in_scope = (officer["district"] == user_district)
        elif user_role == "mamlatdar":
            in_scope = (officer["district"] == user_district and officer["taluka"] == user_taluka)
        elif user_role == "inspector":
            in_scope = (officer["user_id"] == user_id)

        if not in_scope:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "OFFICER_NOT_FOUND", "message": f"Officer {officer_id} not found"},
            )

        cfg = load_config()
        overdue_days = cfg.get("cases", {}).get("overdue_days", 7)
        stats_dict = compute_officer_stats(conn, officer_id, overdue_days=overdue_days)

        # Role permissions
        perms = sorted(list(ROLE_PERMISSIONS.get(officer["role"], set())))
        scope_info = {
            "role": officer["role"],
            "district": officer["district"],
            "taluka": officer["taluka"],
        }

        # Assigned cases
        cursor.execute(
            """
            SELECT c.*, s.name as shop_name, s.district, s.taluka, u.name as assignee_name
            FROM cases c
            JOIN shops s ON c.shop_id = s.shop_id
            LEFT JOIN users u ON c.assignee_id = u.user_id
            WHERE c.assignee_id = ?
            ORDER BY c.risk_score_latest DESC;
            """,
            (officer_id,),
        )
        case_rows = cursor.fetchall()
        assigned_cases: List[CaseListItem] = []
        for cr in case_rows:
            is_od = is_overdue_check(
                cr["status"], cr["last_action_at"] or cr["created_at"], overdue_days
            )
            assigned_cases.append(
                CaseListItem(
                    case_id=cr["case_id"],
                    shop_id=cr["shop_id"],
                    shop_name=cr["shop_name"],
                    district=cr["district"],
                    taluka=cr["taluka"],
                    status=cr["status"],
                    risk_score_latest=float(cr["risk_score_latest"]),
                    band_latest=cr["band_latest"],
                    opened_week=cr["opened_week"],
                    last_flagged_week=cr["last_flagged_week"],
                    assignee_id=cr["assignee_id"],
                    assignee_name=cr["assignee_name"],
                    is_overdue=is_od,
                    last_action_at=cr["last_action_at"] or cr["created_at"],
                    created_at=cr["created_at"],
                )
            )

        # Recent actions
        cursor.execute(
            """
            SELECT ca.*, u.name as actor_name
            FROM case_actions ca
            LEFT JOIN users u ON ca.actor_id = u.user_id
            WHERE ca.actor_id = ?
            ORDER BY ca.created_at DESC
            LIMIT 20;
            """,
            (officer_id,),
        )
        action_rows = cursor.fetchall()
        recent_actions: List[CaseActionItem] = []
        for ar in action_rows:
            p_dict = {}
            if ar["payload_json"]:
                try:
                    p_dict = json.loads(ar["payload_json"])
                except Exception:
                    p_dict = {}
            recent_actions.append(
                CaseActionItem(
                    id=ar["id"],
                    case_id=ar["case_id"],
                    actor_id=ar["actor_id"],
                    actor_name=ar["actor_name"],
                    actor_role=ar["actor_role"],
                    type=ar["type"],
                    payload=p_dict,
                    risk_score_at_action=float(ar["risk_score_at_action"])
                    if ar["risk_score_at_action"] is not None
                    else None,
                    created_at=ar["created_at"],
                )
            )

        # Area flag rate
        area_flag_rate = None
        if officer["district"]:
            if officer["taluka"]:
                t_metrics = compute_area_metrics(
                    conn, level="taluka", parent=officer["district"], config=cfg
                )
                match = next((t for t in t_metrics if t["name"] == officer["taluka"]), None)
                if match:
                    area_flag_rate = match["flag_rate"]
            else:
                d_metrics = compute_area_metrics(conn, level="district", config=cfg)
                match = next((d for d in d_metrics if d["name"] == officer["district"]), None)
                if match:
                    area_flag_rate = match["flag_rate"]

        return OfficerDetailResponse(
            user_id=officer["user_id"],
            name=officer["name"],
            email=officer["email"],
            role=officer["role"],
            district=officer["district"],
            taluka=officer["taluka"],
            is_active=bool(officer["is_active"]),
            created_at=officer["created_at"],
            permissions=perms,
            scope=scope_info,
            stats=OfficerStats(**stats_dict),
            assigned_cases=assigned_cases,
            recent_actions=recent_actions,
            area_flag_rate=area_flag_rate,
        )
    finally:
        conn.close()


@router.get("/actions", response_model=ActionFeedResponse)
def get_action_feed(
    officer_id: Optional[str] = Query(default=None),
    type_filter: Optional[str] = Query(default=None, alias="type"),
    case_id: Optional[str] = Query(default=None),
    from_date: Optional[str] = Query(default=None, alias="from"),
    to_date: Optional[str] = Query(default=None, alias="to"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: Dict[str, Any] = Depends(require_permission("actions:view")),
    scope_filter: ScopeFilter = Depends(get_scope_filter),
) -> ActionFeedResponse:
    """Returns scoped audit feed of case actions."""
    user_role = current_user.get("role")
    user_id = current_user.get("user_id")
    user_district = current_user.get("district")
    user_taluka = current_user.get("taluka")

    where_clauses = ["1=1"]
    params: List[Any] = []

    # Scope filtering
    if user_role == "inspector":
        where_clauses.append("(ca.actor_id = ? OR s.inspector_id = ? OR c.assignee_id = ?)")
        params.extend([user_id, user_id, user_id])
    elif user_role == "mamlatdar":
        where_clauses.append("s.district = ? AND s.taluka = ?")
        params.extend([user_district, user_taluka])
    elif user_role == "district_officer":
        where_clauses.append("s.district = ?")
        params.append(user_district)

    # Query parameters
    if officer_id:
        where_clauses.append("ca.actor_id = ?")
        params.append(officer_id)
    if type_filter:
        where_clauses.append("ca.type = ?")
        params.append(type_filter)
    if case_id:
        where_clauses.append("ca.case_id = ?")
        params.append(case_id)
    if from_date:
        where_clauses.append("ca.created_at >= ?")
        params.append(from_date)
    if to_date:
        where_clauses.append("ca.created_at <= ?")
        params.append(to_date)

    where_sql = " AND ".join(where_clauses)

    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            f"""
            SELECT COUNT(*) as cnt
            FROM case_actions ca
            JOIN cases c ON ca.case_id = c.case_id
            JOIN shops s ON c.shop_id = s.shop_id
            WHERE {where_sql};
            """,
            params,
        )
        total = cursor.fetchone()["cnt"]

        cursor.execute(
            f"""
            SELECT ca.*, s.shop_id, s.name as shop_name, u.name as actor_name
            FROM case_actions ca
            JOIN cases c ON ca.case_id = c.case_id
            JOIN shops s ON c.shop_id = s.shop_id
            LEFT JOIN users u ON ca.actor_id = u.user_id
            WHERE {where_sql}
            ORDER BY ca.created_at DESC
            LIMIT ? OFFSET ?;
            """,
            params + [limit, offset],
        )
        rows = cursor.fetchall()

        items: List[ActionFeedItem] = []
        for r in rows:
            p_dict = {}
            if r["payload_json"]:
                try:
                    p_dict = json.loads(r["payload_json"])
                except Exception:
                    p_dict = {}

            items.append(
                ActionFeedItem(
                    id=r["id"],
                    case_id=r["case_id"],
                    shop_id=r["shop_id"],
                    shop_name=r["shop_name"],
                    actor_id=r["actor_id"],
                    actor_name=r["actor_name"],
                    actor_role=r["actor_role"],
                    type=r["type"],
                    payload=p_dict,
                    risk_score_at_action=float(r["risk_score_at_action"])
                    if r["risk_score_at_action"] is not None
                    else None,
                    created_at=r["created_at"],
                )
            )

        return ActionFeedResponse(total=total, items=items)
    finally:
        conn.close()
