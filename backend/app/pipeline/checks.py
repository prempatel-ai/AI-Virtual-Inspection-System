"""Deterministic checks for hard signals (stock gap and board mismatch)."""

from typing import Any, Dict

import numpy as np


def compute_hard_signal_strength(
    value: float,
    low: float,
    high: float,
) -> float:
    """Computes hard signal strength s = clip((v - low) / (high - low), 0, 1)."""
    if high <= low:
        return 1.0 if value >= high else 0.0
    s = (value - low) / (high - low)
    return float(np.clip(s, 0.0, 1.0))


def evaluate_checks(
    stock_gap_pct: float,
    board_mismatch_pct: float,
    config: Dict[str, Any],
) -> Dict[str, float]:
    """Computes signal strengths for stock_gap_pct and board_mismatch_pct."""
    hard_cfg = config.get("hard_signals", {})

    sg_cfg = hard_cfg.get("stock_gap_pct", {"low": 2.0, "high": 10.0})
    bm_cfg = hard_cfg.get("board_mismatch_pct", {"low": 5.0, "high": 20.0})

    s_stock = compute_hard_signal_strength(stock_gap_pct, sg_cfg["low"], sg_cfg["high"])
    s_board = compute_hard_signal_strength(board_mismatch_pct, bm_cfg["low"], bm_cfg["high"])

    return {
        "stock_gap_pct": s_stock,
        "board_mismatch_pct": s_board,
    }
