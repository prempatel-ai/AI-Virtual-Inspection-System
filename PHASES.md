# PHASES.md

Build order. Work top to bottom. Do not start a phase until the previous phase's exit gate passes.
Tick `[x]` when a task is done and `make check` is green. Task IDs are used in commit messages and MEMORY.md.

## P0 Foundation
- [x] P0.1 Skeleton: `backend/` (pyproject, ruff, pytest, `app/main.py` with `GET /health`), `frontend/` (Next.js, TypeScript, Tailwind), `Makefile`, `.env.example`
- [x] P0.2 `make check` runs lint, types and tests for backend and frontend; green on the empty skeleton
- [x] P0.3 GitHub Actions workflow running `make check`
**Exit:** `make setup && make check` passes. `/health` returns ok. Frontend builds.

## P1 Synthetic data
- [x] P1.1 `schema.sql` and `db.py` (tables per docs/ARCHITECTURE.md)
- [x] P1.2 Baseline generator: shops, weekly records, complaints. Seeded and deterministic
- [x] P1.3 Plant scenarios S1 to S7 with labels (docs/DATA_SPEC.md)
- [x] P1.4 Scale: `SHOPS=17000` completes within the target in docs/ARCHITECTURE.md
- [x] P1.5 Data tests (determinism, planted counts, outage effect, value ranges)
**Exit:** `make data` is deterministic. Tests pass. 17,000-shop generation completes.

## P2 Detection
- [x] P2.1 `features.py` (rates and gaps per shop-week)
- [x] P2.2 `anomaly.py` (robust z-score vs own history and vs peers)
- [x] P2.3 `checks.py` (stock gap, board mismatch)
- [x] P2.4 Tests including the outage trap
**Exit:** unit tests pass. Shops in the outage taluka do not show high rate-signal scores.

## P3 Scoring and evaluation
- [x] P3.1 `config.yaml` and loader (weights, thresholds, bands)
- [x] P3.2 `scoring.py` with exact breakdown (points sum to score)
- [x] P3.3 `run.py` persists scores per shop-week
- [x] P3.4 `evaluate.py` (precision@K, recall@2K, outage false-alarm rate against planted labels)
- [x] P3.5 Tuning pass: adjust `config.yaml` until the targets in docs/TESTING.md are met
**Exit:** evaluation targets met on the default dataset. Property test on breakdown sums passes.

## P4 API and persistence
- [x] P4.1 `GET /shops/ranked`, `GET /shops/{id}`
- [x] P4.2 `GET /meta`, `GET /summary`
- [x] P4.3 `POST /run`
- [x] P4.4 `POST /shops/{id}/feedback` and confirmed-rate in summary
- [x] P4.5 `make types` generates frontend types from OpenAPI
- [x] P4.6 API tests
**Exit:** all endpoints match docs/API.md. Tests pass. Generated types compile.

## P5 LLM explanation
- [x] P5.1 `facts.py` builds the facts payload with `fact_id`s
- [x] P5.2 `templates.py` and `checklists.yaml` (fallback explanation)
- [x] P5.3 `groq_client.py` (timeout, retry, JSON output)
- [x] P5.4 `validate.py` (reject unknown fact_ids and numbers not in the payload)
- [x] P5.5 `explain.py` (top-K, cache, fallback to template)
- [x] P5.6 Tests with a fake client, including an invented-number rejection
**Exit:** app works with and without `GROQ_API_KEY`. Validation tests pass.

## P6 Frontend foundation
- [x] P6.1 `tokens.css`, Tailwind mapped to tokens, font loaded
- [x] P6.2 Blocks: AppShell, PageHeader, SyntheticBanner, KpiCard, DataTable, RiskBadge, SignalChip, EmptyState, ErrorState, Skeleton, FilterBar
- [x] P6.3 Blocks: ScoreBreakdown, TrendChart, ReconcileTable, EvidenceList, ChecklistPanel, FeedbackForm
- [x] P6.4 API client wrapper using generated types
- [x] P6.5 Dev-only block gallery at `/_blocks`
- [x] P6.6 Contrast check script for all token pairs (WCAG AA)
**Exit:** lint, types, component tests pass. Gallery renders every block. Contrast script passes.

## P7 Screens
- [x] P7.1 Dashboard: KPIs, filters, ranked table
- [x] P7.2 Shop detail: breakdown, charts, reconciliation, board check, explanation, checklist
- [x] P7.3 Visit outcome form; confirmed rate updates on the dashboard
- [x] P7.4 Run audit button with progress and result
**Exit:** Playwright happy path passes (dashboard, open shop, record outcome, see KPI change).

## P8 Integration and hardening
- [ ] P8.1 Loading, empty and error states on every screen
- [ ] P8.2 17,000-shop run: measure run time and ranked-endpoint latency; optimise if over targets
- [ ] P8.3 Accessibility pass (axe, keyboard, focus)
- [ ] P8.4 Responsive check at 1280 and 768 widths
- [ ] P8.5 Screenshot self-review against docs/DESIGN.md; remove any slop found
**Exit:** all checks pass. Performance targets met or logged as known gaps in MEMORY.md.

## P9 Demo readiness
- [ ] P9.1 `make demo`: data, run, serve in one command
- [ ] P9.2 `docs/DEMO.md`: 5-minute walkthrough using the planted shops
- [ ] P9.3 README quickstart verified from a clean clone
- [ ] P9.4 Final Gate

## Final Gate (all must be true)
1. `make check` and `make e2e` pass on a clean clone.
2. `make demo` starts the app and the walkthrough in `docs/DEMO.md` works end to end.
3. App works with no `GROQ_API_KEY`.
4. Every screen shows the synthetic-data banner.
5. No item in `RULES.md` is violated.
6. `MEMORY.md` lists every assumption and known gap.
7. All work is committed and pushed.
