"""Tests for synthetic data generator."""

import sqlite3
import tempfile
from pathlib import Path

from app.data.generator import generate_pds_data
from app.data.scenarios import SCENARIOS


def test_determinism():
    with tempfile.TemporaryDirectory() as tmpdir:
        db1 = Path(tmpdir) / "pds1.db"
        db2 = Path(tmpdir) / "pds2.db"

        s1 = generate_pds_data(num_shops=100, num_weeks=6, seed=42, db_path=db1)
        s2 = generate_pds_data(num_shops=100, num_weeks=6, seed=42, db_path=db2)

        assert s1["outage_taluka"] == s2["outage_taluka"]
        assert s1["scenario_counts"] == s2["scenario_counts"]
        assert s1["planted_shops"] == s2["planted_shops"]

        conn1 = sqlite3.connect(str(db1))
        conn2 = sqlite3.connect(str(db2))

        rows1 = conn1.execute("SELECT * FROM shop_weeks ORDER BY shop_id, week_start").fetchall()
        rows2 = conn2.execute("SELECT * FROM shop_weeks ORDER BY shop_id, week_start").fetchall()

        assert rows1 == rows2
        conn1.close()
        conn2.close()


def test_planted_counts_and_outage_exclusion():
    with tempfile.TemporaryDirectory() as tmpdir:
        db = Path(tmpdir) / "pds.db"
        summary = generate_pds_data(num_shops=500, num_weeks=12, seed=42, db_path=db)

        # Planted counts check
        for s_id in ["S1", "S2", "S3", "S4", "S5", "S6"]:
            expected_count = max(3, round(SCENARIOS[s_id].share * 500))
            assert summary["scenario_counts"][s_id] == expected_count

        conn = sqlite3.connect(str(db))
        # Ensure no planted positive shop is in outage taluka
        outage_taluka = summary["outage_taluka"]
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT s.shop_id, s.taluka, gt.scenario, gt.is_positive
            FROM shops s
            JOIN ground_truth gt ON s.shop_id = gt.shop_id
            WHERE s.taluka = ? AND gt.is_positive = 1;
            """,
            (outage_taluka,),
        )
        positives_in_outage = cursor.fetchall()
        assert len(positives_in_outage) == 0

        # Outage taluka shops must all be marked S7
        cursor.execute(
            """
            SELECT gt.scenario
            FROM shops s
            JOIN ground_truth gt ON s.shop_id = gt.shop_id
            WHERE s.taluka = ?;
            """,
            (outage_taluka,),
        )
        scenarios_in_outage = {r[0] for r in cursor.fetchall()}
        assert scenarios_in_outage == {"S7"}

        conn.close()


def test_value_ranges_and_stock_chain():
    with tempfile.TemporaryDirectory() as tmpdir:
        db = Path(tmpdir) / "pds.db"
        generate_pds_data(num_shops=100, num_weeks=8, seed=42, db_path=db)

        conn = sqlite3.connect(str(db))
        cursor = conn.cursor()

        # Ranges check
        cursor.execute(
            """
            SELECT
                min(transactions), min(auth_attempts), min(auth_failures),
                min(unauth_sales), min(stock_opening_kg), min(stock_received_kg),
                min(stock_sold_kg), min(stock_closing_kg), min(board_distributed_kg),
                max(unauth_sales * 1.0 / transactions),
                max(auth_failures * 1.0 / max(auth_attempts, 1))
            FROM shop_weeks;
            """
        )
        row = cursor.fetchone()
        assert row[0] >= 0  # transactions >= 0
        assert row[1] >= 0  # auth_attempts >= 0
        assert row[2] >= 0  # auth_failures >= 0
        assert row[3] >= 0  # unauth_sales >= 0
        assert row[4] >= 0  # opening_kg >= 0
        assert row[5] >= 0  # received_kg >= 0
        assert row[6] >= 0  # sold_kg >= 0
        assert row[7] >= 0  # closing_kg >= 0
        assert row[8] >= 0  # board_kg >= 0
        assert row[9] <= 1.0  # max unauth share <= 1
        assert row[10] <= 1.0  # max auth fail rate <= 1

        # Stock chain: opening of week n == closing of week n-1
        cursor.execute(
            """
            SELECT shop_id, week_start, stock_opening_kg, stock_closing_kg
            FROM shop_weeks
            ORDER BY shop_id, week_start;
            """
        )
        rows = cursor.fetchall()
        prev_shop = None
        prev_closing = None
        for shop_id, week_start, opening, closing in rows:
            if shop_id == prev_shop and prev_closing is not None:
                assert abs(opening - prev_closing) < 1e-3, (
                    f"Stock break {shop_id} {week_start}: {opening} != {prev_closing}"
                )
            prev_shop = shop_id
            prev_closing = closing

        conn.close()


def test_outage_trap_effect():
    with tempfile.TemporaryDirectory() as tmpdir:
        db = Path(tmpdir) / "pds.db"
        summary = generate_pds_data(num_shops=200, num_weeks=12, seed=42, db_path=db)
        outage_taluka = summary["outage_taluka"]

        conn = sqlite3.connect(str(db))
        cursor = conn.cursor()

        # In weeks 10 and 11, outage taluka auth failure rate should be elevated
        cursor.execute(
            """
            SELECT
                week_start,
                avg(auth_failures * 1.0 / auth_attempts)
            FROM shop_weeks sw
            JOIN shops s ON sw.shop_id = s.shop_id
            WHERE s.taluka = ?
            GROUP BY week_start
            ORDER BY week_start;
            """,
            (outage_taluka,),
        )
        rates = [r[1] for r in cursor.fetchall()]
        early_avg = sum(rates[:8]) / 8.0
        late_avg = sum(rates[10:]) / 2.0
        msg = f"Outage effect too weak: late={late_avg}, early={early_avg}"
        assert late_avg > early_avg + 0.15, msg

        conn.close()
