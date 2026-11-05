"""Pipeline runner for scoring shops and evaluating a target week."""

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import pandas as pd

from app.cases.service import sync_cases_for_scored_shops
from app.config import get_db_path, load_config
from app.db import get_connection
from app.llm.explain import get_or_generate_explanation
from app.llm.facts import build_facts_payload
from app.pipeline.anomaly import compute_anomalies_for_week
from app.pipeline.checks import evaluate_checks
from app.pipeline.evaluate import evaluate_run
from app.pipeline.features import compute_features
from app.pipeline.scoring import compute_score_and_breakdown


def run_pipeline_for_week(
    week_start: Optional[str] = None,
    top_k: int = 20,
    db_path: Optional[Path] = None,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Runs the full virtual inspection auditing pipeline for a week.

    Scores all shops, saves scores and run summary, and evaluates against ground truth.
    """
    t_start = time.time()
    cfg = config if config is not None else load_config()
    target_db_path = db_path if db_path else get_db_path()

    conn = get_connection(target_db_path)

    # 1. Determine target week
    if not week_start:
        row = conn.execute("SELECT max(week_start) FROM shop_weeks;").fetchone()
        if not row or not row[0]:
            conn.close()
            raise ValueError("No weekly records found in database.")
        target_week = str(row[0])
    else:
        target_week = week_start

    # 2. Load shop records and weekly history
    df_raw = pd.read_sql_query(
        """
        SELECT
            sw.shop_id, sw.week_start, sw.transactions, sw.auth_attempts,
            sw.auth_failures, sw.unauth_sales, sw.complaints_count,
            sw.stock_opening_kg, sw.stock_received_kg, sw.stock_sold_kg,
            sw.stock_closing_kg, sw.board_distributed_kg,
            s.name, s.district, s.taluka, s.cards_count, s.vulnerability_index
        FROM shop_weeks sw
        JOIN shops s ON sw.shop_id = s.shop_id
        WHERE sw.week_start <= ?
        ORDER BY sw.shop_id, sw.week_start;
        """,
        conn,
        params=(target_week,),
    )

    if df_raw.empty:
        conn.close()
        raise ValueError(f"No records found up to week {target_week}.")

    # 3. Compute Features
    df_features = compute_features(df_raw)

    # 4. Compute Rate Anomalies
    df_anomalies = compute_anomalies_for_week(df_features, target_week, cfg)

    # Join anomalies back to target week features
    target_features = df_features[df_features["week_start"] == target_week].copy()
    target_merged = target_features.merge(df_anomalies, on=["shop_id", "week_start"], how="left")

    # 5. Compute Hard Checks and Final Scores
    scored_rows = []
    scores_to_persist = []

    for row in target_merged.itertuples(index=False):
        shop_id = str(row.shop_id)
        stock_gap_pct = float(str(row.stock_gap_pct))
        board_mismatch_pct = float(str(row.board_mismatch_pct))

        # Hard signal strengths
        hard_strengths = evaluate_checks(stock_gap_pct, board_mismatch_pct, cfg)

        strengths = {
            "stock_gap_pct": hard_strengths["stock_gap_pct"],
            "board_mismatch_pct": hard_strengths["board_mismatch_pct"],
            "unauth_share": float(str(getattr(row, "unauth_share_strength", 0.0))),
            "complaints_rate": float(str(getattr(row, "complaints_rate_strength", 0.0))),
            "auth_fail_rate": float(str(getattr(row, "auth_fail_rate_strength", 0.0))),
        }

        raw_values = {
            "stock_gap_pct": stock_gap_pct,
            "board_mismatch_pct": board_mismatch_pct,
            "unauth_share": float(str(row.unauth_share)),
            "complaints_rate": float(str(row.complaints_rate)),
            "auth_fail_rate": float(str(row.auth_fail_rate)),
        }

        z_scores = {
            "stock_gap_pct": None,
            "board_mismatch_pct": None,
            "unauth_share": getattr(row, "unauth_share_z", None),
            "complaints_rate": getattr(row, "complaints_rate_z", None),
            "auth_fail_rate": getattr(row, "auth_fail_rate_z", None),
        }

        own_medians = {
            "stock_gap_pct": None,
            "board_mismatch_pct": None,
            "unauth_share": getattr(row, "unauth_share_own_med", None),
            "complaints_rate": getattr(row, "complaints_rate_own_med", None),
            "auth_fail_rate": getattr(row, "auth_fail_rate_own_med", None),
        }

        peer_medians = {
            "stock_gap_pct": None,
            "board_mismatch_pct": None,
            "unauth_share": getattr(row, "unauth_share_peer_med", None),
            "complaints_rate": getattr(row, "complaints_rate_peer_med", None),
            "auth_fail_rate": getattr(row, "auth_fail_rate_peer_med", None),
        }

        vuln_idx = float(str(row.vulnerability_index))

        score_res = compute_score_and_breakdown(
            strengths=strengths,
            raw_values=raw_values,
            z_scores=z_scores,
            own_medians=own_medians,
            peer_medians=peer_medians,
            vulnerability_index=vuln_idx,
            config=cfg,
        )

        risk_score = score_res["risk_score"]
        band = score_res["band"]
        breakdown_json = json.dumps(score_res["breakdown"])

        scored_rows.append({
            "shop_id": shop_id,
            "week_start": target_week,
            "risk_score": risk_score,
            "band": band,
            "breakdown": score_res["breakdown"],
        })

        scores_to_persist.append((
            shop_id,
            target_week,
            risk_score,
            band,
            breakdown_json,
        ))

    # Duration calculation
    duration_ms = int((time.time() - t_start) * 1000)
    started_at = datetime.now(timezone.utc).isoformat()

    # 6. Insert Run Record
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO runs (week_start, started_at, duration_ms, shops_scored, explained)
        VALUES (?, ?, ?, ?, ?);
        """,
        (target_week, started_at, duration_ms, len(scores_to_persist), 0),
    )
    run_id = int(cursor.lastrowid or 0)

    # 7. Persist Scores
    cursor.executemany(
        """
        INSERT OR REPLACE INTO scores
            (shop_id, week_start, risk_score, band, breakdown_json, run_id)
        VALUES (?, ?, ?, ?, ?, ?);
        """,
        [(s[0], s[1], s[2], s[3], s[4], run_id) for s in scores_to_persist],
    )
    conn.commit()

    # 7.5 Synchronize Cases
    cases_sync = sync_cases_for_scored_shops(conn, scored_rows, target_week, cfg)

    # 8. Explain top K shops
    top_k_count = min(top_k, len(scored_rows))
    scored_sorted = sorted(scored_rows, key=lambda x: x["risk_score"], reverse=True)
    top_shops = scored_sorted[:top_k_count]

    explained_count = 0
    for s_info in top_shops:
        s_id = s_info["shop_id"]
        s_row = target_features[target_features["shop_id"] == s_id].iloc[0]
        shop_meta = {
            "shop_id": s_id,
            "name": str(s_row["name"]),
            "district": str(s_row["district"]),
            "taluka": str(s_row["taluka"]),
            "cards_count": int(s_row["cards_count"]),
            "vulnerability_index": float(s_row["vulnerability_index"]),
        }
        opening = float(s_row["stock_opening_kg"])
        received = float(s_row["stock_received_kg"])
        sold = float(s_row["stock_sold_kg"])
        closing = float(s_row["stock_closing_kg"])
        board_kg = float(s_row["board_distributed_kg"])
        exp_closing = opening + received - sold
        gap_kg = round(exp_closing - closing, 1)
        base_stock = max(opening + received, 1.0)
        gap_pct = round((abs(gap_kg) / base_stock) * 100.0, 2)
        direction = "shortfall" if gap_kg >= 0 else "surplus"
        stock_recon = {
            "opening_kg": opening,
            "received_kg": received,
            "sold_kg": sold,
            "closing_kg": closing,
            "gap_kg": gap_kg,
            "gap_pct": gap_pct,
            "direction": direction,
        }
        diff_board = board_kg - sold
        board_check = {
            "board_kg": board_kg,
            "sold_kg": sold,
            "mismatch_pct": round((abs(diff_board) / max(sold, 1.0)) * 100.0, 2),
        }
        payload = build_facts_payload(
            shop_meta=shop_meta,
            week_start=target_week,
            risk_score=s_info["risk_score"],
            band=s_info["band"],
            breakdown=s_info["breakdown"],
            stock_recon=stock_recon,
            board_check=board_check,
            complaints=[],
            recent_series={},
        )
        get_or_generate_explanation(
            payload=payload,
            stock_recon=stock_recon,
            board_check=board_check,
            breakdown=s_info["breakdown"],
            conn=conn,
        )
        explained_count += 1

    # Update runs record with explained count
    cursor.execute(
        "UPDATE runs SET explained = ? WHERE run_id = ?;",
        (explained_count, run_id),
    )
    conn.commit()

    # 9. Evaluation
    df_scores = pd.DataFrame(scored_rows)
    eval_result = evaluate_run(df_scores, conn)
    conn.close()

    return {
        "run_id": run_id,
        "week": target_week,
        "shops_scored": len(scored_rows),
        "explained": explained_count,
        "duration_ms": duration_ms,
        "evaluation": eval_result,
        "cases_created": cases_sync["cases_created"],
        "cases_updated": cases_sync["cases_updated"],
    }
