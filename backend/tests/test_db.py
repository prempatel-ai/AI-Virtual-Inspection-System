"""Tests for database initialization and schema."""

from app.db import get_connection, init_db


def test_init_db_in_memory():
    conn = get_connection(":memory:")
    init_db(":memory:")
    # Check tables in a temporary file/memory
    # For in-memory, connection must be kept open, so execute schema directly on conn
    with open("backend/app/schema.sql", "r", encoding="utf-8") as f:
        conn.executescript(f.read())

    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = {row[0] for row in cursor.fetchall()}

    expected_tables = {
        "shops",
        "shop_weeks",
        "complaints",
        "ground_truth",
        "runs",
        "scores",
        "explanations",
        "feedback",
    }
    assert expected_tables.issubset(tables)
    conn.close()
