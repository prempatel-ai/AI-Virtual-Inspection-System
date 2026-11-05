# DATA_SPEC.md

Synthetic data for the demo. Deterministic for a given seed. All shop, officer, and case data are fictional.

## Parameters
`SHOPS` (default 500, max 17000), `WEEKS` (12), `SEED` (42), `START_DATE` (2026-08-17, a Monday). Weeks are Mondays. Target week is the last one.

---

## 1. Entities and Tables

### Shops (`shops`)
Fields: `shop_id PK, name, district, taluka, cards_count, vulnerability_index, inspector_id FK users`.
- `inspector_id`: Assigned synthetic inspector responsible for inspecting this shop.

### Users (`users`)
Fields: `user_id PK, name, email UNIQUE, password_hash, role, district NULL, taluka NULL, is_active, last_login_at NULL, created_at`.
- Roles: `inspector`, `mamlatdar`, `district_officer`, `vigilance`, `admin`.
- Scope:
  - `district` only for `district_officer`.
  - `district` and `taluka` for `mamlatdar` and `inspector`.
  - Both NULL for `vigilance` and `admin` (state-level scope).

### Cases (`cases`)
Fields: `case_id PK, shop_id, status, assignee_id NULL, risk_score_latest, band_latest, opened_week, last_flagged_week, closed_at NULL, last_action_at, created_at`.
- Statuses: `new`, `assigned`, `in_progress`, `inspected`, `escalated`, `closed`.
- One open case per shop. Created / updated automatically during `POST /run`.

### Case Actions (`case_actions`)
Fields: `id PK AUTOINCREMENT, case_id, actor_id NULL, actor_role, type, payload_json, risk_score_at_action, created_at`.
- Append-only. SQLite triggers reject any `UPDATE` or `DELETE`.
- Action types: `create`, `assign`, `start_inspection`, `record_outcome`, `add_note`, `escalate`, `reassign`, `close`, `reopen`.

### Audit Log (`audit_log`)
Fields: `id PK AUTOINCREMENT, event, actor_id NULL, target_user_id NULL, ip, detail_json, created_at`.
- Append-only. SQLite triggers reject any `UPDATE` or `DELETE`.
- Events: `login_success, login_failed, logout, access_denied, user_created, user_updated, user_deactivated, password_reset`.

### Ground Truth (`ground_truth`)
Fields: `shop_id PK, scenario, is_positive`. Used exclusively by `evaluate.py` and test suites. Never surfaced to API or UI.

---

## 2. Weekly Records and Scenarios
(As in V1: `shop_weeks` with rates and hard checks, and planted scenarios S1-S7 plus S8 clean).

---

## 3. Synthetic Users Seeding (`make seed-users`)
- 1 Admin
- 2 Vigilance officers
- 1 District Officer per district
- 1 Mamlatdar per taluka
- Inspectors per taluka = `ceil(shops_in_taluka / inspector_load)` (default `inspector_load = 25`)
- Shops in the taluka are split across its inspectors.
- Emails: `firstname.lastname.n@demo.invalid`. Names from a deterministic fictional list.
- All users initialized with `DEMO_PASSWORD` hashed with argon2.
- Exports `data/demo_users.json` (gitignored) containing sample login emails per role (no plaintext passwords).

---

## 4. Synthetic Activity Simulation (`make seed-activity`)
- Scores the 4 weeks preceding the target week.
- Creates cases according to the lifecycle rules.
- Simulates realistic officer actions:
  - Most cases acted on within a few days.
  - Some left overdue (> 7 days without action).
  - Escalations simulated (inspector -> mamlatdar -> district_officer -> vigilance).
  - Inspection outcomes recorded with confirmed probability ~0.8 for planted positive shops, ~0.15 for clean shops.
  - Target-week cases remain mostly `new` or `assigned` so users can act on them live during demos.
- Ground-truth labels are accessed only internally by the simulator and are never leaked to stored records or responses.

---

## 5. Migration from V1
The legacy `feedback` table is deprecated. Any existing feedback rows are automatically migrated into `case_actions` records with `type = 'record_outcome'`.
