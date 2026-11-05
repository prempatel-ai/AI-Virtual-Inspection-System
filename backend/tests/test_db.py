"""Tests for database initialization, schema, append-only triggers, and migration."""

import sqlite3

import pytest

from app.db import get_connection, init_db, migrate_feedback_to_case_actions


def test_init_db_in_memory():
    conn = get_connection(":memory:")
    init_db(":memory:")
    with open("backend/app/schema.sql", "r", encoding="utf-8") as f:
        conn.executescript(f.read())

    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = {row[0] for row in cursor.fetchall()}

    expected_tables = {
        "users",
        "shops",
        "shop_weeks",
        "complaints",
        "ground_truth",
        "runs",
        "scores",
        "explanations",
        "cases",
        "case_actions",
        "audit_log",
    }
    assert expected_tables.issubset(tables)

    cursor.execute("PRAGMA table_info(shops);")
    columns = {row["name"] for row in cursor.fetchall()}
    assert "inspector_id" in columns

    conn.close()


def test_audit_log_triggers_append_only():
    conn = get_connection(":memory:")
    with open("backend/app/schema.sql", "r", encoding="utf-8") as f:
        conn.executescript(f.read())

    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO audit_log (event, ip, detail_json, created_at) VALUES (?, ?, ?, ?)",
        ("login_success", "127.0.0.1", "{}", "2026-11-05T12:00:00Z"),
    )
    conn.commit()

    log_id = cursor.lastrowid
    assert log_id is not None

    with pytest.raises(sqlite3.DatabaseError, match="append-only: UPDATE blocked"):
        cursor.execute("UPDATE audit_log SET event = ? WHERE id = ?", ("login_failed", log_id))

    with pytest.raises(sqlite3.DatabaseError, match="append-only: DELETE blocked"):
        cursor.execute("DELETE FROM audit_log WHERE id = ?", (log_id,))

    conn.close()


def test_case_actions_triggers_append_only():
    conn = get_connection(":memory:")
    with open("backend/app/schema.sql", "r", encoding="utf-8") as f:
        conn.executescript(f.read())

    cursor = conn.cursor()
    # Insert shop and case first to satisfy foreign keys
    cursor.execute(
        """
        INSERT INTO shops (
            shop_id, name, district, taluka, cards_count, vulnerability_index
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        ("FPS-01", "Shop 1", "Ahmedabad", "Taluka 1", 300, 0.2),
    )
    cursor.execute(
        """
        INSERT INTO cases (
            case_id, shop_id, status, risk_score_latest, band_latest, opened_week,
            last_flagged_week, last_action_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "case-01", "FPS-01", "assigned", 65.0, "high",
            "2026-11-02", "2026-11-02", "2026-11-02T10:00:00Z", "2026-11-02T10:00:00Z",
        ),
    )
    cursor.execute(
        """
        INSERT INTO case_actions (case_id, actor_role, type, risk_score_at_action, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        ("case-01", "system", "create", 65.0, "2026-11-02T10:00:00Z"),
    )
    conn.commit()

    action_id = cursor.lastrowid
    assert action_id is not None

    with pytest.raises(sqlite3.DatabaseError, match="append-only: UPDATE blocked"):
        cursor.execute("UPDATE case_actions SET type = ? WHERE id = ?", ("note", action_id))

    with pytest.raises(sqlite3.DatabaseError, match="append-only: DELETE blocked"):
        cursor.execute("DELETE FROM case_actions WHERE id = ?", (action_id,))

    conn.close()


def test_migrate_feedback_to_case_actions():
    conn = get_connection(":memory:")
    with open("backend/app/schema.sql", "r", encoding="utf-8") as f:
        conn.executescript(f.read())

    # Create dummy shop
    conn.execute(
        """
        INSERT INTO shops (
            shop_id, name, district, taluka, cards_count, vulnerability_index
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        ("FPS-99", "Test Shop", "Surat", "Surat Taluka 1", 200, 0.1),
    )
    # Drop view to simulate legacy table
    conn.execute("DROP VIEW IF EXISTS feedback;")
    # Create legacy feedback table and row
    conn.execute(
        """
        CREATE TABLE feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_id TEXT NOT NULL,
            week_start TEXT NOT NULL,
            outcome TEXT NOT NULL,
            note TEXT,
            created_at TEXT NOT NULL
        );
        """
    )
    conn.execute(
        """
        INSERT INTO feedback (shop_id, week_start, outcome, note, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        ("FPS-99", "2026-11-02", "confirmed", "Test note", "2026-11-02T14:00:00Z"),
    )
    conn.commit()

    migrated = migrate_feedback_to_case_actions(conn)
    assert migrated == 1

    # feedback table should no longer exist
    cursor = conn.cursor()
    cursor.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='feedback';")
    assert cursor.fetchone()[0] == 0

    # Case should exist
    cursor.execute("SELECT * FROM cases WHERE shop_id = 'FPS-99';")
    c_row = cursor.fetchone()
    assert c_row is not None
    assert c_row["status"] == "inspected"

    # Action should exist
    cursor.execute("SELECT * FROM case_actions WHERE case_id = ?;", (c_row["case_id"],))
    a_row = cursor.fetchone()
    assert a_row is not None
    assert a_row["type"] == "record_outcome"
    assert "confirmed" in a_row["payload_json"]

    conn.close()
