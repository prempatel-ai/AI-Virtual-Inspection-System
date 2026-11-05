# V2_SPEC.md

Version 2: officers, roles, cases, actions, admin oversight. This is the spec for the update. The V1 docs stay valid except where this file overrides them. On conflict, this file wins for V2 features.

All data and users are synthetic.

## 1. Roles and scope
| role | scope (what they can see) | notes |
|---|---|---|
| `inspector` | cases for shops assigned to them | does the visits |
| `mamlatdar` | all shops and cases in their taluka | supervises inspectors |
| `district_officer` | all shops and cases in their district | supervises Mamlatdars |
| `vigilance` | whole state | read-only plus notes; can receive escalated cases |
| `admin` | whole state | manages users, runs the audit, reads the access log; does not record inspection findings |

Out-of-scope records return **404**, not 403, so existence is not leaked.

## 2. Permissions
| permission | inspector | mamlatdar | district_officer | vigilance | admin |
|---|---|---|---|---|---|
| `flags:view` (ranked flags, shop detail) | own shops | taluka | district | state | state |
| `cases:view` | own | taluka | district | state | state |
| `cases:act` (start inspection, record outcome) | assignee only | assignee only | assignee only | assignee only | never |
| `cases:note` | yes | yes | yes | yes | yes |
| `cases:escalate` | yes | yes | yes | no | no |
| `cases:reassign` | no | within taluka | within district | no | anywhere |
| `cases:close` | no | yes | yes | no | yes |
| `cases:reopen` | no | yes | yes | no | yes |
| `officers:view` | self | taluka | district | state | state |
| `areas:view` | no | taluka | district | state | state |
| `actions:view` (action feed) | own | taluka | district | state | state |
| `users:manage` | no | no | no | no | yes |
| `audit:view` (access log) | no | no | no | no | yes |
| `run:execute` | no | no | no | no | yes |

`cases:act` is assignee-based: only the case's current assignee can start an inspection or record an outcome, whatever their role. The server returns the list of actions the current user may take on a case (`allowed_actions`); the frontend renders buttons from it and contains no role logic.

## 3. Cases
A **case** is the work item created when a shop is flagged (band at or above `cases.flag_min_band`, default `medium`). One open case per shop.

**Creation and update (inside `POST /run`):**
1. Shop flagged and no open case: create a case, assign to the shop's `inspector_id` (status `assigned`). If that inspector is inactive, assign to the taluka's Mamlatdar. If nobody is available, status `new`, unassigned.
2. Shop flagged and an open case exists: update `risk_score_latest`, `band_latest`, `last_flagged_week`. Do not create a duplicate.
3. Open case whose shop is no longer flagged: keep it open, show "no longer flagged". Officers close it.
4. Closed case and the shop is flagged again: create a new case.

**Statuses:** `new`, `assigned`, `in_progress`, `inspected`, `escalated`, `closed`.

| action | allowed from | result status | who |
|---|---|---|---|
| `start_inspection` | `assigned`, `escalated` | `in_progress` | assignee |
| `record_outcome` | `in_progress` | `inspected` | assignee |
| `add_note` | any | unchanged | per permission table |
| `escalate` | `assigned`, `in_progress`, `inspected`, `escalated` | `escalated` (assignee becomes next role up) | inspector, mamlatdar, district_officer |
| `reassign` | `new`, `assigned`, `in_progress`, `escalated` | `assigned` | per permission table |
| `close` | `inspected`, or `escalated` with a recorded outcome | `closed` | mamlatdar, district_officer, admin |
| `reopen` | `closed` | `assigned` (to previous assignee unless specified) | mamlatdar, district_officer, admin |

Escalation chain: inspector to mamlatdar (shop's taluka), mamlatdar to district_officer (shop's district), district_officer to vigilance (the vigilance user with the fewest open cases). Any other transition returns **409**.

**Overdue:** an open case with no officer action for more than `cases.overdue_days` (default 7) since assignment or the last action.

## 4. Actions (stored)
Every action is a row in `case_actions`, append-only. Fields: `id, case_id, actor_id, actor_role, type, payload_json, risk_score_at_action, created_at`. `create` and `assign` system rows are written when a case is created or auto-assigned (`actor_id` null, `actor_role` "system").

Payloads:
- `start_inspection`: `{note?}`
- `record_outcome`: `{outcome: "confirmed" | "not_confirmed", checklist_results: [{item_action, result: "ok" | "issue" | "not_checked", note?}], action_taken: one of cases.action_taken_options, note?}`. `item_action` is a snapshot of the checklist text shown at the time.
- `add_note`: `{note}` (1 to 500 chars)
- `escalate`: `{reason}` (required)
- `reassign`: `{to_user_id, reason?}`
- `close`: `{reason}` (required)
- `reopen`: `{reason}` (required)

`cases.action_taken_options` default (assumption, configurable): `no_action, warning_issued, stock_verification_ordered, referred_to_higher_authority, other` (`other` requires a note).

V1's `feedback` table and `POST /shops/{id}/feedback` are removed. Existing feedback rows are migrated to `record_outcome` actions on a case.

## 5. Data model changes
- `users(user_id PK, name, email UNIQUE, password_hash, role, district NULL, taluka NULL, is_active, last_login_at, created_at)`. Scope: `district` for district_officer, `district` and `taluka` for mamlatdar and inspector, both null for vigilance and admin.
- `shops`: add `inspector_id` (FK users).
- `cases(case_id PK, shop_id, status, assignee_id NULL, risk_score_latest, band_latest, opened_week, last_flagged_week, closed_at NULL, last_action_at, created_at)`
- `case_actions` as above. SQLite triggers block UPDATE and DELETE.
- `audit_log(id PK, event, actor_id NULL, target_user_id NULL, ip, detail_json, created_at)`. Events: `login_success, login_failed, logout, access_denied, user_created, user_updated, user_deactivated, password_reset`. Triggers block UPDATE and DELETE.
- Remove `feedback`.

## 6. Authentication and sessions
- Email and password. Hash with argon2 (`argon2-cffi`). Never store or log plaintext. Never return `password_hash`.
- Session: signed JWT (`PyJWT`, HS256, secret from env `JWT_SECRET`, startup fails if missing) in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` when served over https). Lifetime `auth.session_hours` (default 8).
- Every request re-reads the user from the database. Disabling a user takes effect immediately.
- State-changing requests require the header `X-Requested-With: fetch` and a JSON body. CORS allows credentials only from the configured frontend origin.
- Login failures return one generic message (no user enumeration). After `auth.max_failed_logins` (5) failures for an email, lock it for `auth.lockout_minutes` (15). Log every attempt in `audit_log`.
- Deny by default: every endpoint requires auth except `GET /health` and `POST /auth/login`. Authorisation and scope filtering are enforced in the backend, in one shared dependency and one shared scope filter, never per route by hand.
- Password policy: at least 10 characters. Admin reset returns a temporary password once; it is never stored in plaintext.
- Demo only: users get one shared password from env `DEMO_PASSWORD` (set in `.env`, placeholder in `.env.example`). Optional `DEMO_QUICK_LOGIN=true` shows role shortcuts on the login page with a visible "Demo mode" label. Default false.
- Production identity (SSO, government directory) is not covered.

## 7. API (new and changed)
All under the V1 conventions in `docs/API.md` (JSON, error shape, `week` default).

| method and path | purpose | permission |
|---|---|---|
| `POST /auth/login` `{email, password}` | sets cookie | public |
| `POST /auth/logout` | clears cookie | any user |
| `GET /auth/me` | `{user, permissions[], scope}` | any user |
| `GET /shops/ranked`, `GET /shops/{id}`, `GET /summary` | V1 endpoints, now scoped. Items gain `case: {case_id, status, assignee}` | `flags:view` |
| `GET /cases?status=&assignee_id=&district=&taluka=&band=&overdue=&limit=&offset=` | scoped case list, default sort risk descending | `cases:view` |
| `GET /cases/{id}` | case, shop detail link, action timeline, `allowed_actions` | `cases:view` |
| `POST /cases/{id}/actions` `{type, ...payload}` | perform an action; 403 not allowed, 404 out of scope, 409 invalid transition, 422 bad payload | per table |
| `GET /officers?role=&district=&taluka=&active=` | officers in scope with stats | `officers:view` |
| `GET /officers/{id}` | profile, access (role, scope, permissions), stats, assigned cases, recent actions, area flag rate | `officers:view` |
| `GET /actions?officer_id=&type=&case_id=&from=&to=&limit=&offset=` | action feed in scope | `actions:view` |
| `GET /areas?level=district\|taluka&parent=` | per-area metrics | `areas:view` |
| `GET /admin/users`, `POST /admin/users`, `PATCH /admin/users/{id}`, `POST /admin/users/{id}/reset-password` | user management (role, scope, active) | `users:manage` |
| `GET /admin/audit?event=&user_id=&from=&to=` | access log | `audit:view` |
| `POST /run` | now admin only | `run:execute` |

Remove `POST /shops/{id}/feedback`. Update `docs/API.md` with full schemas.

## 8. Metrics (one implementation, reused for areas and officers)
- **Flag rate (area):** flagged shops / shops monitored, for the selected week. Also high-band rate.
- **Open cases:** status not `closed`. **Overdue:** see section 3.
- **Confirmed rate:** `confirmed` outcomes / outcomes recorded. Null when none.
- **Time to first action:** median hours from assignment to the officer's first action.
- **Officer stats:** assigned, open, inspected, closed, confirmed rate, median time to first action, last action date.
Shown with units and week. Computed in one module (`backend/app/metrics.py`) and covered by golden tests.

## 9. Screens
Routes: `/login`, `/` (role landing: inspector goes to `/queue`, others to `/overview`), `/queue`, `/cases/[id]`, `/flags`, `/overview`, `/areas`, `/officers`, `/officers/[id]`, `/actions`, `/admin/users`, `/admin/audit`. Navigation shows only what the role may open (from `permissions`). 401 redirects to `/login`; 403 shows a plain "You do not have access" page.

- **My queue (inspector):** KPIs (open, overdue, inspected this week, my confirmed rate). Table: shop, band, status, score, age, overdue marker. Row opens the case.
- **Case detail:** V1 shop detail plus a case panel: status, assignee, `allowed_actions` as buttons, outcome form for `record_outcome` (checklist items with ok/issue/not checked, action taken, note), inline confirmation for escalate, close, reassign. Action timeline (who, what, when, score at the time).
- **Overview (supervisors, vigilance, admin):** KPIs for the user's scope, flag rate by child areas (district rows for state scope, taluka rows for district scope), cases by status, overdue count.
- **Areas:** table of areas with shops, flagged, flag rate, high, open cases, overdue, confirmed rate.
- **Officers:** table with role, area, assigned, open, overdue, confirmed rate, last action. **Officer detail:** profile, access (role, scope, permission list), assigned flags, action timeline, flag rate of their area.
- **Actions:** filterable feed of all actions in scope.
- **Admin only:** Users (create, edit role and scope, deactivate, reset password; inline confirm), Access log.
- Reuse the V1 `DataTable`, `KpiCard`, `FilterBar`, `RiskBadge`, states. New blocks: `LoginForm`, `RoleNav`, `StatusBadge`, `CaseActionBar`, `OutcomeForm` (replaces `FeedbackForm`), `ActionTimeline`, `AssigneeSelect`, `PermissionList`, `InlineConfirm`. Follow `docs/DESIGN.md` (light only, no modals for confirmations).

## 10. Synthetic users and activity
- `make seed-users` (also run by `make data`): 1 admin, 2 vigilance, 1 district_officer per district, 1 mamlatdar per taluka, inspectors per taluka = `ceil(shops_in_taluka / inspector_load)` with `inspector_load` default 25, shops split across them. Emails `name.n@demo.invalid`. Names from a fixed fictional list. Writes `data/demo_users.json` (gitignored): one example email per role, no passwords.
- `make seed-activity`: scores the 4 weeks before the target week, creates cases by the rules in section 3, then simulates officer behaviour with the seed: most cases acted on within a few days, some left overdue, some escalated, outcomes recorded with a confirmed probability of about 0.8 for planted-positive shops and 0.15 otherwise, a few slow inspectors. Target-week cases stay mostly new or assigned so the demo can act on them live. The ground truth is used only inside this simulator and is never exposed.
- Everything is labelled synthetic in the UI.

## 11. Tests
- **RBAC matrix:** every endpoint x every role gives the expected 200, 401, 403 or 404. Generated from one table so new endpoints cannot be forgotten.
- **Scope:** an inspector cannot read another inspector's case or shop by ID (404); a Mamlatdar cannot read another taluka; list endpoints never leak out-of-scope rows; `/summary` and `/areas` counts respect scope.
- **State machine:** every valid and invalid transition; only the assignee can act; escalation chain; reassign limits.
- **Append-only:** UPDATE and DELETE on `case_actions` and `audit_log` fail.
- **Auth:** hash verifies; wrong password gives the generic message; lockout after 5 failures and expiry; disabled user is rejected immediately; cookie flags; missing `JWT_SECRET` fails startup; `password_hash` never in any response; CSRF header required.
- **Audit:** login, denial and every admin change write the right event.
- **Metrics:** golden tests for flag rate, confirmed rate, overdue, time to first action.
- **Case creation:** no duplicates; reflag after close opens a new case; inactive inspector falls back to the Mamlatdar.
- **Migration:** V1 feedback rows become `record_outcome` actions.
- **E2E (Playwright), per role:** inspector (sign in, queue, start, record outcome); Mamlatdar (reassign, close); district officer (areas view); vigilance (read-only, no action buttons); admin (officer detail with access and actions, flag rates, create and deactivate a user, access log).
- V1 tests stay green. Update the V1 happy-path e2e to sign in first.

## 12. Rules added (append to RULES.md)
- Deny by default. Authorisation and scope in the backend only; the UI hides, the server enforces.
- Never store or log plaintext passwords or tokens. Never return `password_hash`.
- Never put secrets or real credentials in the repo. `JWT_SECRET` and `DEMO_PASSWORD` come from env.
- `case_actions` and `audit_log` are append-only. No update or delete code paths.
- Return 404 for out-of-scope records. Use one generic login error.
- Write an `audit_log` entry for every login attempt, access denial and admin change.
- No real officer names, emails or phone numbers. Synthetic only.
- Ground-truth labels stay hidden from every endpoint and screen, including the activity simulator's output.
- Do not break V1 behaviour or tests. Do not refactor unrelated code.

## 13. Memory entries to add
Decisions:
- D-009 Auth: argon2 password hashing, JWT in HttpOnly cookie, session re-validated against the database on each request. Pre-approved backend deps: `argon2-cffi`, `PyJWT`.
- D-010 Authorisation: one permission table, one shared dependency, one shared scope filter. The frontend renders from `allowed_actions` and `permissions`.
- D-011 Cases are the work items; actions are an append-only history. V1 feedback is replaced.
- D-012 Oversight screens are shared across supervisor roles and filtered by scope; the admin plane is the state-scope view plus Users and Access log.

Assumptions:
- A-010 The statement names the user groups but not their permissions; the permission table in section 2 is a design choice.
- A-011 The admin role is not in the statement. Admin does not record inspection findings, to keep oversight separate from field work.
- A-012 Vigilance is read-only plus notes, and can receive escalations. Real vigilance powers are unknown.
- A-013 The action types and `action_taken_options` are placeholders; real enforcement actions are unknown.
- A-014 Overdue threshold is 7 days; real response-time rules are unknown.
- A-015 Escalation chain inspector, Mamlatdar, district officer, vigilance is assumed.
- A-016 Shop to inspector mapping is synthetic (`inspector_load` 25). Real assignment rules unknown.
- A-017 Email and password login is for the demo only. Production identity is unknown.

## 14. Phases (append to PHASES.md)
## P10 Auth and users
- [ ] P10.0 Audit the current code against the docs; run `make check`; record deviations in MEMORY.md; do not refactor unrelated code
- [ ] P10.1 Merge this spec into PRODUCT, ARCHITECTURE, API, DATA_SPEC, TESTING, DESIGN, RULES, MEMORY; append these phases to PHASES.md (docs commit)
- [ ] P10.2 Schema: `users`, `shops.inspector_id`, `audit_log` with triggers; config keys
- [ ] P10.3 Password hashing, login, logout, `me`, cookie session, lockout, CSRF header, `audit_log` writes
- [ ] P10.4 Shared permission table, auth dependency, scope filter; apply to all V1 endpoints
- [ ] P10.5 `seed-users` and demo users file
- [ ] P10.6 Auth and RBAC tests (matrix, scope, lockout, cookie flags)
**Exit:** every endpoint requires auth except health and login; matrix and scope tests pass; V1 tests updated and green.

## P11 Cases and actions
- [ ] P11.1 Schema: `cases`, `case_actions` with append-only triggers; remove `feedback` with migration
- [ ] P11.2 Case creation and update inside `POST /run` (section 3 rules)
- [ ] P11.3 State machine and `allowed_actions`
- [ ] P11.4 `GET /cases`, `GET /cases/{id}`, `POST /cases/{id}/actions` with payload validation
- [ ] P11.5 Add `case` summary to ranked and detail responses; make `POST /run` admin only
- [ ] P11.6 Tests (state machine, append-only, creation rules, migration)
**Exit:** a flagged shop becomes a case; actions follow the state machine; history is immutable.

## P12 Oversight APIs
- [ ] P12.1 `metrics.py` (flag rate, confirmed rate, overdue, time to first action) with golden tests
- [ ] P12.2 `GET /areas`, `GET /officers`, `GET /officers/{id}`, `GET /actions`, scope-aware `GET /summary`
- [ ] P12.3 `GET/POST/PATCH /admin/users`, reset password, `GET /admin/audit`
- [ ] P12.4 Update `docs/API.md`; regenerate frontend types
**Exit:** all endpoints match the docs and pass the RBAC matrix.

## P13 Frontend: auth and officer screens
- [ ] P13.1 `/login`, session handling, 401 redirect, 403 page, `RoleNav` from `permissions`
- [ ] P13.2 Blocks: `StatusBadge`, `CaseActionBar`, `OutcomeForm`, `ActionTimeline`, `AssigneeSelect`, `InlineConfirm`
- [ ] P13.3 `/queue` and `/cases/[id]` with actions from `allowed_actions`
- [ ] P13.4 Role landing and V1 flags page moved to `/flags`
**Exit:** an inspector signs in, works a case end to end, and sees only their own data.

## P14 Frontend: oversight and admin
- [ ] P14.1 `/overview` and `/areas` with flag rates
- [ ] P14.2 `/officers` and `/officers/[id]` with `PermissionList` and action timeline
- [ ] P14.3 `/actions` feed
- [ ] P14.4 `/admin/users` and `/admin/audit`
**Exit:** supervisors see their scope; the admin sees the whole state, every officer's access and actions, and flag rates by area.

## P15 Activity data, demo, hardening
- [ ] P15.1 `seed-activity`
- [ ] P15.2 Per-role Playwright e2e; update V1 e2e to sign in
- [ ] P15.3 Security pass: cookie flags, headers, rate limit, no sensitive fields in responses, RBAC matrix complete
- [ ] P15.4 Accessibility and screenshot review of all new screens against `docs/DESIGN.md`
- [ ] P15.5 Update `docs/DEMO.md` with the V2 walkthrough (inspector, Mamlatdar, admin)
- [ ] P15.6 Final Gate V2

## Final Gate V2 (all true, on a clean clone)
1. `make check` and `make e2e` pass, including per-role e2e.
2. `make demo` seeds users and activity and the V2 walkthrough works.
3. RBAC matrix test covers every endpoint and passes.
4. No plaintext secrets or passwords anywhere; no `password_hash` in any response.
5. Every officer action and every access event is stored and visible to the admin.
6. V1 features still work. Synthetic banner on every screen.
7. `MEMORY.md` lists every V2 assumption and known gap. All work committed and pushed.
