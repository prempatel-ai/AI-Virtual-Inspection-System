# MEMORY.md

Agent state. Read at the start of every iteration. Update at the end of every task.
Keep this file under 250 lines. Compact the Log when it grows (see AGENT_LOOP.md).

## Status
- Current phase: P15 Activity data, demo, hardening
- Last completed task: P15.5 (V2 demo walkthrough script updated)
- Next task: P15.6 (Final Gate V2 verification)

## Performance (measured real numbers vs docs/ARCHITECTURE.md targets)
- Data generation (17,000 shops x 12 weeks): 5.85 s (target: < 120 s) - PASS
- Scoring run (17,000 shops x 1 week): 23.03 s (target: < 60 s) - PASS
- GET /shops/ranked latency (17,000 shops): p50 = 7.4 ms, p95 = 7.8 ms (target: < 300 ms) - PASS

## Decisions
- D-001 Stack: FastAPI + SQLite + pandas (backend), Next.js + TypeScript + Tailwind + Recharts (frontend).
- D-002 LLM service is Groq via `groq` SDK. Model from `GROQ_MODEL`. Fallback to deterministic template.
- D-003 Detection is statistical (robust z-scores using median and MAD) plus hard arithmetic checks.
- D-004 Data is synthetic and seeded. Default 500 shops x 12 weeks. Must scale to 17,000 shops.
- D-005 UI is light theme only.
- D-006 If `GROQ_API_KEY` missing or output invalid, use template explanation. App works fully offline.
- D-007 [Superseded by D-009 for V2] No authentication in the MVP.
- D-008 Pre-approved frontend dependencies: recharts, lucide-react, clsx, openapi-typescript, vitest, Playwright, axe.
- D-009 Auth: argon2 password hashing, JWT in HttpOnly cookie, session re-validated against DB on each request. Pre-approved backend deps: `argon2-cffi`, `PyJWT`.
- D-010 Authorisation: one permission table, one shared dependency, one shared scope filter. Frontend renders from `allowed_actions` and `permissions`.
- D-011 Cases are the work items; actions are an append-only history. V1 feedback is replaced.
- D-012 Oversight screens are shared across supervisor roles and filtered by scope; admin plane is state-scope view plus Users and Access log.

## Assumptions (confirm before real deployment)
- A-001 "Authentication" is Aadhaar-based fingerprint/OTP check on shop's ePoS device.
- A-002 "Override" is unauthenticated sale (`unauth_sales`).
- A-003 ~30% baseline auth failure rate.
- A-004 Complaints arrive per shop with category.
- A-005 `vulnerability_index` (0 to 1) indicates financial vulnerability.
- A-006 Display board figure is distributed kg.
- A-007 Weekly analysis window.
- A-008 Weights and thresholds in `config.yaml` are starting values.
- A-009 Synthetic data uses Gujarat district names for realism.
- A-010 The statement names user groups but not permissions; permission table in V2_SPEC is a design choice.
- A-011 Admin role does not record inspection findings, keeping oversight separate from field work.
- A-012 Vigilance is read-only plus notes, and can receive escalations.
- A-013 Action types and `action_taken_options` are placeholders for real enforcement actions.
- A-014 Overdue threshold is 7 days.
- A-015 Escalation chain: inspector -> mamlatdar -> district_officer -> vigilance.
- A-016 Shop to inspector mapping is synthetic (`inspector_load` 25).
- A-017 Email and password login is for demo only.

## Known Gaps & Deviations
- G-001 Synthetic dataset: evaluation metrics benchmarked on synthetic scenarios S1-S7.
- G-002 Display board figures ingested via weekly records; in production would use OCR or inspection app.
- G-003 Biometric auth failure taxonomy aggregates sensor/network errors in MVP.
- DEV-001 Synthetic disclaimer banner in AppShell was hidden in V1 testing; must be restored in V2.
- DEV-002 V1 endpoints `/shops/ranked`, `/shops/{id}`, `/summary` were public/unscoped; V2 requires auth, scoping, and case references.
- DEV-003 `POST /run` was public; V2 makes it admin-only and triggers case lifecycle updates.

## Blockers
none

## Log (append only, newest last)
- 2026-11-05 Phases P0-P9 completed. Baseline verified: 29 backend tests, 30 frontend tests pass.
- 2026-11-05 P10.0 Code audit completed against V2 spec. Recorded deviations DEV-001..DEV-003 in MEMORY.md. Verified make check pass.
- 2026-11-05 P10.1 Merged docs/V2_SPEC.md into PRODUCT, ARCHITECTURE, API, DATA_SPEC, TESTING, DESIGN, RULES, MEMORY; appended P10-P15 to PHASES.md.
- 2026-11-05 P10.2 Added users, shops.inspector_id, and audit_log tables with append-only triggers, config keys for auth and cases, and tests.
- 2026-11-05 P10.3 Implemented argon2 password hashing, JWT HttpOnly cookie sessions, CSRF validation, generic login error, 15-min lockout after 5 failures, login/logout/me routes with audit_log tracking, and unit tests.
- 2026-11-05 P10.4 Applied single permission dependency (require_permission) and shared scope filter (ScopeFilter) across V1 endpoints; enforced 404 for out-of-scope records and areas.
- 2026-11-05 P10.5 Implemented make seed-users generator creating 1 admin, 2 vigilance, district officers, mamlatdars, and inspectors with round-robin shop assignment; wrote data/demo_users.json without passwords.
- 2026-11-05 P10.6 Implemented programmatically generated RBAC matrix (55 tests) covering every endpoint x every role, strict 404 scope isolation, lockout, and session verification. Phase 10 exit gate passed.
- 2026-11-05 P11.1 Implemented cases and case_actions tables with append-only SQLite triggers, migrated feedback table to case_actions with backwards-compatible view and INSTEAD OF INSERT trigger.
- 2026-11-05 P11.2 Implemented case synchronization and auto-assignment in POST /run pipeline (section 3 rules), system append-only actions, and unit tests.
- 2026-11-05 P11.3 Implemented case state machine transitions, escalation chain, reassign scope checks, allowed_actions computation, and comprehensive unit tests.
- 2026-11-05 P11.4 Implemented GET /cases (filtering, overdue, scope), GET /cases/{id} (allowed_actions, timeline), and POST /cases/{id}/actions with validation and state transitions.
- 2026-11-05 P11.5 Linked case summaries to GET /shops/ranked and GET /shops/{id}; verified POST /run is admin-only.
- 2026-11-05 P11.6 Added integration tests for cases API lifecycle, state transitions, scope isolation, and expanded RBAC matrix (126 passing tests). Phase 11 exit gate passed.
- 2026-11-05 P12.1 Built central metrics engine in backend/app/metrics.py (area metrics, officer stats, confirmed rate, overdue, median time to first action) with golden tests.
- 2026-11-05 P12.2 Implemented oversight endpoints GET /areas, GET /officers, GET /officers/{id}, GET /actions, and scope-aware open/overdue cases in GET /summary.
- 2026-11-05 P12.3 Implemented admin user management (GET/POST/PATCH /admin/users), password reset, and access log (GET /admin/audit) with tests and audit logging.
- 2026-11-05 P12.4 Regenerated frontend OpenAPI spec and TypeScript types via make types; all 168 tests pass. Phase 12 exit gate passed.
- 2026-11-05 P13.1 Implemented AuthProvider, /login, 401 redirect, 403 page, role landing router, and RoleNav driven by permissions. Moved V1 dashboard to /flags.
- 2026-11-05 P13.2 Created V2 reusable UI blocks: StatusBadge, CaseActionBar, OutcomeForm, ActionTimeline, AssigneeSelect, InlineConfirm, PermissionList. All tests and lint pass.
- 2026-11-05 P13.3 Built /queue and /cases/[id] screens driven strictly by allowed_actions, inline confirm, action timeline, and shop evidence.
- 2026-11-05 P13.4 Verified role landing, /flags migration, and complete inspector workflow. make check passes 100%. Phase 13 exit gate passed.
- 2026-11-05 P14.1 Built executive /overview (jurisdiction child area cards, status distribution) and /areas (level selector, flag rates, open/overdue cases, confirmed rates).
- 2026-11-05 P14.2 Built /officers roster and /officers/[id] profile (PermissionList, assigned cases, immutable recent action timeline, area flag rate).
- 2026-11-05 P14.3 Built /actions audit feed with action-type filtering and search.
- 2026-11-05 P14.4 Built /admin/users (provisioning, role/scope assignment, status toggle, password reset) and /admin/audit (append-only security log). Phase 14 exit gate passed.
- 2026-11-05 P15.1 Built make seed-activity generator simulating 4 historical weeks of case progression, realistic officer outcomes, escalations, overdue aging, and target week scoring.
- 2026-11-05 P15.2 Built per-role Playwright E2E suite (frontend/e2e/rbac.spec.ts) validating inspector, mamlatdar, district officer, vigilance, and admin; updated V1 e2e to sign in.
- 2026-11-05 P15.3 Executed security hardening pass: added security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy), validated cookie flags, lockout mechanisms, and verified absence of password_hash across all endpoints.
- 2026-11-05 P15.4 Verified WCAG AA contrast compliance across all semantic tokens and validated component layout against docs/DESIGN.md.
- 2026-11-05 P15.5 Updated docs/DEMO.md with comprehensive multi-user walkthrough covering Inspector, Mamlatdar, Vigilance, and Admin roles.
