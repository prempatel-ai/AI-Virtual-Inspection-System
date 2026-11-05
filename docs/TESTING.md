# TESTING.md

`make check` = ruff + mypy type check + backend tests + frontend lint + typecheck + unit tests + WCAG contrast check. Must be green before every commit.
`make e2e` runs Playwright end-to-end tests across roles.

---

## 1. Backend Tests (pytest, no network)

### RBAC Matrix Test
- Generated programmatically from a single central permission table.
- Tests every endpoint against every role (`inspector`, `mamlatdar`, `district_officer`, `vigilance`, `admin`, and unauthenticated requests).
- Asserts strict 200, 401, 403, or 404 response codes. No endpoint can be forgotten.

### Scope Isolation
- Inspector cannot view or act on another inspector's shop or case by ID (**404 Not Found**).
- Mamlatdar cannot access shops, cases, or officers in another taluka (**404**).
- District officer cannot access another district (**404**).
- Scoped list endpoints (`/shops/ranked`, `/cases`, `/officers`, `/actions`, `/summary`, `/areas`) never leak records outside the user's jurisdiction.

### Case State Machine and Actions
- Every valid transition produces the expected target state.
- Invalid transitions return **409 Conflict**.
- Only the case's current assignee can execute `start_inspection` or `record_outcome`.
- Escalation chain strictly follows: inspector -> mamlatdar -> district_officer -> vigilance.
- Reassignment permissions match role boundaries.

### Append-Only Immutability
- SQLite triggers block `UPDATE` and `DELETE` on `case_actions` (raises SQLite abort).
- SQLite triggers block `UPDATE` and `DELETE` on `audit_log`.

### Authentication and Session Security
- Argon2 password hashing and verification.
- Generic error message on bad credentials (no user enumeration).
- Account lockout for 15 minutes after 5 failed login attempts.
- Session JWT validation in HttpOnly, SameSite=Lax cookie.
- Re-reading user on every request: deactivating a user immediately invalidates active sessions.
- Startup fails immediately if `JWT_SECRET` is unset.
- Sensitive fields (`password_hash`) are never returned in any response.
- State-changing requests without `X-Requested-With: fetch` are rejected.

### Metrics Module Golden Tests
- Golden tests in `backend/tests/test_metrics.py` verifying flag rates, confirmed rates, overdue counts, time-to-first-action medians, and officer aggregations.

### Case Lifecycle & Migration
- Reflagging an open case updates latest score without duplicate cases.
- Inactive inspector falls back to the taluka Mamlatdar.
- V1 feedback records correctly migrate to `record_outcome` case actions.

---

## 2. Frontend Tests (vitest & Playwright)

### Unit & Component Tests
- Every block in `components/ui/` tested for rendering, accessibility, and user interactions.
- `RoleNav` renders only links permitted for user's roles.
- `CaseActionBar` renders only actions present in `allowed_actions`.
- Formatters (`en-IN` numbers, dates) and API client error handling.

### E2E per Role (Playwright)
- **Inspector:** Sign in -> `/queue` -> open assigned case -> `start_inspection` -> fill `OutcomeForm` -> verify status updated to `inspected`.
- **Mamlatdar:** Sign in -> taluka overview -> view inspector queue -> reassign case -> close inspected case.
- **District Officer:** Sign in -> district areas overview -> view taluka breakdown.
- **Vigilance:** Sign in -> state-wide flags -> verify read-only status (no action buttons except notes).
- **Admin:** Sign in -> view all flags, officer detail with permissions and actions, flag rates by district/taluka, create/deactivate user, view access log.
- **Security Check:** Verify 401 redirect to `/login` when unauthenticated, and 403 / 404 for unauthorized paths.

---

## 3. Performance & Hardening
- Measure 17,000 shops dataset generation (< 120s) and 1-week run (< 60s).
- Ranked & scoped query p95 latency < 300ms.
- WCAG AA contrast check script passes on all token combinations.
- Axe accessibility checks with zero serious or critical violations.
