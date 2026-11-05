# CLAUDE.md

Entry point for the coding agent. Read this first, every iteration.

## What this is
Demo MVP that ranks ~17,000 Fair Price Shops by inspection priority from PDS data, explains each flag with evidence, and gives officers a checklist. Synthetic data only. Full spec in `docs/`.

## Read order each iteration
1. `CLAUDE.md` (this file)
2. `MEMORY.md` (state, decisions, assumptions)
3. `PHASES.md` (find the next task)
4. `RULES.md` (hard limits)
5. On demand: `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/DATA_SPEC.md`, `docs/API.md`, `docs/TESTING.md`, `docs/DESIGN.md`

## Fixed stack (do not change without logging a decision in MEMORY.md)
- Backend: Python 3.11+, FastAPI, Pydantic, pandas, numpy, SQLite (stdlib `sqlite3`), `groq` SDK, pytest, ruff
- Frontend: Next.js (App Router), TypeScript, Tailwind, Recharts, vitest, Playwright
- Types: frontend API types are generated from the FastAPI OpenAPI schema. Never hand-write them.

## Layout
```
backend/app/{main,config,db,schemas}.py
backend/app/data/        synthetic generator, scenarios
backend/app/pipeline/    features, anomaly, checks, scoring, run, evaluate
backend/app/llm/         facts, groq_client, validate, templates, explain
backend/app/api/         routes
backend/tests/
backend/config.yaml      weights, thresholds, bands (single source of tuning)
backend/checklists.yaml  what to verify per signal
frontend/app/            routes
frontend/components/ui/  reusable blocks (see docs/DESIGN.md)
frontend/styles/tokens.css
frontend/tests/  frontend/e2e/
Makefile  .env.example
```

## Commands (created in Phase 0)
- `make setup` install backend and frontend deps
- `make data` generate synthetic data (`SHOPS=500 WEEKS=12 SEED=42`)
- `make dev-api` / `make dev-web` run servers
- `make test` unit tests, `make lint`, `make types` (regenerate API types), `make e2e`
- `make check` lint + types + tests (must pass before every commit)

## Conventions
- All tunable numbers live in `backend/config.yaml`. No magic numbers in code.
- Pure functions in `pipeline/`. No I/O inside scoring or anomaly code.
- Every score is decomposable: breakdown points must sum to the final score.
- LLM code only words computed facts. It never computes or decides risk.
- Frontend: tokens in `styles/tokens.css` only. Compose from `components/ui/`. No one-off styling.
- Keep code small. Reuse before adding. Delete dead code.

## Definition of done (per task)
1. Behaviour matches the spec doc for that task.
2. `make check` passes.
3. Task ticked in `PHASES.md`, entry appended to `MEMORY.md` log.
4. One commit, conventional message (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`), then push.

## Autonomy
Never wait for a human. If something is unclear, pick the safest option, record it under Assumptions in `MEMORY.md`, and continue. Loop details: `AGENT_LOOP.md`.
