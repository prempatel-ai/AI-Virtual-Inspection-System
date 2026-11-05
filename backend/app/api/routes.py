"""API route handlers."""

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import get_current_user, require_permission, verify_csrf
from app.auth.scope import ScopeFilter, get_scope_filter
from app.config import load_config
from app.db import get_connection
from app.llm.templates import generate_template_explanation
from app.metrics import is_overdue_check
from app.pipeline.run import run_pipeline_for_week
from app.schemas import (
    BoardCheck,
    BreakdownItem,
    CaseSummary,
    ChecklistItem,
    ComplaintCategoryCount,
    EvaluationSummary,
    EvidenceItem,
    ExplanationData,
    FeedbackItem,
    FeedbackRequest,
    FeedbackResponse,
    HistoryData,
    MetaResponse,
    RankedShopItem,
    RankedShopsResponse,
    RunRequest,
    RunResponse,
    SeriesData,
    ShopDetailResponse,
    ShopMeta,
    SignalSummary,
    StockReconciliation,
    SummaryResponse,
)

router = APIRouter()


def get_latest_week(conn) -> str:
    """Helper to fetch the latest week from shop_weeks."""
    row = conn.execute("SELECT max(week_start) FROM shop_weeks;").fetchone()
    if not row or not row[0]:
        return "2026-11-02"
    return str(row[0])


@router.get("/meta", response_model=MetaResponse)
def get_meta(current_user: Dict[str, Any] = Depends(get_current_user)) -> MetaResponse:
    """Returns metadata about the PDS system dataset and available weeks."""
    conn = get_connection()
    try:
        weeks = [
            r[0]
            for r in conn.execute(
                "SELECT DISTINCT week_start FROM shop_weeks ORDER BY week_start;"
            ).fetchall()
        ]
        latest_week = weeks[-1] if weeks else "2026-11-02"

        districts = [
            r[0]
            for r in conn.execute(
                "SELECT DISTINCT district FROM shops ORDER BY district;"
            ).fetchall()
        ]

        talukas_dict: Dict[str, List[str]] = {}
        for d in districts:
            t_rows = conn.execute(
                "SELECT DISTINCT taluka FROM shops WHERE district = ? ORDER BY taluka;",
                (d,),
            ).fetchall()
            talukas_dict[d] = [r[0] for r in t_rows]

        shops_count_row = conn.execute("SELECT count(*) FROM shops;").fetchone()
        shops_count = shops_count_row[0] if shops_count_row else 0

        runs_count_row = conn.execute("SELECT count(*) FROM runs;").fetchone()
        has_run = (runs_count_row[0] > 0) if runs_count_row else False

        return MetaResponse(
            synthetic=True,
            weeks=weeks,
            latest_week=latest_week,
            districts=districts,
            talukas=talukas_dict,
            shops_count=shops_count,
            has_run=has_run,
        )
    finally:
        conn.close()


@router.get("/summary", response_model=SummaryResponse)
def get_summary(
    week: Optional[str] = Query(default=None),
    current_user: Dict[str, Any] = Depends(require_permission("flags:view")),
    scope_filter: ScopeFilter = Depends(get_scope_filter),
) -> SummaryResponse:
    """Returns summary KPIs, evaluation metrics, and visit outcomes scoped to user."""
    conn = get_connection()
    try:
        target_week = week or get_latest_week(conn)

        # Ensure scores exist for this week
        score_count = conn.execute(
            "SELECT count(*) FROM scores WHERE week_start = ?;",
            (target_week,),
        ).fetchone()[0]
        if score_count == 0:
            run_pipeline_for_week(week_start=target_week)

        scope_sql, scope_params = scope_filter.sql_filter("s")

        # Monitored shops count in scope
        monitored = conn.execute(
            f"SELECT count(*) FROM shops s WHERE {scope_sql};",
            tuple(scope_params),
        ).fetchone()[0]

        # Band counts in scope
        high_count = conn.execute(
            f"""
            SELECT count(*)
            FROM scores sc
            JOIN shops s ON sc.shop_id = s.shop_id
            WHERE sc.week_start = ? AND sc.band = 'high' AND {scope_sql};
            """,
            tuple([target_week] + scope_params),
        ).fetchone()[0]

        med_count = conn.execute(
            f"""
            SELECT count(*)
            FROM scores sc
            JOIN shops s ON sc.shop_id = s.shop_id
            WHERE sc.week_start = ? AND sc.band = 'medium' AND {scope_sql};
            """,
            tuple([target_week] + scope_params),
        ).fetchone()[0]
        flagged = high_count + med_count

        # Visits recorded and confirmed rate in scope
        v_total = conn.execute(
            f"""
            SELECT count(*)
            FROM feedback fb
            JOIN shops s ON fb.shop_id = s.shop_id
            WHERE fb.week_start = ? AND {scope_sql};
            """,
            tuple([target_week] + scope_params),
        ).fetchone()[0]

        if v_total > 0:
            v_conf = conn.execute(
                f"""
                SELECT count(*)
                FROM feedback fb
                JOIN shops s ON fb.shop_id = s.shop_id
                WHERE fb.week_start = ? AND fb.outcome = 'confirmed' AND {scope_sql};
                """,
                tuple([target_week] + scope_params),
            ).fetchone()[0]
            conf_rate = round(float(v_conf) / float(v_total), 3)
        else:
            conf_rate = None

        # Evaluation metrics against ground_truth
        gt_rows = conn.execute(
            """
            SELECT sc.risk_score, gt.is_positive, gt.scenario
            FROM scores sc
            JOIN ground_truth gt ON sc.shop_id = gt.shop_id
            WHERE sc.week_start = ?
            ORDER BY sc.risk_score DESC;
            """,
            (target_week,),
        ).fetchall()

        k = conn.execute("SELECT sum(is_positive) FROM ground_truth;").fetchone()[0] or 1
        two_k = min(len(gt_rows), 2 * k)

        top_k = gt_rows[:k]
        top_2k = gt_rows[:two_k]

        tp_k = sum(r["is_positive"] for r in top_k)
        tp_2k = sum(r["is_positive"] for r in top_2k)
        fa_outage = sum(1 for r in top_2k if r["scenario"] == "S7" and r["is_positive"] == 0)

        p_at_k = round(tp_k / float(k), 3) if k > 0 else 0.0
        r_at_2k = round(tp_2k / float(k), 3) if k > 0 else 0.0
        fa_rate = round(fa_outage / float(two_k), 3) if two_k > 0 else 0.0

        eval_summary = EvaluationSummary(
            on_synthetic_data=True,
            precision_at_k=p_at_k,
            recall_at_2k=r_at_2k,
            outage_false_alarm_rate=fa_rate,
            k=int(k),
        )

        # Overdue and open cases
        cfg = load_config()
        overdue_days = cfg.get("cases", {}).get("overdue_days", 7)
        scope_case_sql, scope_case_params = scope_filter.sql_case_filter("c", "s")
        open_cases_rows = conn.execute(
            f"""
            SELECT c.status, c.last_action_at, c.created_at
            FROM cases c
            JOIN shops s ON c.shop_id = s.shop_id
            WHERE {scope_case_sql} AND c.status != 'closed' AND c.closed_at IS NULL;
            """,
            scope_case_params,
        ).fetchall()
        open_cases_cnt = len(open_cases_rows)
        overdue_cases_cnt = sum(
            1
            for r in open_cases_rows
            if is_overdue_check(
                r["status"], r["last_action_at"] or r["created_at"], overdue_days
            )
        )

        return SummaryResponse(
            week=target_week,
            shops_monitored=monitored,
            flagged=flagged,
            high=high_count,
            medium=med_count,
            open_cases=open_cases_cnt,
            overdue_cases=overdue_cases_cnt,
            evaluation=eval_summary,
            visits_recorded=v_total,
            confirmed_rate=conf_rate,
        )
    finally:
        conn.close()


@router.get("/shops/ranked", response_model=RankedShopsResponse)
def get_ranked_shops(
    week: Optional[str] = Query(default=None),
    district: Optional[str] = Query(default=None),
    taluka: Optional[str] = Query(default=None),
    band: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: Dict[str, Any] = Depends(require_permission("flags:view")),
    scope_filter: ScopeFilter = Depends(get_scope_filter),
) -> RankedShopsResponse:
    """Returns ranked list of shops sorted by risk score descending within user's scope."""
    # 404 if client queries for area outside user scope
    scope_filter.validate_requested_area(district=district, taluka=taluka)

    conn = get_connection()
    try:
        target_week = week or get_latest_week(conn)

        where_clauses = ["sc.week_start = ?"]
        params: List[Any] = [target_week]

        # Scope restriction
        scope_sql, scope_params = scope_filter.sql_filter("s")
        where_clauses.append(scope_sql)
        params.extend(scope_params)

        if district:
            where_clauses.append("s.district = ?")
            params.append(district)
        if taluka:
            where_clauses.append("s.taluka = ?")
            params.append(taluka)
        if band:
            where_clauses.append("sc.band = ?")
            params.append(band)
        else:
            where_clauses.append("sc.band IN ('high', 'medium')")

        where_sql = " AND ".join(where_clauses)

        count_sql = f"""
            SELECT count(*)
            FROM scores sc
            JOIN shops s ON sc.shop_id = s.shop_id
            WHERE {where_sql};
        """
        total = conn.execute(count_sql, tuple(params)).fetchone()[0]

        query_sql = f"""
            WITH ranked AS (
                SELECT
                    sc.shop_id, sc.week_start, sc.risk_score, sc.band, sc.breakdown_json,
                    s.name, s.district, s.taluka,
                    ROW_NUMBER() OVER (ORDER BY sc.risk_score DESC) as overall_rank
                FROM scores sc
                JOIN shops s ON sc.shop_id = s.shop_id
                WHERE sc.week_start = ?
            )
            SELECT r.*, c.case_id, c.status as case_status, c.assignee_id, u.name as assignee_name
            FROM ranked r
            JOIN shops s ON r.shop_id = s.shop_id
            JOIN scores sc ON r.shop_id = sc.shop_id AND r.week_start = sc.week_start
            LEFT JOIN cases c ON r.shop_id = c.shop_id
                AND c.status != 'closed' AND c.closed_at IS NULL
            LEFT JOIN users u ON c.assignee_id = u.user_id
            WHERE {where_sql}
            ORDER BY r.risk_score DESC
            LIMIT ? OFFSET ?;
        """
        full_params = [target_week] + params + [limit, offset]
        rows = conn.execute(query_sql, tuple(full_params)).fetchall()

        shop_ids = [r["shop_id"] for r in rows]
        trend_map: Dict[str, List[float]] = {s_id: [] for s_id in shop_ids}

        if shop_ids:
            placeholders = ",".join("?" for _ in shop_ids)
            trend_rows = conn.execute(
                f"""
                SELECT shop_id, week_start, risk_score
                FROM scores
                WHERE shop_id IN ({placeholders}) AND week_start <= ?
                ORDER BY shop_id, week_start;
                """,
                tuple(shop_ids + [target_week]),
            ).fetchall()

            for tr in trend_rows:
                s_id = tr["shop_id"]
                trend_map[s_id].append(float(tr["risk_score"]))

            for s_id in trend_map:
                trend_map[s_id] = trend_map[s_id][-8:]

        items: List[RankedShopItem] = []
        for r in rows:
            s_id = r["shop_id"]
            breakdown = json.loads(r["breakdown_json"])
            signals = [
                SignalSummary(key=b["key"], label=b["label"], points=b["points"])
                for b in breakdown
                if b["key"] != "vulnerability_uplift" and b["points"] > 0
            ]
            signals.sort(key=lambda x: x.points, reverse=True)
            top_sigs = signals[:3]

            case_info = None
            if r["case_id"]:
                case_info = CaseSummary(
                    case_id=r["case_id"],
                    status=r["case_status"],
                    assignee_id=r["assignee_id"],
                    assignee_name=r["assignee_name"],
                )

            items.append(
                RankedShopItem(
                    rank=r["overall_rank"],
                    shop_id=s_id,
                    name=r["name"],
                    district=r["district"],
                    taluka=r["taluka"],
                    risk_score=float(r["risk_score"]),
                    band=r["band"],
                    top_signals=top_sigs,
                    trend=trend_map.get(s_id, [float(r["risk_score"])]),
                    case=case_info,
                )
            )

        return RankedShopsResponse(
            week=target_week,
            total=total,
            items=items,
        )
    finally:
        conn.close()


@router.get("/shops/{shop_id}", response_model=ShopDetailResponse)
def get_shop_detail(
    shop_id: str,
    week: Optional[str] = Query(default=None),
    current_user: Dict[str, Any] = Depends(require_permission("flags:view")),
    scope_filter: ScopeFilter = Depends(get_scope_filter),
) -> ShopDetailResponse:
    """Returns detailed audit file for a single shop within user scope (404 if out of scope)."""
    conn = get_connection()
    try:
        # Enforce scope check; raises 404 if out of scope or nonexistent
        scope_filter.require_shop_in_scope(conn, shop_id)

        target_week = week or get_latest_week(conn)
        shop_row = conn.execute("SELECT * FROM shops WHERE shop_id = ?;", (shop_id,)).fetchone()

        score_row = conn.execute(
            """
            WITH ranked AS (
                SELECT shop_id, risk_score, band, breakdown_json,
                       ROW_NUMBER() OVER (ORDER BY risk_score DESC) as overall_rank
                FROM scores
                WHERE week_start = ?
            )
            SELECT * FROM ranked WHERE shop_id = ?;
            """,
            (target_week, shop_id),
        ).fetchone()

        if not score_row:
            run_pipeline_for_week(week_start=target_week)
            score_row = conn.execute(
                """
                WITH ranked AS (
                    SELECT shop_id, risk_score, band, breakdown_json,
                           ROW_NUMBER() OVER (ORDER BY risk_score DESC) as overall_rank
                    FROM scores
                    WHERE week_start = ?
                )
                SELECT * FROM ranked WHERE shop_id = ?;
                """,
                (target_week, shop_id),
            ).fetchone()

        risk_score = float(score_row["risk_score"])
        band = score_row["band"]
        overall_rank = score_row["overall_rank"]
        breakdown_raw = json.loads(score_row["breakdown_json"])
        breakdown_items = [BreakdownItem(**b) for b in breakdown_raw]

        week_row = conn.execute(
            "SELECT * FROM shop_weeks WHERE shop_id = ? AND week_start = ?;",
            (shop_id, target_week),
        ).fetchone()

        if week_row:
            opening = float(week_row["stock_opening_kg"])
            received = float(week_row["stock_received_kg"])
            sold = float(week_row["stock_sold_kg"])
            closing = float(week_row["stock_closing_kg"])
            board_kg = float(week_row["board_distributed_kg"])

            expected_closing = opening + received - sold
            gap_kg = round(expected_closing - closing, 1)
            base_stock = max(opening + received, 1.0)
            gap_pct = round((abs(gap_kg) / base_stock) * 100.0, 2)
            direction = "shortfall" if gap_kg >= 0 else "surplus"

            stock_recon = StockReconciliation(
                opening_kg=opening,
                received_kg=received,
                sold_kg=sold,
                closing_kg=closing,
                gap_kg=gap_kg,
                gap_pct=gap_pct,
                direction=direction,
            )

            mismatch_diff = board_kg - sold
            mismatch_pct = round((abs(mismatch_diff) / max(sold, 1.0)) * 100.0, 2)
            board_check = BoardCheck(
                board_kg=board_kg,
                sold_kg=sold,
                mismatch_pct=mismatch_pct,
            )
        else:
            stock_recon = StockReconciliation(
                opening_kg=0.0, received_kg=0.0, sold_kg=0.0, closing_kg=0.0,
                gap_kg=0.0, gap_pct=0.0, direction="shortfall",
            )
            board_check = BoardCheck(board_kg=0.0, sold_kg=0.0, mismatch_pct=0.0)

        comp_rows = conn.execute(
            """
            SELECT category, count(*) as cnt
            FROM complaints
            WHERE shop_id = ? AND week_start = ?
            GROUP BY category
            ORDER BY cnt DESC;
            """,
            (shop_id, target_week),
        ).fetchall()
        complaints_list = [
            ComplaintCategoryCount(category=r["category"], count=r["cnt"]) for r in comp_rows
        ]

        hist_rows = conn.execute(
            """
            SELECT week_start,
                   stock_opening_kg,
                   stock_received_kg,
                   stock_sold_kg,
                   stock_closing_kg,
                   board_distributed_kg,
                   transactions,
                   auth_attempts,
                   auth_failures,
                   unauth_sales,
                   complaints_count
            FROM shop_weeks
            WHERE shop_id = ? AND week_start <= ?
            ORDER BY week_start DESC
            LIMIT 8;
            """,
            (shop_id, target_week),
        ).fetchall()
        hist_rows = list(reversed(hist_rows))
        weeks_list = [r["week_start"] for r in hist_rows]

        taluka = shop_row["taluka"]
        peer_medians_auth: List[float] = []
        peer_medians_gap: List[float] = []
        peer_medians_board: List[float] = []
        peer_medians_unauth: List[float] = []
        peer_medians_comp: List[float] = []

        for w in weeks_list:
            pm_row = conn.execute(
                """
                SELECT
                    avg(auth_failures * 1.0 / max(auth_attempts, 1)) as auth_fail,
                    avg(
                        abs(stock_opening_kg + stock_received_kg - stock_sold_kg - stock_closing_kg)
                        * 1.0 / max(stock_opening_kg + stock_received_kg, 1.0)
                    ) as stock_gap,
                    avg(
                        abs(board_distributed_kg - stock_sold_kg) * 1.0 / max(stock_sold_kg, 1.0)
                    ) as board_mismatch,
                    avg(unauth_sales * 1.0 / max(transactions, 1)) as unauth_share,
                    avg(complaints_count * 100.0 / max(transactions, 1)) as complaints_rate
                FROM shop_weeks sw
                JOIN shops s ON sw.shop_id = s.shop_id
                WHERE sw.week_start = ? AND s.taluka = ? AND s.shop_id != ?;
                """,
                (w, taluka, shop_id),
            ).fetchone()

            p_auth = (
                float(pm_row["auth_fail"])
                if pm_row and pm_row["auth_fail"] is not None
                else 0.30
            )
            p_gap = (
                float(pm_row["stock_gap"])
                if pm_row and pm_row["stock_gap"] is not None
                else 0.005
            )
            p_board = (
                float(pm_row["board_mismatch"])
                if pm_row and pm_row["board_mismatch"] is not None
                else 0.005
            )
            p_unauth = (
                float(pm_row["unauth_share"])
                if pm_row and pm_row["unauth_share"] is not None
                else 0.02
            )
            p_comp = (
                float(pm_row["complaints_rate"])
                if pm_row and pm_row["complaints_rate"] is not None
                else 0.0
            )

            peer_medians_auth.append(round(p_auth * 100.0, 1))
            peer_medians_gap.append(round(p_gap * 100.0, 1))
            peer_medians_board.append(round(p_board * 100.0, 1))
            peer_medians_unauth.append(round(p_unauth * 100.0, 1))
            peer_medians_comp.append(round(p_comp, 2))

        shop_auth_series: List[float] = []
        shop_gap_series: List[float] = []
        shop_board_series: List[float] = []
        shop_unauth_series: List[float] = []
        shop_comp_series: List[float] = []

        for r in hist_rows:
            att = max(float(r["auth_attempts"]), 1.0)
            shop_auth_series.append(round((float(r["auth_failures"]) / att) * 100.0, 1))

            op = float(r["stock_opening_kg"])
            rec = float(r["stock_received_kg"])
            sold = float(r["stock_sold_kg"])
            clo = float(r["stock_closing_kg"])
            base_stock = max(op + rec, 1.0)
            gap = (abs(op + rec - sold - clo) / base_stock) * 100.0
            shop_gap_series.append(round(gap, 2))

            board = float(r["board_distributed_kg"])
            b_mismatch = (abs(board - sold) / max(sold, 1.0)) * 100.0
            shop_board_series.append(round(b_mismatch, 2))

            tx = max(float(r["transactions"]), 1.0)
            unauth = (float(r["unauth_sales"]) / tx) * 100.0
            shop_unauth_series.append(round(unauth, 2))

            comp = float(r["complaints_count"]) * 100.0 / tx
            shop_comp_series.append(round(comp, 2))

        history_payload = HistoryData(
            weeks=weeks_list,
            series={
                "auth_fail_rate": SeriesData(
                    shop=shop_auth_series,
                    peer_median=peer_medians_auth,
                ),
                "stock_gap_pct": SeriesData(
                    shop=shop_gap_series,
                    peer_median=peer_medians_gap,
                ),
                "board_mismatch_pct": SeriesData(
                    shop=shop_board_series,
                    peer_median=peer_medians_board,
                ),
                "unauth_share": SeriesData(
                    shop=shop_unauth_series,
                    peer_median=peer_medians_unauth,
                ),
                "complaints_rate": SeriesData(
                    shop=shop_comp_series,
                    peer_median=peer_medians_comp,
                ),
            },
        )

        expl_row = conn.execute(
            "SELECT * FROM explanations WHERE shop_id = ? AND week_start = ?;",
            (shop_id, target_week),
        ).fetchone()

        if expl_row:
            expl_json = json.loads(expl_row["payload_json"])
            expl_data = ExplanationData(
                source=expl_row["source"],
                reason=expl_json["reason"],
                evidence=[EvidenceItem(**e) for e in expl_json.get("evidence", [])],
                checklist=[ChecklistItem(**c) for c in expl_json.get("checklist", [])],
            )
        else:
            t_expl = generate_template_explanation(
                breakdown_raw,
                stock_recon.model_dump(),
                board_check.model_dump(),
            )
            expl_data = ExplanationData(
                source=t_expl["source"],
                reason=t_expl["reason"],
                evidence=[EvidenceItem(**e) for e in t_expl["evidence"]],
                checklist=[ChecklistItem(**c) for c in t_expl["checklist"]],
            )

        fb_rows = conn.execute(
            """
            SELECT outcome, note, created_at
            FROM feedback
            WHERE shop_id = ?
            ORDER BY created_at DESC;
            """,
            (shop_id,),
        ).fetchall()
        feedback_list = [
            FeedbackItem(outcome=r["outcome"], note=r["note"], created_at=r["created_at"])
            for r in fb_rows
        ]

        case_row = conn.execute(
            """
            SELECT c.case_id, c.status, c.assignee_id, u.name as assignee_name
            FROM cases c
            LEFT JOIN users u ON c.assignee_id = u.user_id
            WHERE c.shop_id = ? AND c.status != 'closed' AND c.closed_at IS NULL
            ORDER BY c.created_at DESC LIMIT 1;
            """,
            (shop_id,),
        ).fetchone()

        case_summary = None
        if case_row:
            case_summary = CaseSummary(
                case_id=case_row["case_id"],
                status=case_row["status"],
                assignee_id=case_row["assignee_id"],
                assignee_name=case_row["assignee_name"],
            )

        shop_meta = ShopMeta(
            shop_id=shop_row["shop_id"],
            name=shop_row["name"],
            district=shop_row["district"],
            taluka=shop_row["taluka"],
            cards_count=shop_row["cards_count"],
            vulnerability_index=float(shop_row["vulnerability_index"]),
            inspector_id=shop_row["inspector_id"],
        )

        return ShopDetailResponse(
            shop=shop_meta,
            week=target_week,
            risk_score=risk_score,
            band=band,
            rank=overall_rank,
            breakdown=breakdown_items,
            history=history_payload,
            stock_reconciliation=stock_recon,
            board_check=board_check,
            complaints=complaints_list,
            explanation=expl_data,
            feedback=feedback_list,
            case=case_summary,
        )
    finally:
        conn.close()


@router.post("/run", response_model=RunResponse, dependencies=[Depends(verify_csrf)])
def post_run(
    body: Optional[RunRequest] = None,
    current_user: Dict[str, Any] = Depends(require_permission("run:execute")),
) -> RunResponse:
    """Triggers an audit run for a specific week (admin only)."""
    week = body.week if body else None
    top_k = body.top_k if body and body.top_k is not None else 20
    res = run_pipeline_for_week(week_start=week, top_k=top_k)
    return RunResponse(
        run_id=res["run_id"],
        week=res["week"],
        shops_scored=res["shops_scored"],
        explained=res["explained"],
        cases_created=res.get("cases_created", 0),
        cases_updated=res.get("cases_updated", 0),
        duration_ms=res["duration_ms"],
    )


@router.post(
    "/shops/{shop_id}/feedback",
    response_model=FeedbackResponse,
    dependencies=[Depends(verify_csrf)],
)
def post_feedback(
    shop_id: str,
    body: FeedbackRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    scope_filter: ScopeFilter = Depends(get_scope_filter),
) -> FeedbackResponse:
    """Stores officer visit outcome feedback for a shop within user scope."""
    conn = get_connection()
    try:
        # Enforce scope check; raises 404 if out of scope or nonexistent
        scope_filter.require_shop_in_scope(conn, shop_id)

        created_at = datetime.now(timezone.utc).isoformat()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO feedback (shop_id, week_start, outcome, note, created_at)
            VALUES (?, ?, ?, ?, ?);
            """,
            (shop_id, body.week, body.outcome, body.note, created_at),
        )
        conn.commit()
        fb_id = int(cursor.lastrowid or 0)

        return FeedbackResponse(
            id=fb_id,
            shop_id=shop_id,
            week_start=body.week,
            outcome=body.outcome,
            note=body.note,
            created_at=created_at,
        )
    finally:
        conn.close()
