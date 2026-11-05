"""Tests for case lifecycle, synchronization, auto-assignment, and state transitions."""

import json

import pytest

from app.cases.service import sync_cases_for_scored_shops
from app.db import get_connection


@pytest.fixture
def memory_db():
    conn = get_connection(":memory:")
    with open("backend/app/schema.sql", "r", encoding="utf-8") as f:
        conn.executescript(f.read())

    # Insert test users
    conn.execute(
        """
        INSERT INTO users (
            user_id, email, password_hash, role, district, taluka, name, is_active, created_at
        ) VALUES
            ('insp-1', 'insp1@example.com', 'dummyhash', 'inspector', 'Ahmedabad', 'City',
             'Inspector One', 1, '2026-01-01T00:00:00Z'),
            ('insp-inactive', 'inspinactive@example.com', 'dummyhash', 'inspector', 'Ahmedabad',
             'Rural', 'Inspector Two', 0, '2026-01-01T00:00:00Z'),
            ('mam-1', 'mam1@example.com', 'dummyhash', 'mamlatdar', 'Ahmedabad', 'Rural',
             'Mamlatdar Rural', 1, '2026-01-01T00:00:00Z');
        """
    )

    # Insert test shops
    conn.execute(
        """
        INSERT INTO shops (
            shop_id, name, district, taluka, cards_count, vulnerability_index, inspector_id
        ) VALUES
            ('FPS-001', 'Shop 1', 'Ahmedabad', 'City', 500, 0.4, 'insp-1'),
            ('FPS-002', 'Shop 2', 'Ahmedabad', 'Rural', 400, 0.3, 'insp-inactive'),
            ('FPS-003', 'Shop 3', 'Surat', 'East', 600, 0.5, NULL);
        """
    )
    conn.commit()
    yield conn
    conn.close()


def test_case_creation_and_auto_assign(memory_db):
    scored_rows = [
        {"shop_id": "FPS-001", "risk_score": 85.5, "band": "high"},
    ]
    res = sync_cases_for_scored_shops(memory_db, scored_rows, "2026-11-02")
    assert res["cases_created"] == 1
    assert res["cases_updated"] == 0

    cursor = memory_db.cursor()
    cursor.execute("SELECT * FROM cases WHERE shop_id = 'FPS-001';")
    case = cursor.fetchone()
    assert case is not None
    assert case["status"] == "assigned"
    assert case["assignee_id"] == "insp-1"
    assert case["risk_score_latest"] == 85.5
    assert case["band_latest"] == "high"
    assert case["opened_week"] == "2026-11-02"
    assert case["last_flagged_week"] == "2026-11-02"

    # Verify append-only system actions
    cursor.execute(
        "SELECT * FROM case_actions WHERE case_id = ? ORDER BY id ASC;",
        (case["case_id"],),
    )
    actions = cursor.fetchall()
    assert len(actions) == 2
    assert actions[0]["type"] == "create"
    assert actions[0]["actor_role"] == "system"
    assert actions[1]["type"] == "assign"
    assert actions[1]["actor_role"] == "system"
    assign_payload = json.loads(actions[1]["payload_json"])
    assert assign_payload["to_user_id"] == "insp-1"


def test_inactive_inspector_fallback_to_mamlatdar(memory_db):
    scored_rows = [
        {"shop_id": "FPS-002", "risk_score": 65.0, "band": "medium"},
    ]
    res = sync_cases_for_scored_shops(memory_db, scored_rows, "2026-11-02")
    assert res["cases_created"] == 1

    cursor = memory_db.cursor()
    cursor.execute("SELECT * FROM cases WHERE shop_id = 'FPS-002';")
    case = cursor.fetchone()
    assert case is not None
    # Inactive inspector falls back to mamlatdar of that taluka
    assert case["assignee_id"] == "mam-1"
    assert case["status"] == "assigned"


def test_unassigned_when_no_mamlatdar(memory_db):
    scored_rows = [
        {"shop_id": "FPS-003", "risk_score": 90.0, "band": "high"},
    ]
    res = sync_cases_for_scored_shops(memory_db, scored_rows, "2026-11-02")
    assert res["cases_created"] == 1

    cursor = memory_db.cursor()
    cursor.execute("SELECT * FROM cases WHERE shop_id = 'FPS-003';")
    case = cursor.fetchone()
    assert case is not None
    assert case["assignee_id"] is None
    assert case["status"] == "new"


def test_reflagging_open_case_updates_score_without_duplicate(memory_db):
    scored_rows_w1 = [{"shop_id": "FPS-001", "risk_score": 75.0, "band": "medium"}]
    sync_cases_for_scored_shops(memory_db, scored_rows_w1, "2026-11-02")

    scored_rows_w2 = [{"shop_id": "FPS-001", "risk_score": 88.0, "band": "high"}]
    res2 = sync_cases_for_scored_shops(memory_db, scored_rows_w2, "2026-11-09")
    assert res2["cases_created"] == 0
    assert res2["cases_updated"] == 1

    cursor = memory_db.cursor()
    cursor.execute("SELECT COUNT(*) as cnt FROM cases WHERE shop_id = 'FPS-001';")
    assert cursor.fetchone()["cnt"] == 1

    cursor.execute("SELECT * FROM cases WHERE shop_id = 'FPS-001';")
    case = cursor.fetchone()
    assert case["risk_score_latest"] == 88.0
    assert case["band_latest"] == "high"
    assert case["opened_week"] == "2026-11-02"
    assert case["last_flagged_week"] == "2026-11-09"


def test_unflagged_week_updates_score_but_keeps_last_flagged_week(memory_db):
    scored_rows_w1 = [{"shop_id": "FPS-001", "risk_score": 75.0, "band": "medium"}]
    sync_cases_for_scored_shops(memory_db, scored_rows_w1, "2026-11-02")

    # Next week score drops to low band (not flagged)
    scored_rows_w2 = [{"shop_id": "FPS-001", "risk_score": 25.0, "band": "low"}]
    res2 = sync_cases_for_scored_shops(memory_db, scored_rows_w2, "2026-11-09")
    assert res2["cases_created"] == 0
    assert res2["cases_updated"] == 1

    cursor = memory_db.cursor()
    cursor.execute("SELECT * FROM cases WHERE shop_id = 'FPS-001';")
    case = cursor.fetchone()
    assert case["risk_score_latest"] == 25.0
    assert case["band_latest"] == "low"
    assert case["opened_week"] == "2026-11-02"
    assert case["last_flagged_week"] == "2026-11-02"  # Unchanged!


def test_closed_case_reflagged_opens_new_case(memory_db):
    scored_rows_w1 = [{"shop_id": "FPS-001", "risk_score": 75.0, "band": "medium"}]
    sync_cases_for_scored_shops(memory_db, scored_rows_w1, "2026-11-02")

    # Close the case
    memory_db.execute(
        """
        UPDATE cases
        SET status = 'closed', closed_at = '2026-11-05T00:00:00Z'
        WHERE shop_id = 'FPS-001';
        """
    )
    memory_db.commit()

    # Shop is flagged again in week 2
    scored_rows_w2 = [{"shop_id": "FPS-001", "risk_score": 82.0, "band": "high"}]
    res2 = sync_cases_for_scored_shops(memory_db, scored_rows_w2, "2026-11-09")
    assert res2["cases_created"] == 1

    cursor = memory_db.cursor()
    cursor.execute(
        """
        SELECT status, opened_week
        FROM cases
        WHERE shop_id = 'FPS-001'
        ORDER BY opened_week ASC;
        """
    )
    rows = cursor.fetchall()
    assert len(rows) == 2
    assert rows[0]["status"] == "closed"
    assert rows[0]["opened_week"] == "2026-11-02"
    assert rows[1]["status"] == "assigned"
    assert rows[1]["opened_week"] == "2026-11-09"
