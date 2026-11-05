# TESTING.md

`make check` = ruff + type check + backend tests + frontend lint + typecheck + unit tests. Must be green before every commit. `make e2e` runs Playwright and must be green at every phase exit from P7.

## Backend (pytest, no network)
- **Data:** determinism for a seed; planted counts; outage taluka effect; planted shops never in the outage taluka; ranges; stock chain.
- **Anomaly:** robust z on known inputs (hand-computed); zero-MAD floor; peer widening to district; fewer than 4 weeks of history falls back to peer z.
- **Checks:** stock gap and board mismatch on known inputs; direction (shortfall or surplus).
- **Scoring:** golden cases with hand-computed scores; property test that breakdown points sum to the score for random inputs (including the cap); vulnerability uplift never negative; bands at boundaries.
- **Outage trap:** shops in the outage taluka with no other issue score in the low band.
- **Evaluation targets on the default dataset** (SHOPS=500, SEED=42), measured on synthetic data:
  - precision@K >= 0.80, where K is the number of planted positives
  - recall@2K >= 0.90
  - outage false-alarm rate <= 0.05 (share of the top 2K that are unplanted shops in the outage taluka)
  These are targets for the synthetic demo. Tune `config.yaml` to meet them; do not change the data generator to make them pass.
- **LLM:** fake client only. Valid output accepted; unknown `fact_id` rejected; invented number rejected; empty checklist rejected; client error or timeout falls back to template; no `GROQ_API_KEY` falls back to template; cache hit avoids a second call.
- **API:** every endpoint matches `docs/API.md`; filters; pagination; 404 and 422 cases; feedback changes `confirmed_rate`; no ground-truth fields in shop responses.

## Frontend
- **Unit (vitest + Testing Library):** each block renders, handles empty and error input, and is keyboard operable. Formatting helpers (`en-IN` numbers, dates).
- **Contrast script:** every foreground/background token pair meets WCAG AA (4.5:1 text, 3:1 large text and UI).
- **E2E (Playwright), happy path:** open dashboard, see banner and KPIs, filter by district, open the top shop, see breakdown and checklist, record an outcome, return to the dashboard and see the confirmed rate change.
- **Accessibility:** axe on dashboard and shop detail with zero serious or critical violations; tab through the main flow.
- **Visual self-review:** screenshots at 1280 and 768 widths, checked against `docs/DESIGN.md`.

## Performance (measure, report in MEMORY.md)
Targets in `docs/ARCHITECTURE.md`. A script `scripts/perf.py` generates 17,000 shops, runs one week, and times the ranked endpoint.

## Rules
Never skip or weaken a test to pass. No real network calls. Tests create their own temporary SQLite files.
