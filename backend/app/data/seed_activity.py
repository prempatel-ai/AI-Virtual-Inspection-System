"""Seeds synthetic historical activity, cases, and officer actions for demo and evaluation."""

import argparse
import json
import logging
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Set, Tuple, Union

from app.config import get_db_path
from app.data.seed_users import seed_users
from app.db import get_connection, init_db
from app.pipeline.run import run_pipeline_for_week

logger = logging.getLogger(__name__)


def seed_activity(
    db_path: Optional[Union[str, Path]] = None,
    seed: int = 42,
) -> Dict[str, Any]:
    """
    Simulates officer activity for the 4 weeks prior to target week,
    plus target week scoring:
    - Runs pipeline on historical weeks to create runs, scores, and cases
    - Simulates realistic field behavior:
        - Most cases acted on within a few days
        - Some left overdue (assigned to slow inspectors)
        - Some escalated to Mamlatdar
        - Outcomes recorded (P(confirmed) ~0.80 for planted positives, ~0.15 otherwise)
        - Resolved cases closed by supervisors
    - Target-week cases remain mostly new/assigned for live interactive walkthrough
    - Ground truth is strictly isolated within this generator function
    """
    target_path = Path(db_path) if db_path else get_db_path()
    init_db(target_path)

    # 1. Ensure users exist
    conn = get_connection(target_path)
    user_count = conn.execute("SELECT count(*) FROM users;").fetchone()[0]
    conn.close()
    if user_count == 0:
        seed_users(target_path)

    conn = get_connection(target_path)
    rng = random.Random(seed)

    # 2. Get available weeks in chronological order
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT week_start FROM shop_weeks ORDER BY week_start ASC;")
    all_weeks = [row["week_start"] for row in cursor.fetchall()]

    if not all_weeks:
        conn.close()
        raise ValueError("No weekly records in database. Run 'make data' first.")

    target_week = all_weeks[-1]
    if len(all_weeks) >= 5:
        historical_weeks = all_weeks[-5:-1]
    else:
        historical_weeks = all_weeks[:-1]

    # 3. Load ground truth lookup (ISOLATED INSIDE GENERATOR)
    cursor.execute("SELECT shop_id, is_positive FROM ground_truth;")
    ground_truth_map: Dict[str, int] = {
        row["shop_id"]: int(row["is_positive"]) for row in cursor.fetchall()
    }

    # 4. Load users and officers by jurisdiction
    cursor.execute("SELECT user_id, name, role, district, taluka FROM users WHERE is_active = 1;")
    users_list = cursor.fetchall()

    inspectors = [u for u in users_list if u["role"] == "inspector"]
    mamlatdars_by_area: Dict[Tuple[str, str], Dict[str, Any]] = {}
    district_officers_by_district: Dict[str, Dict[str, Any]] = {}

    for u in users_list:
        if u["role"] == "mamlatdar" and u["district"] and u["taluka"]:
            mamlatdars_by_area[(u["district"], u["taluka"])] = dict(u)
        elif u["role"] == "district_officer" and u["district"]:
            district_officers_by_district[u["district"]] = dict(u)

    # Select ~15% slow inspectors who frequently leave cases overdue
    slow_inspector_count = max(1, int(len(inspectors) * 0.15)) if inspectors else 0
    slow_inspectors: Set[str] = set()
    if inspectors:
        slow_sample = rng.sample(inspectors, slow_inspector_count)
        slow_inspectors = {s["user_id"] for s in slow_sample}

    conn.close()

    total_actions_created = 0

    # 5. Process historical weeks sequentially
    for h_week in historical_weeks:
        logger.info(f"Running pipeline for historical week {h_week}...")
        run_pipeline_for_week(week_start=h_week, top_k=25, db_path=target_path)

        conn = get_connection(target_path)
        cursor = conn.cursor()

        # Find open cases created in or before this week
        cursor.execute(
            """
            SELECT c.case_id, c.shop_id, c.status, c.assignee_id, c.risk_score_latest,
                   c.opened_week, s.district, s.taluka, s.name as shop_name,
                   u.name as assignee_name, u.role as assignee_role
            FROM cases c
            JOIN shops s ON c.shop_id = s.shop_id
            LEFT JOIN users u ON c.assignee_id = u.user_id
            WHERE c.status NOT IN ('closed')
              AND c.opened_week <= ?;
            """,
            (h_week,),
        )
        open_cases = cursor.fetchall()

        for c in open_cases:
            case_id = c["case_id"]
            shop_id = c["shop_id"]
            c_status = c["status"]
            assignee_id = c["assignee_id"]
            district = c["district"]
            taluka = c["taluka"]
            risk_score = float(c["risk_score_latest"])
            is_slow = assignee_id in slow_inspectors

            base_dt = datetime.strptime(h_week, "%Y-%m-%d").replace(tzinfo=timezone.utc)

            # SLOW INSPECTOR LOGIC: 60% chance to leave untouched (overdue)
            if is_slow and rng.random() < 0.60:
                continue

            # ACTION 1: start_inspection (if still new or assigned)
            if c_status in ("new", "assigned"):
                start_days = rng.randint(1, 3)
                start_dt = base_dt + timedelta(days=start_days, hours=rng.randint(9, 16))
                start_time_str = start_dt.isoformat()

                cursor.execute(
                    """
                    INSERT INTO case_actions (
                        case_id, actor_id, actor_role, type, payload_json,
                        risk_score_at_action, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        case_id,
                        assignee_id,
                        "inspector",
                        "start_inspection",
                        json.dumps({}),
                        risk_score,
                        start_time_str,
                    ),
                )
                cursor.execute(
                    """
                    UPDATE cases
                    SET status = 'in_progress', last_action_at = ?
                    WHERE case_id = ?;
                    """,
                    (start_time_str, case_id),
                )
                c_status = "in_progress"
                total_actions_created += 1

            # ACTION 2: outcome or escalation (if in_progress)
            if c_status == "in_progress":
                action_days = rng.randint(2, 4)
                act_dt = base_dt + timedelta(days=action_days, hours=rng.randint(10, 17))
                act_time_str = act_dt.isoformat()

                # 15% probability of escalation
                if rng.random() < 0.15:
                    mamlatdar = mamlatdars_by_area.get((district, taluka))
                    escalate_to = mamlatdar["user_id"] if mamlatdar else None

                    escalate_payload = {
                        "reason": (
                            "Persistent electronic stock mismatch and failure "
                            "to produce register upon inspection."
                        ),
                        "escalated_to": escalate_to,
                    }
                    cursor.execute(
                        """
                        INSERT INTO case_actions (
                            case_id, actor_id, actor_role, type, payload_json,
                            risk_score_at_action, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?);
                        """,
                        (
                            case_id,
                            assignee_id,
                            "inspector",
                            "escalate",
                            json.dumps(escalate_payload),
                            risk_score,
                            act_time_str,
                        ),
                    )
                    cursor.execute(
                        """
                        UPDATE cases
                        SET status = 'escalated', assignee_id = ?, last_action_at = ?
                        WHERE case_id = ?;
                        """,
                        (escalate_to or assignee_id, act_time_str, case_id),
                    )
                    c_status = "escalated"
                    total_actions_created += 1
                else:
                    # Record outcome
                    is_pos = ground_truth_map.get(shop_id, 0)
                    if is_pos == 1:
                        confirmed = rng.random() < 0.82
                    else:
                        confirmed = rng.random() < 0.14

                    if confirmed:
                        outcome_str = "confirmed"
                        action_taken = rng.choice([
                            "warning_issued",
                            "stock_verification_ordered",
                            "referred_to_higher_authority",
                        ])
                        note = "Physical audit verified discrepancy matching flagged anomalies."
                    else:
                        outcome_str = "not_confirmed"
                        action_taken = "no_action"
                        note = "Physical audit verified records within acceptable tolerance."

                    outcome_payload = {
                        "outcome": outcome_str,
                        "action_taken": action_taken,
                        "checklist_results": [
                            {
                                "item_action": "Physical stock count",
                                "result": "issue" if confirmed else "ok",
                            },
                            {
                                "item_action": "ePoS calibration seal",
                                "result": "ok",
                            },
                            {
                                "item_action": "Beneficiary slips sample check",
                                "result": "issue" if confirmed else "ok",
                            },
                        ],
                        "note": note,
                    }
                    cursor.execute(
                        """
                        INSERT INTO case_actions (
                            case_id, actor_id, actor_role, type, payload_json,
                            risk_score_at_action, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?);
                        """,
                        (
                            case_id,
                            assignee_id,
                            "inspector",
                            "record_outcome",
                            json.dumps(outcome_payload),
                            risk_score,
                            act_time_str,
                        ),
                    )
                    cursor.execute(
                        """
                        UPDATE cases
                        SET status = 'inspected', last_action_at = ?
                        WHERE case_id = ?;
                        """,
                        (act_time_str, case_id),
                    )
                    c_status = "inspected"
                    total_actions_created += 1

            # ACTION 3: Close case (if inspected and 65% chance)
            if c_status == "inspected" and rng.random() < 0.65:
                close_dt = base_dt + timedelta(days=rng.randint(5, 7), hours=rng.randint(11, 16))
                close_time_str = close_dt.isoformat()

                mamlatdar = mamlatdars_by_area.get((district, taluka))
                closer_id = mamlatdar["user_id"] if mamlatdar else assignee_id
                closer_role = "mamlatdar" if mamlatdar else "inspector"

                close_payload = {
                    "note": "Inspection findings reviewed and enforcement actions filed.",
                }
                cursor.execute(
                    """
                    INSERT INTO case_actions (
                        case_id, actor_id, actor_role, type, payload_json,
                        risk_score_at_action, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?);
                    """,
                    (
                        case_id,
                        closer_id,
                        closer_role,
                        "close",
                        json.dumps(close_payload),
                        risk_score,
                        close_time_str,
                    ),
                )
                cursor.execute(
                    """
                    UPDATE cases
                    SET status = 'closed', closed_at = ?, last_action_at = ?
                    WHERE case_id = ?;
                    """,
                    (close_time_str, close_time_str, case_id),
                )
                total_actions_created += 1

        conn.commit()
        conn.close()

    # 6. Score the target week (demo week)
    logger.info(f"Running pipeline for target demo week {target_week}...")
    run_pipeline_for_week(week_start=target_week, top_k=25, db_path=target_path)

    # In target week, simulate only 1 or 2 in-progress actions so cases remain fresh
    conn = get_connection(target_path)
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT case_id, assignee_id, risk_score_latest
        FROM cases
        WHERE opened_week = ? AND status = 'assigned'
        LIMIT 2;
        """,
        (target_week,),
    )
    demo_samples = cursor.fetchall()
    target_dt = datetime.strptime(target_week, "%Y-%m-%d").replace(tzinfo=timezone.utc)

    for ds in demo_samples:
        s_time = (target_dt + timedelta(hours=rng.randint(6, 12))).isoformat()
        cursor.execute(
            """
            INSERT INTO case_actions (
                case_id, actor_id, actor_role, type, payload_json,
                risk_score_at_action, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?);
            """,
            (
                ds["case_id"],
                ds["assignee_id"],
                "inspector",
                "start_inspection",
                json.dumps({}),
                float(ds["risk_score_latest"]),
                s_time,
            ),
        )
        cursor.execute(
            "UPDATE cases SET status = 'in_progress', last_action_at = ? WHERE case_id = ?;",
            (s_time, ds["case_id"]),
        )
        total_actions_created += 1

    conn.commit()
    conn.close()

    return {
        "status": "success",
        "historical_weeks": historical_weeks,
        "target_week": target_week,
        "actions_created": total_actions_created,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Simulate synthetic historical officer activity"
    )
    parser.add_argument("--db-path", type=str, default=None, help="Path to SQLite database")
    parser.add_argument(
        "--seed", type=int, default=42, help="Random seed for deterministic simulation"
    )
    args = parser.parse_args()

    res = seed_activity(db_path=args.db_path, seed=args.seed)
    print("Seed activity completed successfully:")
    print(f"  Historical weeks processed: {res['historical_weeks']}")
    print(f"  Target week scored: {res['target_week']}")
    print(f"  Total case actions simulated: {res['actions_created']}")


if __name__ == "__main__":
    main()
