"""Tests for scoring, exact breakdown decomposition, bands, and evaluation targets."""

import numpy as np

from app.config import load_config
from app.data.generator import generate_pds_data
from app.pipeline.run import run_pipeline_for_week
from app.pipeline.scoring import compute_score_and_breakdown


def test_hand_computed_golden_case():
    config = {
        "weights": {
            "stock_gap_pct": 0.25,
            "board_mismatch_pct": 0.25,
            "unauth_share": 0.20,
            "complaints_rate": 0.15,
            "auth_fail_rate": 0.10,
        },
        "bands": {"high": 60.0, "medium": 30.0},
        "vulnerability": {"uplift_factor": 0.50},
    }

    # Signal strengths all 0.5
    strengths = {k: 0.5 for k in config["weights"]}
    raw_vals = {k: 10.0 for k in config["weights"]}
    z_scores = {k: 2.0 for k in config["weights"]}
    own_meds = {k: 5.0 for k in config["weights"]}
    peer_meds = {k: 5.0 for k in config["weights"]}

    # base = 100 * sum(0.5 * w) / sum(w) = 50.0
    # vuln_index = 0.4 -> uplift = 1 + 0.5 * 0.4 = 1.2 -> final = 50.0 * 1.2 = 60.0
    res = compute_score_and_breakdown(
        strengths=strengths,
        raw_values=raw_vals,
        z_scores=z_scores,
        own_medians=own_meds,
        peer_medians=peer_meds,
        vulnerability_index=0.4,
        config=config,
    )

    assert res["risk_score"] == 60.0
    assert res["band"] == "high"
    points_sum = round(sum(item["points"] for item in res["breakdown"]), 2)
    assert abs(points_sum - 60.0) < 1e-4


def test_breakdown_sum_property_and_bands_boundaries():
    config = load_config()
    rng = np.random.default_rng(123)

    for _ in range(500):
        strengths = {k: float(rng.uniform(0.0, 1.0)) for k in config["weights"]}
        raw_vals = {k: float(rng.uniform(0.0, 50.0)) for k in config["weights"]}
        z_scores = {k: float(rng.uniform(0.0, 5.0)) for k in config["weights"]}
        own_meds = {k: float(rng.uniform(0.0, 10.0)) for k in config["weights"]}
        peer_meds = {k: float(rng.uniform(0.0, 10.0)) for k in config["weights"]}
        vuln = float(rng.uniform(0.0, 1.0))

        res = compute_score_and_breakdown(
            strengths=strengths,
            raw_values=raw_vals,
            z_scores=z_scores,
            own_medians=own_meds,
            peer_medians=peer_meds,
            vulnerability_index=vuln,
            config=config,
        )

        score = res["risk_score"]
        assert 0.0 <= score <= 100.0

        # Exact decomposition check
        pts_sum = round(sum(line["points"] for line in res["breakdown"]), 2)
        assert abs(pts_sum - score) < 1e-3, f"Sum {pts_sum} != {score}"

        # Vulnerability uplift line never negative
        vuln_line = [
            item for item in res["breakdown"] if item["key"] == "vulnerability_uplift"
        ][0]
        assert vuln_line["points"] >= 0.0

        # Band boundaries
        if score >= config["bands"]["high"]:
            assert res["band"] == "high"
        elif score >= config["bands"]["medium"]:
            assert res["band"] == "medium"
        else:
            assert res["band"] == "low"


def test_evaluation_targets_met_on_default_dataset(tmp_path):
    db_file = tmp_path / "eval_pds.db"
    generate_pds_data(num_shops=500, num_weeks=12, seed=42, db_path=db_file)

    res = run_pipeline_for_week(db_path=db_file)
    ev = res["evaluation"]

    assert ev["on_synthetic_data"] is True
    assert ev["precision_at_k"] >= 0.80, f"precision@K {ev['precision_at_k']} < 0.80"
    assert ev["recall_at_2k"] >= 0.90, f"recall@2K {ev['recall_at_2k']} < 0.90"
    assert (
        ev["outage_false_alarm_rate"] <= 0.05
    ), f"outage_fa {ev['outage_false_alarm_rate']} > 0.05"
