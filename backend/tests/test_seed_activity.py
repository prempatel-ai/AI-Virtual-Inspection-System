"""Tests for the seed-activity simulator."""

from pathlib import Path

from app.data.generator import generate_pds_data
from app.data.seed_activity import seed_activity
from app.data.seed_users import seed_users
from app.db import get_connection


def test_seed_activity_execution(tmp_path: Path):
    """Verifies that seed_activity populates historical cases and officer actions."""
    db_file = tmp_path / "test_act.db"
    generate_pds_data(num_shops=100, num_weeks=10, seed=42, db_path=db_file)
    seed_users(db_path=db_file)

    res = seed_activity(db_path=db_file, seed=42)
    assert res["status"] == "success"
    assert len(res["historical_weeks"]) > 0
    assert res["actions_created"] > 0

    conn = get_connection(db_file)
    cursor = conn.cursor()

    # Verify cases exist across multiple statuses
    cursor.execute("SELECT DISTINCT status FROM cases;")
    statuses = {row[0] for row in cursor.fetchall()}
    assert len(statuses) >= 2, f"Expected diverse case statuses, got {statuses}"

    # Verify actions exist with various types
    cursor.execute("SELECT DISTINCT type FROM case_actions;")
    action_types = {row[0] for row in cursor.fetchall()}
    assert "start_inspection" in action_types
    assert "record_outcome" in action_types

    # Verify confirmed outcomes vs unconfirmed
    cursor.execute("SELECT payload_json FROM case_actions WHERE type = 'record_outcome';")
    outcomes = [r[0] for r in cursor.fetchall()]
    assert any("confirmed" in o for o in outcomes)

    conn.close()
