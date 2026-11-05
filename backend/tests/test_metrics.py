"""Golden tests for central metrics computation engine."""

from datetime import datetime, timezone

import pytest

from app.db import get_connection
from app.metrics import (
    compute_area_metrics,
    compute_confirmed_rate,
    compute_officer_stats,
    is_overdue_check,
)


@pytest.fixture
def metrics_db():
    conn = get_connection(":memory:")
    with open("backend/app/schema.sql", "r", encoding="utf-8") as f:
        conn.executescript(f.read())

    # Insert test users
    conn.execute(
        """
        INSERT INTO users (
            user_id, name, email, password_hash, role, district, taluka, is_active, created_at
        ) VALUES
            ('insp-1', 'Inspector One', 'insp1@test.invalid', 'h', 'inspector',
             'Ahmedabad', 'City', 1, '2026-01-01T00:00:00Z'),
            ('insp-2', 'Inspector Two', 'insp2@test.invalid', 'h', 'inspector',
             'Ahmedabad', 'Rural', 1, '2026-01-01T00:00:00Z'),
            ('insp-3', 'Inspector Three', 'insp3@test.invalid', 'h', 'inspector',
             'Surat', 'East', 1, '2026-01-01T00:00:00Z');
        """
    )

    # Insert test shops
    conn.execute(
        """
        INSERT INTO shops (
            shop_id, name, district, taluka, cards_count, vulnerability_index, inspector_id
        ) VALUES
            ('S-01', 'Shop 1', 'Ahmedabad', 'City', 500, 0.4, 'insp-1'),
            ('S-02', 'Shop 2', 'Ahmedabad', 'City', 600, 0.5, 'insp-1'),
            ('S-03', 'Shop 3', 'Ahmedabad', 'Rural', 400, 0.3, 'insp-2'),
            ('S-04', 'Shop 4', 'Surat', 'East', 300, 0.2, 'insp-3');
        """
    )

    # Insert test run
    conn.execute(
        """
        INSERT INTO runs (run_id, week_start, started_at, duration_ms, shops_scored, explained)
        VALUES (1, '2026-11-02', '2026-11-02T10:00:00Z', 100, 4, 0);
        """
    )

    # Scores for week 2026-11-02
    conn.execute(
        """
        INSERT INTO scores (shop_id, week_start, risk_score, band, breakdown_json, run_id)
        VALUES
            ('S-01', '2026-11-02', 88.0, 'high', '[]', 1),
            ('S-02', '2026-11-02', 62.0, 'medium', '[]', 1),
            ('S-03', '2026-11-02', 30.0, 'low', '[]', 1),
            ('S-04', '2026-11-02', 85.0, 'high', '[]', 1);
        """
    )

    # Insert cases
    conn.execute(
        """
        INSERT INTO cases (
            case_id, shop_id, status, assignee_id, risk_score_latest, band_latest,
            opened_week, last_flagged_week, closed_at, last_action_at, created_at
        ) VALUES
            ('C-01', 'S-01', 'in_progress', 'insp-1', 88.0, 'high', '2026-11-02', '2026-11-02',
             NULL, '2026-11-03T10:00:00Z', '2026-11-02T10:00:00Z'),
            ('C-02', 'S-02', 'assigned', 'insp-1', 62.0, 'medium', '2026-11-02', '2026-11-02',
             NULL, '2026-10-25T10:00:00Z', '2026-10-25T10:00:00Z'),
            ('C-04', 'S-04', 'closed', 'insp-3', 85.0, 'high', '2026-11-02', '2026-11-02',
             '2026-11-04T12:00:00Z', '2026-11-04T12:00:00Z', '2026-11-02T10:00:00Z');
        """
    )

    # Case actions
    conn.execute(
        """
        INSERT INTO case_actions (
            case_id, actor_id, actor_role, type, payload_json, risk_score_at_action, created_at
        ) VALUES
            ('C-01', NULL, 'system', 'assign', '{"to_user_id": "insp-1"}',
             88.0, '2026-11-02T10:00:00Z'),
            ('C-01', 'insp-1', 'inspector', 'start_inspection', '{}',
             88.0, '2026-11-03T10:00:00Z'),
            ('C-04', NULL, 'system', 'assign', '{"to_user_id": "insp-3"}',
             85.0, '2026-11-02T10:00:00Z'),
            ('C-04', 'insp-3', 'inspector', 'record_outcome',
             '{"outcome": "confirmed", "action_taken": "warning_issued"}',
             85.0, '2026-11-03T22:00:00Z');
        """
    )

    conn.commit()
    yield conn
    conn.close()


def test_is_overdue_check():
    now = datetime(2026, 11, 5, 12, 0, tzinfo=timezone.utc)
    # Closed case is never overdue
    assert not is_overdue_check("closed", "2026-10-01T00:00:00Z", overdue_days=7, now=now)
    # Action 2 days ago is not overdue
    assert not is_overdue_check("assigned", "2026-11-03T12:00:00Z", overdue_days=7, now=now)
    # Action 10 days ago is overdue
    assert is_overdue_check("assigned", "2026-10-26T12:00:00Z", overdue_days=7, now=now)


def test_compute_confirmed_rate():
    assert compute_confirmed_rate(0, 0) is None
    assert compute_confirmed_rate(4, 5) == 0.8
    assert compute_confirmed_rate(1, 3) == 0.3333


def test_area_metrics_golden(metrics_db):
    now = datetime(2026, 11, 5, 12, 0, tzinfo=timezone.utc)

    # District level metrics
    district_metrics = compute_area_metrics(
        metrics_db, level="district", week="2026-11-02", now=now
    )
    assert len(district_metrics) == 2

    ahm = next(d for d in district_metrics if d["name"] == "Ahmedabad")
    assert ahm["shops_count"] == 3
    assert ahm["flagged_count"] == 2  # S-01 (high), S-02 (medium)
    assert ahm["flag_rate"] == 0.6667
    assert ahm["high_band_count"] == 1
    assert ahm["open_cases"] == 2  # C-01, C-02
    assert ahm["overdue_cases"] == 1  # C-02 is 10 days old
    assert ahm["confirmed_rate"] is None  # no outcomes in Ahmedabad yet

    sur = next(d for d in district_metrics if d["name"] == "Surat")
    assert sur["shops_count"] == 1
    assert sur["flagged_count"] == 1
    assert sur["flag_rate"] == 1.0
    assert sur["high_band_count"] == 1
    assert sur["open_cases"] == 0  # C-04 is closed
    assert sur["overdue_cases"] == 0
    assert sur["confirmed_rate"] == 1.0  # 1 confirmed outcome

    # Taluka level metrics with parent filter
    taluka_metrics = compute_area_metrics(
        metrics_db, level="taluka", parent="Ahmedabad", week="2026-11-02", now=now
    )
    assert len(taluka_metrics) == 2
    city = next(t for t in taluka_metrics if t["name"] == "City")
    assert city["shops_count"] == 2
    assert city["flagged_count"] == 2
    assert city["flag_rate"] == 1.0
    assert city["open_cases"] == 2
    assert city["overdue_cases"] == 1

    rural = next(t for t in taluka_metrics if t["name"] == "Rural")
    assert rural["shops_count"] == 1
    assert rural["flagged_count"] == 0
    assert rural["flag_rate"] == 0.0


def test_officer_stats_golden(metrics_db):
    now = datetime(2026, 11, 5, 12, 0, tzinfo=timezone.utc)

    # Stats for insp-1 (2 assigned cases: 1 open, 1 overdue, 0 outcomes)
    stats1 = compute_officer_stats(metrics_db, "insp-1", overdue_days=7, now=now)
    assert stats1["assigned_cases"] == 2
    assert stats1["open_cases"] == 2
    assert stats1["overdue_cases"] == 1
    assert stats1["inspected_cases"] == 0
    assert stats1["closed_cases"] == 0
    assert stats1["confirmed_rate"] is None
    # 24 hours to first action on C-01
    assert stats1["median_time_to_first_action_hours"] == 24.0
    assert stats1["last_action_at"] == "2026-11-03T10:00:00Z"

    # Stats for insp-3 (1 closed case with confirmed outcome)
    stats3 = compute_officer_stats(metrics_db, "insp-3", overdue_days=7, now=now)
    assert stats3["assigned_cases"] == 1
    assert stats3["open_cases"] == 0
    assert stats3["overdue_cases"] == 0
    assert stats3["inspected_cases"] == 1
    assert stats3["closed_cases"] == 1
    assert stats3["confirmed_rate"] == 1.0
    # 36 hours to first action on C-04
    assert stats3["median_time_to_first_action_hours"] == 36.0
    assert stats3["last_action_at"] == "2026-11-03T22:00:00Z"

    # Stats for insp-2 (0 cases)
    stats2 = compute_officer_stats(metrics_db, "insp-2", overdue_days=7, now=now)
    assert stats2["assigned_cases"] == 0
    assert stats2["open_cases"] == 0
    assert stats2["overdue_cases"] == 0
    assert stats2["confirmed_rate"] is None
    assert stats2["median_time_to_first_action_hours"] is None
    assert stats2["last_action_at"] is None
