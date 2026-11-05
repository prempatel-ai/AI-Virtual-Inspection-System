"""Feature extraction for shop-week records. Pure functions only."""

import numpy as np
import pandas as pd


def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    """Computes rate signals and hard signal percentages for each shop-week.

    Input DataFrame is expected to contain:
    shop_id, week_start, transactions, auth_attempts, auth_failures,
    unauth_sales, complaints_count, stock_opening_kg, stock_received_kg,
    stock_sold_kg, stock_closing_kg, board_distributed_kg, cards_count,
    district, taluka, vulnerability_index.

    Returns a new DataFrame with computed feature columns.
    """
    out = df.copy()

    # Ensure correct data types
    tx = np.maximum(out["transactions"].astype(float), 1.0)
    auth_att = np.maximum(out["auth_attempts"].astype(float), 1.0)
    sold = np.maximum(out["stock_sold_kg"].astype(float), 1.0)
    stock_base = np.maximum(
        out["stock_opening_kg"].astype(float) + out["stock_received_kg"].astype(float),
        1.0,
    )

    # 1. Rate signals
    out["auth_fail_rate"] = np.clip(out["auth_failures"].astype(float) / auth_att, 0.0, 1.0)
    out["unauth_share"] = np.clip(out["unauth_sales"].astype(float) / tx, 0.0, 1.0)
    out["complaints_rate"] = out["complaints_count"].astype(float) / (tx / 100.0)

    # 2. Hard signals
    # Stock gap: abs(opening + received - sold - closing) / (opening + received) * 100
    expected_closing = (
        out["stock_opening_kg"].astype(float)
        + out["stock_received_kg"].astype(float)
        - out["stock_sold_kg"].astype(float)
    )
    gap_kg = expected_closing - out["stock_closing_kg"].astype(float)
    out["stock_gap_kg"] = gap_kg
    out["stock_gap_pct"] = (np.abs(gap_kg) / stock_base) * 100.0
    out["stock_gap_direction"] = np.where(gap_kg >= 0, "shortfall", "surplus")

    # Board mismatch: abs(board_distributed - sold) / sold * 100
    board_diff_kg = out["board_distributed_kg"].astype(float) - out["stock_sold_kg"].astype(float)
    out["board_diff_kg"] = board_diff_kg
    out["board_mismatch_pct"] = (np.abs(board_diff_kg) / sold) * 100.0
    out["board_direction"] = np.where(board_diff_kg >= 0, "surplus", "shortfall")

    # Size band by cards_count tertiles (qcut or predefined percentiles if uniform)
    if "cards_count" in out.columns:
        cards = out["cards_count"].astype(float)
        q33 = cards.quantile(0.333)
        q66 = cards.quantile(0.667)
        conditions = [
            cards <= q33,
            (cards > q33) & (cards <= q66),
            cards > q66,
        ]
        out["size_band"] = np.select(conditions, ["small", "medium", "large"], default="medium")

    return out
