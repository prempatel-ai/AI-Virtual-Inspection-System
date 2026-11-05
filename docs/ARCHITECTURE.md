# ARCHITECTURE.md

## Flow
```
synthetic data (SQLite)
   -> features        per shop-week rates and gaps
   -> anomaly         robust z vs own past and vs peers      (rate signals)
   -> checks          stock gap, board mismatch              (hard signals)
   -> scoring         weighted points + vulnerability uplift -> score, band, breakdown
   -> ranking         per week, filterable
   -> explanation     top-K only: facts -> Groq -> validate -> (else template)
   -> API (FastAPI) -> Next.js UI -> officer records outcome -> feedback table
```
Detection and scoring are deterministic code. The LLM only words facts already computed.

## Data model (SQLite)
- `shops(shop_id PK, name, district, taluka, cards_count, vulnerability_index)`
- `shop_weeks(shop_id, week_start, transactions, auth_attempts, auth_failures, unauth_sales, complaints_count, stock_opening_kg, stock_received_kg, stock_sold_kg, stock_closing_kg, board_distributed_kg, PK(shop_id, week_start))`
- `complaints(id PK, shop_id, week_start, category)`
- `ground_truth(shop_id PK, scenario, is_positive)` evaluation only, never in shop-level API
- `runs(run_id PK, week_start, started_at, duration_ms, shops_scored, explained)`
- `scores(shop_id, week_start, risk_score, band, breakdown_json, run_id, PK(shop_id, week_start))`
- `explanations(shop_id, week_start, source, payload_json, facts_hash, created_at)`
- `feedback(id PK, shop_id, week_start, outcome, note, created_at)`

## Signals
| key | kind | definition |
|---|---|---|
| `auth_fail_rate` | rate | auth_failures / auth_attempts |
| `unauth_share` | rate | unauth_sales / transactions |
| `complaints_rate` | rate | complaints_count per 100 transactions |
| `stock_gap_pct` | hard | abs(opening + received - sold - closing) / (opening + received) x 100 |
| `board_mismatch_pct` | hard | abs(board_distributed - sold) / sold x 100 |

## Anomaly (rate signals)
- Robust z: `z = (x - median) / max(1.4826 * MAD, min_scale[signal])`. High is bad.
- Own baseline: the shop's previous `own_window` weeks (default 8, minimum 4, current week excluded). If fewer than 4 weeks exist, `z_own = z_peer`.
- Peer baseline: same week, same taluka, same size band (3 bands by `cards_count` tertile), self excluded. If fewer than `min_peers` (5) peers, widen to the district.
- Signal strength: `s = clip(min(z_own, z_peer) / z_cap, 0, 1)`, `z_cap` default 4.
- Using the minimum means a shop must be unusual against both its own past and its peers. An area-wide outage lifts peers too, so `z_peer` stays low and the flag is not raised.
- Known limitation: a chronically bad shop whose own history is also bad can be under-flagged. Log as a known gap; do not fix in the MVP.

## Hard signals
`s = clip((v - low) / (high - low), 0, 1)` with `low` and `high` per signal in `config.yaml`. Starting values (assumptions, A-008): stock_gap 2 to 10 percent, board_mismatch 5 to 20 percent. Direction (shortfall or surplus) is kept for the explanation.

## Scoring
- `base = 100 * sum(w_i * s_i) / sum(w_i)`
- `final = min(100, base * (1 + vuln_uplift * vulnerability_index))`, `vuln_uplift` default 0.25
- Breakdown lines: one per signal with `points_i = 100 * w_i * s_i / sum(w)`, plus one `vulnerability_uplift` line equal to `final - base` (after the cap). The lines sum to `final` exactly.
- Starting weights (A-008): stock_gap_pct 0.30, board_mismatch_pct 0.20, unauth_share 0.20, complaints_rate 0.15, auth_fail_rate 0.15.
- Bands: high >= 60, medium >= 30, low below 30. Flagged = medium or high.
- Everything tunable is in `backend/config.yaml`.

## LLM explanation (Groq)
Runs for the top K shops of a run (default 20). Others get the template explanation.

**Facts payload** (JSON, one shop-week): shop meta, score, band, each breakdown line with raw value, own median, peer median, z, points; stock reconciliation numbers; board check numbers; last 4 weeks of key signals; complaint counts by category. Every value has a `fact_id`. The payload contains every number the text may use.

**Prompt rules:** use only the facts given; say "possible" and "needs verification", never accuse; no numbers that are not in the payload; temperature 0; JSON-only output; timeout 10 s, 2 retries.

**Output schema:**
```json
{
  "reason": "string, 2 to 3 sentences",
  "evidence": [{"fact_id": "string", "statement": "string"}],
  "checklist": [{"action": "string", "why": "string", "fact_id": "string"}]
}
```

**Validation (`validate.py`)**
1. Schema valid.
2. Every `fact_id` exists in the payload.
3. Every number in any text field appears in the payload (same value after rounding to the payload's precision).
4. Checklist is not empty and has at most 6 items.
Any failure: discard the LLM output and use the template. Record `source: "template"`.

**Template (`templates.py`):** deterministic text from the top 3 breakdown lines plus `checklists.yaml` (verification steps per signal). The same facts, same schema.

**Cache:** key `(shop_id, week_start, facts_hash)`.

## Run
`POST /run` for a week: build features for that week plus history, score all shops, persist `scores`, evaluate against `ground_truth`, then explain top K. Idempotent per week.

## Performance targets (measure; log misses in MEMORY.md)
- Generate 17,000 shops x 12 weeks: within 120 s on a laptop.
- Run one week for 17,000 shops, no LLM: within 60 s. Use vectorised pandas, not per-shop loops.
- `GET /shops/ranked` after a run: p95 within 300 ms.

## Security (demo)
No auth. CORS limited to localhost. No secrets in the repo. `.env` ignored.

## Repo layout
See `CLAUDE.md`.
