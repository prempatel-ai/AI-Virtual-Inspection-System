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
   -> case creation   in POST /run: flagged shops create/update cases in cases table
   -> Auth & RBAC     argon2, JWT cookie, CSRF check, central permission table, scope filter
   -> API (FastAPI)   -> Next.js UI -> officer acts -> case_actions & audit_log (append-only)
```
Detection and scoring are deterministic code. The LLM only words facts already computed.
V2 adds authentication, authorization (RBAC), cases lifecycle, append-only action audit trail, and oversight screens.

## Data model (SQLite)
- `users(user_id PK, name, email UNIQUE, password_hash, role, district NULL, taluka NULL, is_active, last_login_at, created_at)`
- `shops(shop_id PK, name, district, taluka, cards_count, vulnerability_index, inspector_id FK users)`
- `shop_weeks(shop_id, week_start, transactions, auth_attempts, auth_failures, unauth_sales, complaints_count, stock_opening_kg, stock_received_kg, stock_sold_kg, stock_closing_kg, board_distributed_kg, PK(shop_id, week_start))`
- `complaints(id PK, shop_id, week_start, category)`
- `ground_truth(shop_id PK, scenario, is_positive)` evaluation only, never in shop-level API or screens
- `runs(run_id PK, week_start, started_at, duration_ms, shops_scored, explained)`
- `scores(shop_id, week_start, risk_score, band, breakdown_json, run_id, PK(shop_id, week_start))`
- `explanations(shop_id, week_start, source, payload_json, facts_hash, created_at)`
- `cases(case_id PK, shop_id, status, assignee_id NULL, risk_score_latest, band_latest, opened_week, last_flagged_week, closed_at NULL, last_action_at, created_at)`
- `case_actions(id PK, case_id, actor_id NULL, actor_role, type, payload_json, risk_score_at_action, created_at)`: SQLite triggers block UPDATE and DELETE.
- `audit_log(id PK, event, actor_id NULL, target_user_id NULL, ip, detail_json, created_at)`: SQLite triggers block UPDATE and DELETE.
- Note: V1 `feedback` table is migrated into `case_actions` and removed.

## Authentication and Sessions (V2)
- Passwords hashed with `argon2-cffi`. Never stored or returned in plaintext.
- Session: Signed JWT (`PyJWT`, HS256, secret from `JWT_SECRET` env; fails on startup if missing) in `HttpOnly`, `SameSite=Lax` cookie (`Secure` when served over HTTPS).
- Session re-validation: Every incoming request verifies the JWT and re-reads the active user record from the SQLite database. Deactivating a user terminates access immediately.
- State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) require `X-Requested-With: fetch` and a JSON body.
- Failed logins return a single generic message without user enumeration. Account locks for 15 minutes after 5 consecutive failures for an email. All attempts logged to `audit_log`.
- Deny by default: All endpoints require authentication except `GET /health` and `POST /auth/login`.

## Authorization and Scope Filtering (V2)
- One central permission table mapping roles (`inspector`, `mamlatdar`, `district_officer`, `vigilance`, `admin`) to actions.
- Enforced via a single shared FastAPI dependency (`require_permission`) and single shared scope filter (`scope_filter`).
- Roles and Scope:
  - `inspector`: only cases/shops assigned to them.
  - `mamlatdar`: all shops/cases in their taluka.
  - `district_officer`: all shops/cases in their district.
  - `vigilance`: whole state, read-only plus notes; can receive escalated cases.
  - `admin`: whole state, user management, audit log, run execution; does not record inspection findings.
- Out-of-scope records return **404**, not 403, preventing existence leaks.
- Action authorization for case execution (`cases:act`): Only the case's current assignee can start an inspection or record an outcome. The API returns `allowed_actions` in the case detail response.

## Cases and State Machine (V2)
- Cases are created and updated inside `POST /run`:
  1. Flagged shop (score >= 30, band medium or high) with no open case creates a case, assigned to the shop's `inspector_id` (`assigned`). If inspector is inactive, falls back to the taluka Mamlatdar. If unassigned, status is `new`.
  2. Flagged shop with existing open case updates `risk_score_latest`, `band_latest`, and `last_flagged_week`.
  3. Open case whose shop is no longer flagged remains open (labeled "no longer flagged") until officers close it.
  4. Closed case whose shop is flagged again creates a new case.
- Statuses: `new`, `assigned`, `in_progress`, `inspected`, `escalated`, `closed`.
- Transitions enforced server-side (invalid transitions return **409 Conflict**):
  - `start_inspection`: `assigned` | `escalated` -> `in_progress` (assignee only).
  - `record_outcome`: `in_progress` -> `inspected` (assignee only).
  - `add_note`: any status -> unchanged.
  - `escalate`: `assigned` | `in_progress` | `inspected` | `escalated` -> `escalated` (inspector -> mamlatdar -> district_officer -> vigilance).
  - `reassign`: `new` | `assigned` | `in_progress` | `escalated` -> `assigned`.
  - `close`: `inspected` | `escalated` with recorded outcome -> `closed`.
  - `reopen`: `closed` -> `assigned`.
- Overdue logic: Open cases with no officer action for more than 7 days (`cases.overdue_days`) since assignment or last action.

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
- Own baseline: previous `own_window` weeks (default 8, min 4). If < 4 weeks, `z_own = z_peer`.
- Peer baseline: same week, same taluka, same size band (`cards_count` tertile), self excluded. If < 5 peers, widen to district.
- Signal strength: `s = clip(min(z_own, z_peer) / z_cap, 0, 1)`, `z_cap` default 4.
- Outage trap: Area-wide issues lift peers, keeping `z_peer` low and suppressing false alarms.

## Hard signals
`s = clip((v - low) / (high - low), 0, 1)` with `low` and `high` per signal in `config.yaml`. Direction is recorded.

## Scoring
- `base = 100 * sum(w_i * s_i) / sum(w_i)`
- `final = min(100, base * (1 + vuln_uplift * vulnerability_index))`
- Breakdown lines sum to `final` exactly, including `vulnerability_uplift`.
- Tunables in `backend/config.yaml`.

## LLM explanation (Groq)
Top K shops of a run get Groq LLM explanations based strictly on the structured facts payload with fact IDs. Failsafe validation falls back to deterministic template if Groq is unavailable, invalid, or invents numbers.

## Metrics Module (`backend/app/metrics.py`)
Single shared calculation module covered by golden tests:
- Area flag rate & high-band rate.
- Open cases and overdue counts.
- Confirmed rate: `confirmed` outcomes / total recorded outcomes.
- Time to first action: median hours from case assignment to first officer action.
- Officer stats: assigned, open, inspected, closed, confirmed rate, median time to first action, last action date.

## Performance targets
- Generate 17,000 shops x 12 weeks: < 120 s.
- Run one week for 17,000 shops: < 60 s.
- Scoped API endpoints p95 latency: < 300 ms.
