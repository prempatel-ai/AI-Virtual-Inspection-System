"""Unit tests for features, anomaly detection, and checks."""

import numpy as np
import pandas as pd

from app.pipeline.anomaly import compute_anomalies_for_week, robust_z
from app.pipeline.checks import compute_hard_signal_strength, evaluate_checks
from app.pipeline.features import compute_features


def test_features_computation():
    df = pd.DataFrame([
        {
            "shop_id": "FPS-00001",
            "week_start": "2026-11-02",
            "transactions": 100,
            "auth_attempts": 120,
            "auth_failures": 30,
            "unauth_sales": 5,
            "complaints_count": 2,
            "stock_opening_kg": 1000.0,
            "stock_received_kg": 500.0,
            "stock_sold_kg": 400.0,
            "stock_closing_kg": 1050.0,
            "board_distributed_kg": 440.0,
            "cards_count": 300,
            "district": "Ahmedabad",
            "taluka": "Ahmedabad Taluka 1",
            "vulnerability_index": 0.25,
        }
    ])

    out = compute_features(df)
    # Auth fail rate: 30 / 120 = 0.25
    assert abs(out["auth_fail_rate"].iloc[0] - 0.25) < 1e-4
    # Unauth share: 5 / 100 = 0.05
    assert abs(out["unauth_share"].iloc[0] - 0.05) < 1e-4
    # Complaints rate: 2 per 100 tx = 2.0
    assert abs(out["complaints_rate"].iloc[0] - 2.0) < 1e-4
    # Stock gap: expected closing = 1000 + 500 - 400 = 1100. Actual = 1050.
    # gap_kg = 50 (shortfall). stock_base = 1500. gap_pct = (50 / 1500) * 100 = 3.333%
    assert abs(out["stock_gap_pct"].iloc[0] - 3.333) < 0.01
    assert out["stock_gap_direction"].iloc[0] == "shortfall"
    # Board mismatch: board = 440, sold = 400. diff = 40. mismatch = (40 / 400) * 100 = 10%
    assert abs(out["board_mismatch_pct"].iloc[0] - 10.0) < 1e-4
    assert out["board_direction"].iloc[0] == "surplus"


def test_robust_z_hand_computed():
    # Baseline: [10, 11, 12, 13, 14]
    # Median = 12
    # Absolute deviations = [2, 1, 0, 1, 2] -> sorted: [0, 1, 1, 2, 2] -> MAD = 1
    # Scale = max(1.4826 * 1, 0.1) = 1.4826
    # x = 15 -> z = (15 - 12) / 1.4826 = 3 / 1.4826 ≈ 2.02347
    baseline = np.array([10.0, 11.0, 12.0, 13.0, 14.0])
    z, med, mad = robust_z(15.0, baseline, min_scale=0.1)
    assert abs(med - 12.0) < 1e-4
    assert abs(mad - 1.0) < 1e-4
    assert abs(z - (3.0 / 1.4826)) < 1e-4


def test_zero_mad_floor():
    # Baseline with all identical values
    baseline = np.array([5.0, 5.0, 5.0, 5.0, 5.0])
    # MAD is 0, min_scale=0.2 must prevent division by zero
    z, med, mad = robust_z(6.0, baseline, min_scale=0.2)
    assert mad == 0.0
    assert abs(z - (1.0 / 0.2)) < 1e-4  # z = (6 - 5) / 0.2 = 5.0


def test_peer_widening_and_history_fallback():
    config = {
        "anomaly": {
            "z_cap": 4.0,
            "own_window": 8,
            "min_own_window": 4,
            "min_peers": 5,
            "min_scale": {
                "auth_fail_rate": 0.02,
                "unauth_share": 0.01,
                "complaints_rate": 0.05,
            },
        }
    }

    # Only 2 shops in the taluka (less than min_peers=5)
    # Target week: 2026-11-02. History: only 2 weeks (less than min_own_window=4)
    rows = []
    # 2 shops in Taluka 1, 4 other shops in same District Taluka 2
    for w in ["2026-10-19", "2026-10-26", "2026-11-02"]:
        for i in range(1, 7):
            t_name = "Taluka 1" if i <= 2 else "Taluka 2"
            rows.append({
                "shop_id": f"FPS-{i:05d}",
                "week_start": w,
                "district": "DistA",
                "taluka": t_name,
                "size_band": "medium",
                "auth_fail_rate": 0.30 if i != 1 else 0.45,
                "unauth_share": 0.03,
                "complaints_rate": 0.1,
            })

    df = pd.DataFrame(rows)
    anomalies = compute_anomalies_for_week(df, "2026-11-02", config)

    target_row = anomalies[anomalies["shop_id"] == "FPS-00001"].iloc[0]
    # Because history has only 2 weeks (< 4), z_own must equal z_peer
    assert target_row["auth_fail_rate_z_own"] == target_row["auth_fail_rate_z_peer"]
    # And z_peer must have widened to the district since Taluka 1 only had 1 other shop (< 5)
    assert target_row["auth_fail_rate_z_peer"] > 0


def test_hard_signal_strength_checks():
    config = {
        "hard_signals": {
            "stock_gap_pct": {"low": 2.0, "high": 10.0},
            "board_mismatch_pct": {"low": 5.0, "high": 20.0},
        }
    }

    assert compute_hard_signal_strength(1.0, 2.0, 10.0) == 0.0
    assert compute_hard_signal_strength(6.0, 2.0, 10.0) == 0.5
    assert compute_hard_signal_strength(12.0, 2.0, 10.0) == 1.0

    strengths = evaluate_checks(6.0, 12.5, config)
    assert abs(strengths["stock_gap_pct"] - 0.5) < 1e-4
    assert abs(strengths["board_mismatch_pct"] - 0.5) < 1e-4


def test_outage_trap_peer_resilience():
    # When an entire taluka experiences an auth failure surge (e.g. from 0.30 to 0.55),
    # all peers in the taluka surge together, so z_peer remains low.
    config = {
        "anomaly": {
            "z_cap": 4.0,
            "own_window": 8,
            "min_own_window": 4,
            "min_peers": 5,
            "min_scale": {"auth_fail_rate": 0.02, "unauth_share": 0.01, "complaints_rate": 0.05},
        }
    }

    rows = []
    # 10 shops in Outage Taluka
    # 8 historical weeks clean (fail rate ~0.30)
    # Target week outage (all shops fail rate ~0.55)
    weeks = [f"2026-09-{w:02d}" for w in range(1, 9)] + ["2026-11-02"]
    for w in weeks:
        is_target = (w == "2026-11-02")
        for i in range(1, 11):
            base_val = 0.55 if is_target else 0.30
            # Slight random noise across shops
            noise = (i % 3) * 0.01
            rows.append({
                "shop_id": f"FPS-{i:05d}",
                "week_start": w,
                "district": "DistA",
                "taluka": "Outage Taluka",
                "size_band": "medium",
                "auth_fail_rate": base_val + noise,
                "unauth_share": 0.03,
                "complaints_rate": 0.1,
            })

    df = pd.DataFrame(rows)
    anomalies = compute_anomalies_for_week(df, "2026-11-02", config)

    # For shop 1, z_own will be high because its past was 0.30,
    # BUT z_peer will be near 0 because its peers in target week are also ~0.55.
    # Therefore, z = min(z_own, z_peer) must remain low, and strength near 0!
    shop1 = anomalies[anomalies["shop_id"] == "FPS-00001"].iloc[0]
    assert shop1["auth_fail_rate_z_own"] > 5.0
    assert shop1["auth_fail_rate_z_peer"] < 1.0
    assert shop1["auth_fail_rate_strength"] < 0.25  # Suppressed by peer baseline!
