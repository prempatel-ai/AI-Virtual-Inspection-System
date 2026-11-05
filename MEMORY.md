# MEMORY.md

Agent state. Read at the start of every iteration. Update at the end of every task.
Keep this file under 250 lines. Compact the Log when it grows (see AGENT_LOOP.md).

## Status
- Current phase: P8
- Last completed task: P8.2
- Next task: P8.3

## Performance (measured real numbers vs docs/ARCHITECTURE.md targets)
- Data generation (17,000 shops x 12 weeks): 5.85 s (target: < 120 s) - PASS
- Scoring run (17,000 shops x 1 week): 23.03 s (target: < 60 s) - PASS
- GET /shops/ranked latency (17,000 shops): p50 = 7.4 ms, p95 = 7.8 ms (target: < 300 ms) - PASS

## Decisions
- D-001 Stack: FastAPI + SQLite + pandas (backend), Next.js + TypeScript + Tailwind + Recharts (frontend).
- D-002 LLM service is Groq via the `groq` SDK. Model name comes from env `GROQ_MODEL`. The LLM only words computed facts; it never decides risk.
- D-003 Detection is statistical (robust z-scores using median and MAD) plus hard arithmetic checks. No trained model in the MVP, so every flag is explainable.
- D-004 Data is synthetic and seeded. Default 500 shops x 12 weeks. Must scale to 17,000 shops.
- D-005 UI is light theme only.
- D-006 If `GROQ_API_KEY` is missing or the LLM output fails validation, use the template explanation. The app must work fully without a key.
- D-007 No authentication in the MVP.
- D-008 Pre-approved frontend dependencies: recharts, lucide-react, clsx, openapi-typescript, vitest, Playwright, axe.

## Assumptions (from the problem statement gaps; confirm before real deployment)
- A-001 "Authentication" is the Aadhaar-based fingerprint/OTP check of the ration card holder on the shop's ePoS device. Based on public sources; not verified against Gujarat's internal data.
- A-002 The problem statement does not define "override". MVP treats it as an unauthenticated sale: a sale completed after fingerprint and OTP both failed. Field: `unauth_sales`.
- A-003 The ~30% baseline auth failure rate comes from older Gujarat reporting. Used only to make synthetic data plausible.
- A-004 Complaints arrive per shop with a category: denied ration, short weight, extra money, poor quality, shop closed. Real format unknown.
- A-005 `vulnerability_index` (0 to 1) stands in for "financially vulnerable". The real measure is unknown.
- A-006 The public display board figure is "kg distributed as displayed". How it reaches the system is unknown.
- A-007 Weekly analysis window. Real refresh frequency unknown.
- A-008 Weights and thresholds in `config.yaml` are starting values, not validated.
- A-009 The problem statement does not name the state. Synthetic data uses Gujarat district names only for realism (see docs/DATA_SPEC.md).

## Blockers
none

## Log (append only, newest last)
- 2026-11-05 Docs scaffolded. No code yet.
- 2026-11-05 P0.1 Scaffolding: backend (FastAPI, health endpoint, config.yaml, checklists.yaml), frontend (Next.js 14, Tailwind, vitest), Makefile, .env.example. All checks pass.
- 2026-11-05 P0.2 make check runs backend and frontend lint, typecheck, and unit tests; confirmed green on skeleton.
- 2026-11-05 P0.3 Added GitHub Actions CI workflow running make setup, make check, and frontend build. Phase 0 exit gate passed.
- 2026-11-05 P1.1 Created schema.sql and db.py with tables for shops, shop_weeks, complaints, ground_truth, runs, scores, explanations, and feedback.
- 2026-11-05 P1.2 Built seeded deterministic generator for shops, weekly records, and complaints.
- 2026-11-05 P1.3 Planted scenarios S1-S7 with labels in ground_truth; verified outage taluka exclusion.
- 2026-11-05 P1.4 Scaled to 17,000 shops x 12 weeks: generated in 5.41 s (target: < 120 s). Recorded in MEMORY.md.
- 2026-11-05 P1.5 Added data tests for determinism, planted counts, ranges, stock chain, and outage trap. Phase 1 exit gate passed.
- 2026-11-05 P2.1 Implemented pure feature extraction in features.py for rate signals and hard signals.
- 2026-11-05 P2.2 Implemented anomaly.py: robust z-score vs own history and peers with fallback and district widening.
- 2026-11-05 P2.3 Implemented checks.py: deterministic stock gap and board mismatch evaluation with direction.
- 2026-11-05 P2.4 Added unit tests for features, anomaly detection, hard checks, and outage trap resilience. Phase 2 exit gate passed.
- 2026-11-05 P3.1 Created config.py loader and verified weights, thresholds, and bands loading.
- 2026-11-05 P3.2 Implemented scoring.py with exact breakdown decomposition summing to final score.
- 2026-11-05 P3.3 Implemented run.py to run full inspection pipeline and persist scores and run records.
- 2026-11-05 P3.4 Implemented evaluate.py to compute precision@K, recall@2K, and outage false alarm rate against ground truth.
- 2026-11-05 P3.5 Tuned config.yaml: precision@K=0.8077 (>=0.80), recall@2K=0.9615 (>=0.90), outage_fa=0.0 (<=0.05). Property test on decomposition passed. Phase 3 exit gate passed.
- 2026-11-05 P4.1 Implemented GET /shops/ranked (with filters, pagination, trend) and GET /shops/{id} (full audit detail).
- 2026-11-05 P4.2 Implemented GET /meta and GET /summary with evaluation KPIs and confirmed visit rate.
- 2026-11-05 P4.3 Implemented POST /run to trigger idempotent scoring runs.
- 2026-11-05 P4.4 Implemented POST /shops/{id}/feedback and linked confirmed_rate to summary KPI.
- 2026-11-05 P4.5 Automated make types to export openapi.json and generate compiled frontend types/api.d.ts.
- 2026-11-05 P4.6 Added API tests covering endpoints, filters, pagination, 404, 422, and confirmed_rate updates. Phase 4 exit gate passed.
- 2026-11-05 P5.1 Implemented facts.py building facts payload with fact_ids, allowed numbers set, and sha256 hash.
- 2026-11-05 P5.2 Implemented templates.py and checklists.yaml generating deterministic fallback explanations.
- 2026-11-05 P5.3 Implemented groq_client.py with timeout 10s, 2 retries, temperature 0, and JSON mode.
- 2026-11-05 P5.4 Implemented validate.py strictly checking schema, unknown fact_ids, and number hallucinations.
- 2026-11-05 P5.5 Implemented explain.py with caching, Groq integration, validation, and template fallback. Integrated into run.py.
- 2026-11-05 P5.6 Added tests for LLM validation (unknown fact_id, invented number, empty checklist, cache, fake client, template fallback). Phase 5 exit gate passed.
- 2026-11-05 P6.1 Defined tokens.css, mapped Tailwind configuration exclusively to tokens, configured Public Sans font and typography.
- 2026-11-05 P6.2 Built core UI blocks in components/ui (AppShell, PageHeader, SyntheticBanner, KpiCard, DataTable, RiskBadge, SignalChip, EmptyState, ErrorState, Skeleton, FilterBar) with unit tests.
- 2026-11-05 P6.3 Built domain UI blocks (ScoreBreakdown, TrendChart, ReconcileTable, EvidenceList, ChecklistPanel, FeedbackForm) with unit tests.
- 2026-11-05 P6.4 Built lib/format.ts (en-IN numbers, dates) and lib/api.ts client wrapper using auto-generated types with unit tests.
- 2026-11-05 P6.5 Created dev-only block gallery page at /_blocks showcasing all UI components and domain blocks.
- 2026-11-05 P6.6 Created scripts/check_contrast.py verifying WCAG AA contrast for all token pairs. Added to make check. Phase 6 exit gate passed.
- 2026-11-05 P7.1 Built Dashboard screen (frontend/app/page.tsx) with KPIs, filters, week selection, ranked table, and 8-week sparkline.
- 2026-11-05 P7.2 Built Shop detail screen (frontend/app/shops/[id]/page.tsx) with ScoreBreakdown, TrendChart, ReconcileTable, BoardCheck, EvidenceList, and ChecklistPanel.
- 2026-11-05 P7.3 Connected visit outcome form to POST /shops/{id}/feedback and verified confirmed visit rate updates on dashboard.
- 2026-11-05 P7.4 Configured Playwright e2e happy path test (dashboard -> filter -> detail -> checklist -> outcome -> KPI update) and screenshots at 1280 and 768. make e2e passed. Phase 7 exit gate passed.
- 2026-11-05 P8.1 Verified and tested loading, empty, and error states across all screens with unit tests.
- 2026-11-05 P8.2 Benchmarked 17,000 shops dataset with scripts/perf.py: generation 5.85s (<120s), 1-week run 23.03s (<60s), p95 latency 7.8ms (<300ms). Real numbers logged.
