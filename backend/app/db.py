"""Database utilities, schema initialization, and migrations for SQLite."""

import json
import sqlite3
from pathlib import Path
from typing import Optional, Union

from app.config import get_db_path

SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"


def get_connection(db_path: Optional[Union[str, Path]] = None) -> sqlite3.Connection:
    """Returns a SQLite connection configured with Row factory and foreign keys."""
    target_path = Path(db_path) if db_path else get_db_path()
    if target_path != Path(":memory:"):
        target_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(target_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def migrate_feedback_to_case_actions(conn: sqlite3.Connection) -> int:
    """Migrates any existing rows in the legacy feedback table to case_actions, then drops it."""
    cursor = conn.cursor()
    cursor.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='feedback';")
    if cursor.fetchone()[0] == 0:
        return 0

    cursor.execute(
        "SELECT id, shop_id, week_start, outcome, note, created_at FROM feedback ORDER BY id;"
    )
    feedback_rows = cursor.fetchall()
    if not feedback_rows:
        conn.execute("DROP TABLE IF EXISTS feedback;")
        conn.commit()
        return 0

    migrated_count = 0
    for row in feedback_rows:
        s_id = row["shop_id"]
        w_start = row["week_start"]
        outcome = row["outcome"]
        note = row["note"]
        c_at = row["created_at"]

        s_row = conn.execute(
            "SELECT district, taluka, inspector_id FROM shops WHERE shop_id = ?;", (s_id,)
        ).fetchone()
        insp_id = s_row["inspector_id"] if s_row else None

        score_row = conn.execute(
            "SELECT risk_score, band FROM scores WHERE shop_id = ? AND week_start = ?;",
            (s_id, w_start),
        ).fetchone()
        score = float(score_row["risk_score"]) if score_row else 50.0
        band = score_row["band"] if score_row else "medium"

        existing_case = conn.execute(
            "SELECT case_id FROM cases WHERE shop_id = ?;", (s_id,)
        ).fetchone()
        if existing_case:
            case_id = existing_case["case_id"]
        else:
            case_id = f"case-{s_id}"
            conn.execute(
                """
                INSERT INTO cases (
                    case_id, shop_id, status, assignee_id, risk_score_latest, band_latest,
                    opened_week, last_flagged_week, closed_at, last_action_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    case_id, s_id, "inspected", insp_id, score, band,
                    w_start, w_start, None, c_at, c_at,
                ),
            )

        payload = json.dumps({
            "outcome": outcome,
            "checklist_results": [],
            "action_taken": "no_action",
            "note": note,
        })
        conn.execute(
            """
            INSERT INTO case_actions (
                case_id, actor_id, actor_role, type, payload_json, risk_score_at_action, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?);
            """,
            (case_id, insp_id, "inspector", "record_outcome", payload, score, c_at),
        )
        migrated_count += 1

    conn.execute("DROP TABLE feedback;")
    conn.commit()
    return migrated_count


def init_db(db_path: Optional[Union[str, Path]] = None) -> None:
    """Initializes the database using schema.sql and migrates existing tables."""
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    conn = get_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='shops';")
        if cursor.fetchone()[0] > 0:
            cursor.execute("PRAGMA table_info(shops);")
            columns = [row["name"] for row in cursor.fetchall()]
            if "inspector_id" not in columns:
                conn.execute(
                    "ALTER TABLE shops ADD COLUMN inspector_id TEXT REFERENCES users(user_id);"
                )
                conn.commit()

        # Check if legacy feedback table exists
        cursor.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='feedback';")
        if cursor.fetchone()[0] > 0:
            conn.execute("""
            CREATE TABLE IF NOT EXISTS cases (
                case_id TEXT PRIMARY KEY,
                shop_id TEXT NOT NULL,
                status TEXT NOT NULL,
                assignee_id TEXT,
                risk_score_latest REAL NOT NULL,
                band_latest TEXT NOT NULL,
                opened_week TEXT NOT NULL,
                last_flagged_week TEXT NOT NULL,
                closed_at TEXT,
                last_action_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """)
            conn.execute("""
            CREATE TABLE IF NOT EXISTS case_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id TEXT NOT NULL,
                actor_id TEXT,
                actor_role TEXT NOT NULL,
                type TEXT NOT NULL,
                payload_json TEXT NOT NULL DEFAULT '{}',
                risk_score_at_action REAL NOT NULL,
                created_at TEXT NOT NULL
            );
            """)
            conn.commit()
            migrate_feedback_to_case_actions(conn)

        conn.executescript(schema_sql)
        conn.commit()
    finally:
        conn.close()
