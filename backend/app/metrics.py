"""Central metrics computation engine for areas, officers, and summary oversight."""

import json
import sqlite3
import statistics
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def parse_iso(ts_str: Optional[str]) -> Optional[datetime]:
    """Helper to parse ISO timestamp string into datetime."""
    if not ts_str:
        return None
    try:
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except Exception:
        return None


def is_overdue_check(
    c_status: str,
    last_action_at: Optional[str],
    overdue_days: int = 7,
    now: Optional[datetime] = None,
) -> bool:
    """Returns True if case is open and no action for more than overdue_days."""
    if c_status == "closed" or not last_action_at:
        return False
    dt = parse_iso(last_action_at)
    if not dt:
        return False
    current_time = now or datetime.now(timezone.utc)
    diff_days = (current_time - dt).total_seconds() / 86400.0
    return diff_days > overdue_days


def compute_confirmed_rate(confirmed_count: int, total_count: int) -> Optional[float]:
    """Returns confirmed / total rounded to 4 decimal places, or None if no outcomes."""
    if total_count == 0:
        return None
    return round(float(confirmed_count) / float(total_count), 4)


def compute_area_metrics(
    conn: sqlite3.Connection,
    level: str = "district",
    parent: Optional[str] = None,
    week: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
    now: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    Computes area-level metrics (flag rate, high-band rate, open/overdue cases, confirmed rate).
    level: 'district' or 'taluka'.
    parent: if level == 'taluka', parent specifies the district.
    """
    cfg = config or {}
    overdue_days = cfg.get("cases", {}).get("overdue_days", 7)
    target_week = week
    if not target_week:
        row = conn.execute("SELECT max(week_start) FROM shop_weeks;").fetchone()
        target_week = str(row[0]) if row and row[0] else "2026-11-02"

    group_col = "s.district" if level == "district" else "s.taluka"
    where_clauses = ["1=1"]
    params: List[Any] = []

    if level == "taluka" and parent:
        where_clauses.append("s.district = ?")
        params.append(parent)

    where_sql = " AND ".join(where_clauses)

    cursor = conn.cursor()

    # 1. Total shops per area
    cursor.execute(
        f"""
        SELECT {group_col} as area_name, COUNT(DISTINCT s.shop_id) as shops_count
        FROM shops s
        WHERE {where_sql}
        GROUP BY {group_col}
        ORDER BY {group_col} ASC;
        """,
        params,
    )
    area_rows = cursor.fetchall()
    areas_map = {
        r["area_name"]: {
            "name": r["area_name"],
            "level": level,
            "shops_count": int(r["shops_count"]),
            "flagged_count": 0,
            "flag_rate": 0.0,
            "high_band_count": 0,
            "open_cases": 0,
            "overdue_cases": 0,
            "confirmed_rate": None,
            "confirmed_outcomes": 0,
            "total_outcomes": 0,
        }
        for r in area_rows
        if r["area_name"]
    }

    # 2. Flagged shops for target_week
    flag_params = list(params) + [target_week]
    cursor.execute(
        f"""
        SELECT {group_col} as area_name, sc.band, COUNT(sc.shop_id) as cnt
        FROM scores sc
        JOIN shops s ON sc.shop_id = s.shop_id
        WHERE {where_sql} AND sc.week_start = ?
        GROUP BY {group_col}, sc.band;
        """,
        flag_params,
    )
    for r in cursor.fetchall():
        a_name = r["area_name"]
        if a_name in areas_map:
            band = r["band"]
            cnt = int(r["cnt"])
            if band in ("high", "medium"):
                areas_map[a_name]["flagged_count"] += cnt
            if band == "high":
                areas_map[a_name]["high_band_count"] += cnt

    # Compute flag rates
    for a_data in areas_map.values():
        s_count = a_data["shops_count"]
        f_count = a_data["flagged_count"]
        a_data["flag_rate"] = round(f_count / max(s_count, 1), 4)

    # 3. Open cases and overdue counts
    cursor.execute(
        f"""
        SELECT {group_col} as area_name, c.status, c.last_action_at, c.created_at
        FROM cases c
        JOIN shops s ON c.shop_id = s.shop_id
        WHERE {where_sql} AND c.status != 'closed' AND c.closed_at IS NULL;
        """,
        params,
    )
    for r in cursor.fetchall():
        a_name = r["area_name"]
        if a_name in areas_map:
            areas_map[a_name]["open_cases"] += 1
            last_act = r["last_action_at"] or r["created_at"]
            if is_overdue_check(r["status"], last_act, overdue_days, now):
                areas_map[a_name]["overdue_cases"] += 1

    # 4. Confirmed outcomes rate in this area
    cursor.execute(
        f"""
        SELECT {group_col} as area_name, ca.payload_json
        FROM case_actions ca
        JOIN cases c ON ca.case_id = c.case_id
        JOIN shops s ON c.shop_id = s.shop_id
        WHERE {where_sql} AND ca.type = 'record_outcome';
        """,
        params,
    )
    for r in cursor.fetchall():
        a_name = r["area_name"]
        if a_name in areas_map:
            try:
                payload = json.loads(r["payload_json"] or "{}")
                outcome = payload.get("outcome")
                if outcome:
                    areas_map[a_name]["total_outcomes"] += 1
                    if outcome == "confirmed":
                        areas_map[a_name]["confirmed_outcomes"] += 1
            except Exception:
                pass

    for a_data in areas_map.values():
        a_data["confirmed_rate"] = compute_confirmed_rate(
            a_data["confirmed_outcomes"], a_data["total_outcomes"]
        )
        del a_data["confirmed_outcomes"]
        del a_data["total_outcomes"]

    return list(areas_map.values())


def compute_officer_stats(
    conn: sqlite3.Connection,
    officer_id: str,
    overdue_days: int = 7,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Computes performance and activity statistics for a specific officer:
    - assigned_cases: cases assigned to officer
    - open_cases: open cases currently assigned to officer
    - overdue_cases: open cases overdue
    - inspected_cases: cases with outcome recorded by officer
    - closed_cases: closed cases assigned to officer
    - confirmed_rate: confirmed / total recorded outcomes
    - median_time_to_first_action_hours: median hours to first action
    - last_action_at: ISO timestamp of last action
    """
    cursor = conn.cursor()

    # Cases assigned to this officer
    cursor.execute(
        """
        SELECT case_id, status, last_action_at, created_at, opened_week
        FROM cases
        WHERE assignee_id = ?;
        """,
        (officer_id,),
    )
    cases = cursor.fetchall()

    assigned_cases = len(cases)
    open_cases = 0
    overdue_cases = 0
    closed_cases = 0

    for c in cases:
        c_st = c["status"]
        if c_st == "closed":
            closed_cases += 1
        else:
            open_cases += 1
            last_act = c["last_action_at"] or c["created_at"]
            if is_overdue_check(c_st, last_act, overdue_days, now):
                overdue_cases += 1

    # Actions taken by this officer
    cursor.execute(
        """
        SELECT id, case_id, type, payload_json, created_at
        FROM case_actions
        WHERE actor_id = ?
        ORDER BY created_at ASC;
        """,
        (officer_id,),
    )
    officer_actions = cursor.fetchall()

    last_action_at = None
    if officer_actions:
        last_action_at = officer_actions[-1]["created_at"]

    # Calculate confirmed rate and inspected cases
    inspected_case_ids = set()
    confirmed_outcomes = 0
    total_outcomes = 0

    for a in officer_actions:
        if a["type"] == "record_outcome":
            inspected_case_ids.add(a["case_id"])
            try:
                payload = json.loads(a["payload_json"] or "{}")
                outcome = payload.get("outcome")
                if outcome:
                    total_outcomes += 1
                    if outcome == "confirmed":
                        confirmed_outcomes += 1
            except Exception:
                pass

    confirmed_rate = compute_confirmed_rate(confirmed_outcomes, total_outcomes)

    # Calculate median time to first action in hours
    # Time from assignment to the officer's first action on that case
    case_ids = [c["case_id"] for c in cases]
    time_deltas_hours: List[float] = []

    for c_id in case_ids:
        # Find assignment timestamp for this officer
        cursor.execute(
            """
            SELECT created_at, payload_json
            FROM case_actions
            WHERE case_id = ? AND type = 'assign'
            ORDER BY created_at ASC;
            """,
            (c_id,),
        )
        assign_actions = cursor.fetchall()
        assign_dt: Optional[datetime] = None

        for aa in assign_actions:
            try:
                p = json.loads(aa["payload_json"] or "{}")
                if p.get("to_user_id") == officer_id:
                    assign_dt = parse_iso(aa["created_at"])
                    break
            except Exception:
                pass

        if not assign_dt:
            # Fallback to case creation timestamp
            cursor.execute("SELECT created_at FROM cases WHERE case_id = ?;", (c_id,))
            c_row = cursor.fetchone()
            if c_row:
                assign_dt = parse_iso(c_row["created_at"])

        if assign_dt:
            # Find officer's first subsequent action on this case
            cursor.execute(
                """
                SELECT created_at FROM case_actions
                WHERE case_id = ? AND actor_id = ? AND type NOT IN ('assign', 'create')
                ORDER BY created_at ASC LIMIT 1;
                """,
                (c_id, officer_id),
            )
            first_act = cursor.fetchone()
            if first_act:
                act_dt = parse_iso(first_act["created_at"])
                if act_dt and act_dt >= assign_dt:
                    diff_hrs = (act_dt - assign_dt).total_seconds() / 3600.0
                    time_deltas_hours.append(round(diff_hrs, 2))

    median_time_to_first_action: Optional[float] = None
    if time_deltas_hours:
        median_time_to_first_action = round(statistics.median(time_deltas_hours), 1)

    return {
        "assigned_cases": assigned_cases,
        "open_cases": open_cases,
        "overdue_cases": overdue_cases,
        "inspected_cases": len(inspected_case_ids),
        "closed_cases": closed_cases,
        "confirmed_rate": confirmed_rate,
        "median_time_to_first_action_hours": median_time_to_first_action,
        "last_action_at": last_action_at,
    }
