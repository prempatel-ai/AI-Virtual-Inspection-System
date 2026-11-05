# PDS Self-Auditing / AI Virtual Inspection System

Demo MVP for **"PDS Self-Auditing / AI Virtual Inspection System"** (Food, Civil Supplies & Consumer Affairs Department).

The system ranks ~17,000 Fair Price Shops (FPS) by inspection priority from synthetic Public Distribution System (PDS) data, explains each flagged irregularity with traceable mathematical evidence, and equips inspection officers with an action-oriented verification checklist.

> **Note:** All transaction, stock, authentication, and shop data in this repository is synthetic and seeded for demonstration and testing purposes. No real shops or ration card holders are represented.

---

## Key Capabilities

1. **Deterministic Risk Scoring:** Multi-signal detection engine using robust statistical methods (median and Median Absolute Deviation z-scores against taluka peer medians and own history) combined with hard arithmetic reconciliation checks (stock conservation gaps and public display board discrepancies).
2. **Outage Trap Defense:** Isolates systemic infrastructure faults (e.g. taluka-wide cellular tower outages causing authentication spikes) from individual shop fraud by benchmarking against local peer medians, eliminating false-positive inspections.
3. **Traceable Explanations & Checklists:** Explanations cite only computed facts and figures. The LLM integration strictly validates fact IDs and numeric values against computed payloads before display, falling back to deterministic templates if validation fails or if no API key is present.
4. **Inspection Workflow & Feedback Loop:** Officers can inspect breakdown bars that sum directly to the final risk score, compare 8-week shop trends against peer medians, and log on-site inspection outcomes to update departmental accuracy KPIs in real time.
5. **Government-Ready Design:** Clean, distraction-free interface following strict WCAG AA contrast rules, full keyboard accessibility, responsive layouts (1280px desktop and 768px tablet), and tabular figures.

---

## Technology Stack

- **Backend:** FastAPI (Python 3.11+ / 3.13), SQLite (`sqlite3`), pandas, numpy, Groq Python SDK.
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts, Lucide React.
- **Testing & Verification:** pytest, vitest, Playwright, axe-core, ruff, mypy, WCAG AA contrast script.

---

## Quickstart

### Prerequisites
- Python 3.11+ (Python 3.13 supported)
- Node.js 18+ (Node 20+ recommended)
- `make` (or run commands directly as listed below)

### 1. Installation & Environment Setup
Clone the repository and install all backend and frontend dependencies:

```bash
make setup
```
*(On Windows or systems without `make`: creates `.venv`, runs `pip install -e "backend[dev]"`, and runs `npm install` inside `frontend/`)*

### 2. Launch Demo (Single Command)
Generate the seeded dataset (500 shops, 12 weeks, seed 42), run scoring for the latest week, and start both the backend API and frontend web application:

```bash
make demo
```

Once running:
- **Web UI:** [http://localhost:3000](http://localhost:3000)
- **Interactive API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Guided Demo Walkthrough:** Follow the 5-minute walkthrough in [`docs/DEMO.md`](docs/DEMO.md)

*(Optional: Set `GROQ_API_KEY` in `backend/.env` to enable Groq LLM wording for explanations. If omitted, the system operates completely offline using deterministic templates.)*

---

## Quality & Verification Commands

All quality gates are automated and can be executed via the `Makefile`:

| Command | Description |
|---|---|
| `make check` | Runs full suite: backend linter (`ruff`), backend typechecker (`mypy`), frontend linter (`eslint`), frontend typechecker (`tsc`), backend unit tests (`pytest`), frontend unit tests (`vitest`), and WCAG AA token contrast verification (`check_contrast.py`). |
| `make e2e` | Runs Playwright end-to-end tests: happy path audit flow, axe-core accessibility checks, keyboard navigation, and responsive viewport checks (1280px and 768px). |
| `make data` | Regenerates synthetic dataset (default: 500 shops, 12 weeks, seed 42). Scale via `make data SHOPS=17000`. |
| `make types` | Regenerates TypeScript API definitions (`frontend/types/api.d.ts`) directly from the FastAPI OpenAPI schema. |

---

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI routers (shops, meta, runs, feedback)
│   │   ├── config.yaml      # All tunable weights, thresholds, and risk bands
│   │   ├── data/            # Synthetic data generator & scenario planters
│   │   ├── detection/       # Anomaly detection (robust z-score, stock gaps)
│   │   ├── llm/             # Fact extraction, Groq client, validation & templates
│   │   ├── pipeline/        # End-to-end weekly scoring & evaluation
│   │   └── scoring/         # Score decomposition & risk band assignment
│   └── tests/               # pytest test suite
├── frontend/
│   ├── app/                 # Next.js App Router (Dashboard, Shop Detail, Dev Blocks)
│   ├── components/ui/       # Enterprise reusable UI blocks
│   ├── e2e/                 # Playwright e2e specs & screenshots
│   ├── lib/                 # API client wrapper & formatters (en-IN)
│   ├── styles/tokens.css    # Central design token repository
│   └── tests/               # vitest unit & component tests
├── docs/
│   ├── ARCHITECTURE.md      # Data flow, scoring pipeline & system design
│   ├── DATA_SPEC.md         # Schema definitions & planted anomaly scenarios
│   ├── DEMO.md              # 5-minute evaluator walkthrough
│   ├── DESIGN.md            # Visual tokens, typography & banned patterns
│   └── PRODUCT.md           # Business goals, user roles & functional specs
├── scripts/
│   ├── demo.py              # Single-command demo bootstrap & process supervisor
│   ├── perf.py              # 17,000-shop performance & latency benchmark
│   └── check_contrast.py    # WCAG AA contrast verification script
└── Makefile                 # Orchestration targets (setup, check, e2e, demo)
```

---

## Author

Maintained by **Prem Patel** ([rolexhere03@gmail.com](mailto:rolexhere03@gmail.com)).
