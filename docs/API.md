# API.md

FastAPI, JSON, no auth. Base `http://localhost:8000`. Schemas are Pydantic models in `backend/app/schemas.py`; the frontend generates its types from `/openapi.json` (`make types`).
Errors: `{"error": {"code": "string", "message": "string"}}` with a proper HTTP status.
`week` is a Monday date `YYYY-MM-DD`; default is the latest week.

## GET /health
`{"status": "ok"}`

## GET /meta
```json
{"synthetic": true, "weeks": ["2026-08-17"], "latest_week": "2026-11-02",
 "districts": ["Ahmedabad"], "talukas": {"Ahmedabad": ["Ahmedabad Taluka 1"]},
 "shops_count": 500, "has_run": true}
```

## GET /summary?week=
```json
{"week": "2026-11-02", "shops_monitored": 500, "flagged": 24, "high": 9, "medium": 15,
 "evaluation": {"on_synthetic_data": true, "precision_at_k": 0.0, "recall_at_2k": 0.0,
                "outage_false_alarm_rate": 0.0, "k": 0},
 "visits_recorded": 0, "confirmed_rate": null}
```
`confirmed_rate` is null until at least one outcome is recorded.

## GET /shops/ranked?week=&district=&taluka=&band=&limit=50&offset=0
```json
{"week": "2026-11-02", "total": 24, "items": [
  {"rank": 1, "shop_id": "FPS-00012", "name": "Shop FPS-00012",
   "district": "Mehsana", "taluka": "Mehsana Taluka 3",
   "risk_score": 78.4, "band": "high",
   "top_signals": [{"key": "stock_gap_pct", "label": "Stock gap", "points": 30.0}],
   "trend": [12.1, 15.0, 22.3, 41.0, 55.2, 61.0, 70.5, 78.4]}]}
```
Sorted by `risk_score` descending. Shops below the low band are included only when `band=low` is requested.

## GET /shops/{shop_id}?week=
```json
{"shop": {"shop_id": "", "name": "", "district": "", "taluka": "", "cards_count": 0,
          "vulnerability_index": 0.0},
 "week": "", "risk_score": 0.0, "band": "high", "rank": 1,
 "breakdown": [{"key": "stock_gap_pct", "label": "Stock gap", "points": 0.0, "value": 0.0,
                "unit": "%", "own_median": null, "peer_median": null, "z": null}],
 "history": {"weeks": [], "series": {"auth_fail_rate": {"shop": [], "peer_median": []}}},
 "stock_reconciliation": {"opening_kg": 0, "received_kg": 0, "sold_kg": 0, "closing_kg": 0,
                          "gap_kg": 0, "gap_pct": 0.0, "direction": "shortfall"},
 "board_check": {"board_kg": 0, "sold_kg": 0, "mismatch_pct": 0.0},
 "complaints": [{"category": "denied ration", "count": 0}],
 "explanation": {"source": "groq", "reason": "", "evidence": [{"fact_id": "", "statement": ""}],
                 "checklist": [{"action": "", "why": "", "fact_id": ""}]},
 "feedback": [{"outcome": "confirmed", "note": "", "created_at": ""}]}
```
`breakdown` includes the `vulnerability_uplift` line. Points sum to `risk_score`. `explanation.source` is `groq` or `template`. Never includes ground-truth labels.

## POST /run
Request `{"week": "2026-11-02", "top_k": 20}` (both optional). Scores all shops for the week, evaluates, explains the top K.
```json
{"run_id": 1, "week": "", "shops_scored": 500, "explained": 20, "duration_ms": 0}
```

## POST /shops/{shop_id}/feedback
Request `{"week": "", "outcome": "confirmed" | "not_confirmed", "note": "optional, max 500 chars"}`.
Response: the stored feedback record. 404 for an unknown shop, 422 for a bad outcome.
