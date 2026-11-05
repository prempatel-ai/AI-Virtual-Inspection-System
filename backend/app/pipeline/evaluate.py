"""Evaluation of detection and scoring against planted ground truth labels."""

import sqlite3
from typing import Any, Dict

import pandas as pd


def evaluate_run(
    df_scores: pd.DataFrame,
    conn: sqlite3.Connection,
) -> Dict[str, Any]:
    """Computes precision@K, recall@2K, and outage false alarm rate.

    df_scores must have shop_id and risk_score, sorted descending by risk_score.
    """
    # Load ground_truth and shop metadata
    df_gt = pd.read_sql_query(
        """
        SELECT s.shop_id, s.taluka, gt.scenario, gt.is_positive
        FROM shops s
        JOIN ground_truth gt ON s.shop_id = gt.shop_id;
        """,
        conn,
    )

    # Merge scores with ground truth
    merged = df_scores.merge(df_gt, on="shop_id", how="left").sort_values(
        "risk_score", ascending=False
    )

    total_positives = int(df_gt["is_positive"].sum())
    k = max(total_positives, 1)
    two_k = min(len(merged), 2 * k)

    # Top K
    top_k = merged.iloc[:k]
    tp_k = int(top_k["is_positive"].sum())
    precision_at_k = tp_k / float(k)

    # Top 2K
    top_2k = merged.iloc[:two_k]
    tp_2k = int(top_2k["is_positive"].sum())
    recall_at_2k = tp_2k / float(k)

    # Outage false alarms: shops with scenario == 'S7' (or unplanted in outage taluka)
    outage_false_alarms = int(
        ((top_2k["scenario"] == "S7") & (top_2k["is_positive"] == 0)).sum()
    )
    outage_false_alarm_rate = outage_false_alarms / float(two_k) if two_k > 0 else 0.0

    return {
        "on_synthetic_data": True,
        "k": k,
        "precision_at_k": round(precision_at_k, 4),
        "recall_at_2k": round(recall_at_2k, 4),
        "outage_false_alarm_rate": round(outage_false_alarm_rate, 4),
    }
