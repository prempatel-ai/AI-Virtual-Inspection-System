# AI Virtual Inspection System

Demo MVP for the problem "PDS Self-Auditing / AI Virtual Inspection System" (Food, Civil Supplies & Consumer Affairs Department).

The system ranks Fair Price Shops (FPS) by inspection priority, explains why each shop was flagged, and lists the evidence an officer should check. All data in this repo is synthetic.

## How this repo is built

The docs drive the build. A coding agent reads them and builds the project phase by phase without human input.

| File | Purpose |
|---|---|
| CLAUDE.md | Agent entry point: stack, commands, conventions |
| AGENT_LOOP.md | The autonomous build loop and failure handling |
| PHASES.md | Phased plan with task checklist and exit gates |
| MEMORY.md | Agent state: decisions, assumptions, blockers, log |
| RULES.md | Hard "do not" list |
| docs/PRODUCT.md | Problem statement, users, scope, demo script |
| docs/ARCHITECTURE.md | Pipeline, data model, scoring, LLM contract |
| docs/DATA_SPEC.md | Synthetic data fields and planted scenarios |
| docs/API.md | Backend endpoints |
| docs/TESTING.md | Test strategy and `make check` |
| docs/DESIGN.md | UI rules, tokens, reusable blocks, anti-slop list |

## Kickoff prompt

Paste this into the coding agent:

> Read CLAUDE.md, then follow AGENT_LOOP.md until every phase in PHASES.md is complete and the Final Gate passes. Do not ask for human input. Record assumptions in MEMORY.md. Commit and push after every task.

## Commands

Defined in Phase 0 (see CLAUDE.md): `make setup`, `make data`, `make dev-api`, `make dev-web`, `make check`.
