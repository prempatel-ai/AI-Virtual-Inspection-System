"""Scoring logic and exact decomposable breakdown. Pure functions."""

from typing import Any, Dict, List

import numpy as np

SIGNAL_META = {
    "stock_gap_pct": {
        "label": "Stock gap",
        "unit": "%",
    },
    "board_mismatch_pct": {
        "label": "Board mismatch",
        "unit": "%",
    },
    "unauth_share": {
        "label": "Unauthenticated sales",
        "unit": "%",
    },
    "complaints_rate": {
        "label": "Complaints rate",
        "unit": "per 100 tx",
    },
    "auth_fail_rate": {
        "label": "Auth failure rate",
        "unit": "%",
    },
}


def compute_score_and_breakdown(
    strengths: Dict[str, float],
    raw_values: Dict[str, float],
    z_scores: Dict[str, float | None],
    own_medians: Dict[str, float | None],
    peer_medians: Dict[str, float | None],
    vulnerability_index: float,
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """Computes transparent risk score and breakdown where points sum to final score.

    base = 100 * sum(w_i * s_i) / sum(w_i)
    final = min(100, base * (1 + vuln_uplift * vulnerability_index))
    """
    weights = config.get("weights", {
        "stock_gap_pct": 0.30,
        "board_mismatch_pct": 0.20,
        "unauth_share": 0.20,
        "complaints_rate": 0.15,
        "auth_fail_rate": 0.15,
    })
    total_w = sum(weights.values())
    if total_w <= 0:
        total_w = 1.0

    vuln_cfg = config.get("vulnerability", {})
    uplift_factor = float(vuln_cfg.get("uplift_factor", 0.25))

    bands_cfg = config.get("bands", {"high": 60.0, "medium": 30.0})
    high_threshold = float(bands_cfg.get("high", 60.0))
    medium_threshold = float(bands_cfg.get("medium", 30.0))

    # Calculate unrounded points per signal
    breakdown_lines: List[Dict[str, Any]] = []
    base_points_sum = 0.0

    for key, weight in weights.items():
        s = float(strengths.get(key, 0.0))
        pts = round(100.0 * (weight * s) / total_w, 2)
        base_points_sum += pts

        # Format display value according to unit
        val = raw_values.get(key, 0.0)
        # Rates are stored as ratios (0 to 1), convert to % for UI display if unit is %
        is_pct_rate = (
            SIGNAL_META.get(key, {}).get("unit") == "%"
            and key in ("unauth_share", "auth_fail_rate")
        )
        display_val = val * 100.0 if is_pct_rate else val

        own_med = own_medians.get(key)
        peer_med = peer_medians.get(key)
        z_val = z_scores.get(key)

        breakdown_lines.append({
            "key": key,
            "label": SIGNAL_META.get(key, {}).get("label", key),
            "points": pts,
            "value": round(display_val, 2),
            "unit": SIGNAL_META.get(key, {}).get("unit", ""),
            "own_median": round(own_med, 4) if own_med is not None else None,
            "peer_median": round(peer_med, 4) if peer_med is not None else None,
            "z": round(z_val, 2) if z_val is not None else None,
        })

    # Vulnerability uplift
    base_score = round(base_points_sum, 2)
    uplift_multiplier = 1.0 + (uplift_factor * max(0.0, float(vulnerability_index)))
    raw_final = base_score * uplift_multiplier
    final_score = round(float(np.clip(raw_final, 0.0, 100.0)), 1)

    # Vulnerability points is the difference so sum matches final_score exactly
    vuln_points = round(final_score - base_score, 2)
    # Never negative
    if vuln_points < 0:
        vuln_points = 0.0
        final_score = base_score

    breakdown_lines.append({
        "key": "vulnerability_uplift",
        "label": "Vulnerability uplift",
        "points": vuln_points,
        "value": round(float(vulnerability_index), 3),
        "unit": "index",
        "own_median": None,
        "peer_median": None,
        "z": None,
    })

    # Re-verify breakdown points sum to final_score exactly
    pts_sum = round(sum(line["points"] for line in breakdown_lines), 2)
    if pts_sum != final_score:
        diff = round(final_score - pts_sum, 2)
        breakdown_lines[-1]["points"] = round(breakdown_lines[-1]["points"] + diff, 2)

    # Determine band
    if final_score >= high_threshold:
        band = "high"
    elif final_score >= medium_threshold:
        band = "medium"
    else:
        band = "low"

    return {
        "risk_score": final_score,
        "band": band,
        "breakdown": breakdown_lines,
    }
