"""Service logic for case creation, auto-assignment, updates, and synchronization inside run."""

import json
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def sync_cases_for_scored_shops(
    conn: sqlite3.Connection,
    scored_rows: List[Dict[str, Any]],
    target_week: str,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, int]:
    """
    Synchronizes cases per docs/V2_SPEC.md Section 3:
    1. Shop flagged & no open case: create case, assign to inspector (fallback to Mamlatdar).
    2. Shop flagged & open case exists: update risk_score_latest, band_latest, last_flagged_week.
    3. Open case no longer flagged: keep open, update score/band, keep last_flagged_week.
    4. Closed case whose shop is flagged again: creates a new case.
    """
    cfg = config or {}
    cases_cfg = cfg.get("cases", {})
    flag_min_band = cases_cfg.get("flag_min_band", "medium")
    flagged_bands = {"high", "medium"} if flag_min_band == "medium" else {"high"}

    now_str = datetime.now(timezone.utc).isoformat()
    cases_created = 0
    cases_updated = 0

    cursor = conn.cursor()

    for item in scored_rows:
        shop_id = item["shop_id"]
        risk_score = float(item["risk_score"])
        band = str(item["band"])
        is_flagged = band in flagged_bands

        # Query existing open case (status != 'closed' and closed_at IS NULL)
        cursor.execute(
            """
            SELECT case_id, status, assignee_id, opened_week, last_flagged_week
            FROM cases
            WHERE shop_id = ? AND status != 'closed' AND closed_at IS NULL
            ORDER BY created_at DESC LIMIT 1;
            """,
            (shop_id,),
        )
        open_case = cursor.fetchone()

        if is_flagged:
            if not open_case:
                # Rule 1 & 4: Create new case
                case_id = f"case-{shop_id}-{target_week.replace('-', '')}"

                # Ensure unique case_id if collision occurs
                cursor.execute("SELECT 1 FROM cases WHERE case_id = ?;", (case_id,))
                if cursor.fetchone():
                    case_id = f"case-{shop_id}-{int(datetime.now(timezone.utc).timestamp())}"

                # Determine initial assignee
                cursor.execute(
                    "SELECT district, taluka, inspector_id FROM shops WHERE shop_id = ?;",
                    (shop_id,),
                )
                shop_meta = cursor.fetchone()
                inspector_id = shop_meta["inspector_id"] if shop_meta else None
                district = shop_meta["district"] if shop_meta else ""
                taluka = shop_meta["taluka"] if shop_meta else ""

                assignee_id = None
                status_val = "new"

                if inspector_id:
                    cursor.execute(
                        "SELECT is_active FROM users WHERE user_id = ?;", (inspector_id,)
                    )
                    u_row = cursor.fetchone()
                    if u_row and u_row["is_active"] == 1:
                        assignee_id = inspector_id
                        status_val = "assigned"

                if not assignee_id:
                    # Inactive or missing inspector -> fallback to taluka Mamlatdar
                    cursor.execute(
                        """
                        SELECT user_id FROM users
                        WHERE role = 'mamlatdar' AND district = ? AND taluka = ? AND is_active = 1
                        LIMIT 1;
                        """,
                        (district, taluka),
                    )
                    mam_row = cursor.fetchone()
                    if mam_row:
                        assignee_id = mam_row["user_id"]
                        status_val = "assigned"
                    else:
                        assignee_id = None
                        status_val = "new"

                # Insert case
                cursor.execute(
                    """
                    INSERT INTO cases (
                        case_id, shop_id, status, assignee_id, risk_score_latest, band_latest,
                        opened_week, last_flagged_week, closed_at, last_action_at, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?);
                    """,
                    (
                        case_id,
                        shop_id,
                        status_val,
                        assignee_id,
                        risk_score,
                        band,
                        target_week,
                        target_week,
                        now_str,
                        now_str,
                    ),
                )

                # Record append-only system actions
                cursor.execute(
                    """
                    INSERT INTO case_actions (
                        case_id, actor_id, actor_role, type, payload_json,
                        risk_score_at_action, created_at
                    ) VALUES (?, NULL, 'system', 'create', '{}', ?, ?);
                    """,
                    (case_id, risk_score, now_str),
                )

                if assignee_id:
                    payload = json.dumps({"to_user_id": assignee_id, "reason": "auto_assigned"})
                    cursor.execute(
                        """
                        INSERT INTO case_actions (
                            case_id, actor_id, actor_role, type, payload_json,
                            risk_score_at_action, created_at
                        ) VALUES (?, NULL, 'system', 'assign', ?, ?, ?);
                        """,
                        (case_id, payload, risk_score, now_str),
                    )

                cases_created += 1
            else:
                # Rule 2: Open case exists and shop is flagged -> update latest numbers
                case_id = open_case["case_id"]
                cursor.execute(
                    """
                    UPDATE cases
                    SET risk_score_latest = ?, band_latest = ?, last_flagged_week = ?
                    WHERE case_id = ?;
                    """,
                    (risk_score, band, target_week, case_id),
                )
                cases_updated += 1
        else:
            # Rule 3: Shop not flagged, but open case exists -> update score, keep last_flagged_week
            if open_case:
                case_id = open_case["case_id"]
                cursor.execute(
                    """
                    UPDATE cases
                    SET risk_score_latest = ?, band_latest = ?
                    WHERE case_id = ?;
                    """,
                    (risk_score, band, case_id),
                )
                cases_updated += 1

    conn.commit()
    return {"cases_created": cases_created, "cases_updated": cases_updated}
