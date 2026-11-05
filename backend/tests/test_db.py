"""Tests for database initialization and schema."""

import sqlite3

import pytest

from app.db import get_connection, init_db


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
        "feedback",
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
