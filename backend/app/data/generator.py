"""Synthetic PDS Data Generator."""

import argparse
import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np

from app.config import get_db_path
from app.data.scenarios import (
    COMPLAINT_CATEGORIES,
    DISTRICT_TALUKAS,
    DISTRICTS,
    SCENARIOS,
)
from app.db import init_db


def generate_pds_data(
    num_shops: int = 500,
    num_weeks: int = 12,
    seed: int = 42,
    start_date_str: str = "2026-08-17",
    db_path: Path | None = None,
) -> Dict[str, Any]:
    """Generates synthetic PDS data deterministically and saves to SQLite."""
    rng = np.random.default_rng(seed)

    # 1. Setup Dates
    start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
    week_dates = [
        (start_date + timedelta(weeks=w)).strftime("%Y-%m-%d")
        for w in range(num_weeks)
    ]

    # 2. Setup Talukas and Districts
    all_talukas: List[Tuple[str, str]] = []
    for dist in DISTRICTS:
        for tal in DISTRICT_TALUKAS.get(dist, [dist]):
            all_talukas.append((dist, tal))

    # If num_shops is less than the count of all talukas, scale down talukas
    # so that each taluka receives multiple shops (needed for peer stats and outage detection)
    if num_shops < len(all_talukas):
        target_count = max(len(DISTRICTS), num_shops // 3)
        talukas = all_talukas[:target_count]
    else:
        talukas = all_talukas

    num_talukas = len(talukas)

    # Pick outage taluka (Scenario S7) - prefer Kadi in Mehsana for demo scenario consistency
    kadi_idx = next(
        (i for i, (d, t) in enumerate(talukas) if d == "Mehsana" and t == "Kadi"),
        None,
    )
    if kadi_idx is not None:
        outage_taluka_idx = kadi_idx
    else:
        outage_taluka_idx = int(rng.choice(num_talukas))
    outage_dist, outage_taluka = talukas[outage_taluka_idx]

    # 3. Create Shops
    shops_data: List[Dict[str, Any]] = []
    for i in range(num_shops):
        shop_id = f"FPS-{i+1:05d}"
        t_dist, t_name = talukas[i % num_talukas]
        # Cards count lognormal median ~350, clipped 120 to 900
        cards = int(np.clip(np.round(rng.lognormal(mean=5.858, sigma=0.35)), 120, 900))
        # Vulnerability index Beta(2, 6)
        vuln = round(float(rng.beta(2, 6)), 4)
        shops_data.append({
            "shop_id": shop_id,
            "name": f"Shop {shop_id}",
            "district": t_dist,
            "taluka": t_name,
            "cards_count": cards,
            "vulnerability_index": vuln,
            "shop_index": i,
        })

    # 4. Scenario Assignment
    # S7 is all shops in outage taluka
    outage_shop_indices = [
        s["shop_index"] for s in shops_data if s["taluka"] == outage_taluka
    ]
    eligible_indices = [
        s["shop_index"] for s in shops_data if s["taluka"] != outage_taluka
    ]
    rng.shuffle(eligible_indices)

    planted_scenario_map: Dict[int, str] = {}
    for idx in outage_shop_indices:
        planted_scenario_map[idx] = "S7"

    curr_ptr = 0
    scenario_shop_ids: Dict[str, List[str]] = {s_id: [] for s_id in SCENARIOS}
    scenario_shop_ids["S7"] = [shops_data[idx]["shop_id"] for idx in outage_shop_indices]

    for s_id in ["S1", "S2", "S3", "S4", "S5", "S6"]:
        share = SCENARIOS[s_id].share
        count = max(3, int(round(share * num_shops)))
        selected = eligible_indices[curr_ptr : curr_ptr + count]
        curr_ptr += count
        for s_idx in selected:
            planted_scenario_map[s_idx] = s_id
            scenario_shop_ids[s_id].append(shops_data[s_idx]["shop_id"])

    # For S6: ensure vulnerability_index >= 0.80
    for s_idx in [
        s["shop_index"] for s in shops_data if planted_scenario_map.get(s["shop_index"]) == "S6"
    ]:
        shops_data[s_idx]["vulnerability_index"] = round(float(rng.uniform(0.80, 0.95)), 4)

    # Remaining shops are S8 (clean)
    for s in shops_data:
        s_idx = s["shop_index"]
        if s_idx not in planted_scenario_map:
            planted_scenario_map[s_idx] = "S8"
            scenario_shop_ids["S8"].append(s["shop_id"])

    # 5. Baseline parameters per shop for realistic continuity
    # Shop-level auth failure base rate ~0.26 to 0.34
    shop_base_fail_rates = rng.uniform(0.26, 0.34, size=num_shops)
    # Shop-level unauth rate ~0.02 to 0.035
    shop_base_unauth_rates = rng.uniform(0.02, 0.035, size=num_shops)

    # 6. Generate Weekly Records across 12 weeks
    all_shop_weeks: List[Tuple[Any, ...]] = []
    all_complaints: List[Tuple[Any, ...]] = []

    # Track closing stock of previous week per shop
    # Initial week 0 opening stock ~ cards_count * 5.0 kg (approx 1 week demand)
    prev_closing = [
        float(s["cards_count"] * 5.0 * rng.uniform(0.95, 1.05))
        for s in shops_data
    ]

    for w_idx, week_date in enumerate(week_dates):
        # Weekly progress factor for planted anomalies
        # Effects start 4 weeks before target week (w_idx >= 8)
        if w_idx >= 8:
            anomaly_progress = (w_idx - 7) / 4.0  # 0.25, 0.50, 0.75, 1.00
        else:
            anomaly_progress = 0.0

        for s in shops_data:
            s_idx = s["shop_index"]
            shop_id = s["shop_id"]
            cards = s["cards_count"]
            scenario = planted_scenario_map[s_idx]

            # Transactions: Binomial(cards_count, 0.25)
            tx = int(rng.binomial(cards, 0.25))
            tx = max(tx, 15)  # ensure at least 15 transactions

            # Unauth sales base
            unauth_rate = shop_base_unauth_rates[s_idx] + rng.normal(0, 0.003)
            unauth_rate = float(np.clip(unauth_rate, 0.015, 0.045))

            # Auth failures base
            fail_rate = shop_base_fail_rates[s_idx] + rng.normal(0, 0.015)
            fail_rate = float(np.clip(fail_rate, 0.20, 0.38))

            # Sold kg
            kg_per_tx = float(rng.normal(20.0, 0.8))
            sold_kg = round(float(tx * kg_per_tx), 1)

            # Received kg
            expected_demand = float(cards * 0.25 * 20.0)
            received_kg = round(float(expected_demand * rng.uniform(0.90, 1.10)), 1)
            opening_kg = round(prev_closing[s_idx], 1)

            # Clean expected closing
            expected_closing = opening_kg + received_kg - sold_kg
            # Clean noise on closing stock (< 1.5% of opening + received)
            noise_closing = float(rng.normal(0, 0.005 * (opening_kg + received_kg)))
            closing_kg = round(max(0.0, expected_closing + noise_closing), 1)

            # Board distributed kg (clean within 3% of sold)
            board_kg = round(max(0.0, float(sold_kg * rng.normal(1.0, 0.012))), 1)

            # Complaints base count
            # Poisson with low rate ~ 0.08 per 100 tx
            comp_lambda = max(0.01, 0.08 * (tx / 100.0))
            comp_count = int(rng.poisson(comp_lambda))

            # Apply Scenario Modifications
            if anomaly_progress > 0:
                # S1 Stock Diversion (closing stock lower by 8% to 15%)
                if scenario in ("S1", "S5"):
                    factor = (
                        0.08 + (0.07 * anomaly_progress)
                        if scenario == "S1"
                        else 0.12 + (0.06 * anomaly_progress)
                    )
                    shortfall = (opening_kg + received_kg) * factor
                    closing_kg = round(max(0.0, closing_kg - shortfall), 1)

                # S2 Board Mismatch (board = sold * 1.15 to 1.35)
                if scenario == "S2":
                    inflation = 1.0 + (
                        (0.15 + (0.20 * rng.uniform(0.8, 1.0))) * anomaly_progress
                    )
                    board_kg = round(float(sold_kg * inflation), 1)

                # S3 Override Heavy (unauth_share jumps, auth failures rise)
                if scenario in ("S3", "S5"):
                    target_unauth = (
                        0.35 + (0.20 * anomaly_progress)
                        if scenario == "S3"
                        else 0.40 + (0.20 * anomaly_progress)
                    )
                    unauth_rate = min(0.60, target_unauth)
                    fail_rate = min(0.65, fail_rate + (0.20 * anomaly_progress))

                # S4 Complaint Spike (last 3 weeks: w_idx >= 9, 4 to 6x complaints)
                if scenario in ("S4", "S5") and w_idx >= 9:
                    multiplier = (
                        float(rng.uniform(4.5, 6.5))
                        if scenario == "S4"
                        else float(rng.uniform(6.0, 8.0))
                    )
                    comp_count = max(3, int(round(comp_count * multiplier + rng.poisson(3.5))))

                # S6 Vulnerable, Mild Stock Gap (gap of 3% to 5%)
                if scenario == "S6":
                    gap_factor = 0.03 + 0.02 * anomaly_progress
                    shortfall = (opening_kg + received_kg) * gap_factor
                    closing_kg = round(max(0.0, closing_kg - shortfall), 1)

            # S7 Outage Trap: last 2 weeks (w_idx >= 10), outage taluka +20 to +30 pp auth fail
            if scenario == "S7" and w_idx >= 10:
                extra_fail = float(rng.uniform(0.22, 0.30))
                fail_rate = min(0.75, fail_rate + extra_fail)
                unauth_rate = min(0.40, unauth_rate + (extra_fail * 0.5))

            # Compute auth numbers consistently
            unauth_sales = int(min(tx, max(0, round(tx * unauth_rate))))
            auth_tx = max(0, tx - unauth_sales)
            if fail_rate >= 0.99:
                fail_rate = 0.95
            auth_attempts = int(round(auth_tx / (1.0 - fail_rate)))
            auth_failures = max(0, auth_attempts - auth_tx)

            # Update prev_closing for next week
            prev_closing[s_idx] = closing_kg

            all_shop_weeks.append((
                shop_id,
                week_date,
                tx,
                auth_attempts,
                auth_failures,
                unauth_sales,
                comp_count,
                opening_kg,
                received_kg,
                sold_kg,
                closing_kg,
                board_kg,
            ))

            # Generate complaint items
            if comp_count > 0:
                for _ in range(comp_count):
                    if scenario in ("S4", "S5") and w_idx >= 9:
                        # Mostly denied ration and short weight
                        cat = rng.choice(["denied ration", "short weight"], p=[0.6, 0.4])
                    else:
                        cat = rng.choice(COMPLAINT_CATEGORIES)
                    all_complaints.append((shop_id, week_date, cat))

    # 7. Write to SQLite database
    target_db_path = Path(db_path) if db_path else get_db_path()
    target_db_path.parent.mkdir(parents=True, exist_ok=True)
    if target_db_path.exists():
        target_db_path.unlink()

    init_db(target_db_path)
    conn = sqlite3.connect(str(target_db_path))
    conn.execute("PRAGMA synchronous = OFF;")
    conn.execute("PRAGMA journal_mode = MEMORY;")
    conn.execute("PRAGMA cache_size = 100000;")

    # Insert shops
    conn.executemany(
        """
        INSERT INTO shops (shop_id, name, district, taluka, cards_count, vulnerability_index)
        VALUES (?, ?, ?, ?, ?, ?);
        """,
        [
            (
                s["shop_id"],
                s["name"],
                s["district"],
                s["taluka"],
                s["cards_count"],
                s["vulnerability_index"],
            )
            for s in shops_data
        ],
    )

    # Insert shop_weeks
    conn.executemany(
        """
        INSERT INTO shop_weeks (
            shop_id, week_start, transactions, auth_attempts, auth_failures,
            unauth_sales, complaints_count, stock_opening_kg, stock_received_kg,
            stock_sold_kg, stock_closing_kg, board_distributed_kg
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """,
        all_shop_weeks,
    )

    # Insert complaints
    conn.executemany(
        """
        INSERT INTO complaints (shop_id, week_start, category)
        VALUES (?, ?, ?);
        """,
        all_complaints,
    )

    # Insert ground_truth
    conn.executemany(
        """
        INSERT INTO ground_truth (shop_id, scenario, is_positive)
        VALUES (?, ?, ?);
        """,
        [
            (
                s["shop_id"],
                planted_scenario_map[s["shop_index"]],
                SCENARIOS[planted_scenario_map[s["shop_index"]]].is_positive,
            )
            for s in shops_data
        ],
    )

    conn.commit()
    conn.close()

    summary: Dict[str, Any] = {
        "num_shops": num_shops,
        "num_weeks": num_weeks,
        "seed": seed,
        "start_date": start_date_str,
        "latest_week": week_dates[-1],
        "outage_taluka": outage_taluka,
        "outage_district": outage_dist,
        "scenario_counts": {s_id: len(scenario_shop_ids[s_id]) for s_id in SCENARIOS},
        "planted_shops": scenario_shop_ids,
    }

    # Write planted.json
    planted_json_path = target_db_path.parent / "planted.json"
    with open(planted_json_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic PDS inspection data.")
    parser.add_argument("--shops", type=int, default=500, help="Number of shops (default: 500)")
    parser.add_argument("--weeks", type=int, default=12, help="Number of weeks (default: 12)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed (default: 42)")
    parser.add_argument(
        "--start-date", type=str, default="2026-08-17", help="Start date Monday YYYY-MM-DD"
    )
    parser.add_argument("--db-path", type=str, default=None, help="Database path")
    args = parser.parse_args()

    summary = generate_pds_data(
        num_shops=args.shops,
        num_weeks=args.weeks,
        seed=args.seed,
        start_date_str=args.start_date,
        db_path=Path(args.db_path) if args.db_path else None,
    )

    print("==================================================")
    print("PDS SYNTHETIC DATA GENERATION COMPLETE")
    print(
        f"Shops: {summary['num_shops']} | Weeks: {summary['num_weeks']} | Seed: {summary['seed']}"
    )
    print(f"Outage Taluka (S7): {summary['outage_taluka']} ({summary['outage_district']})")
    print("Scenario breakdown:")
    for s_id, count in summary["scenario_counts"].items():
        s_def = SCENARIOS[s_id]
        print(f"  [{s_id}] {s_def.name}: {count} shops (positive: {s_def.is_positive})")
    print("==================================================")


if __name__ == "__main__":
    main()
