"""Database utilities and initialization for SQLite."""

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

        conn.executescript(schema_sql)
        conn.commit()
    finally:
        conn.close()
