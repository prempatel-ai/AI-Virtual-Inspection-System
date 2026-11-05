# RULES.md

Hard limits. If a task seems to require breaking one, choose another way and log it in MEMORY.md.

## Data and claims
- Never use real data or any personal data of ration card holders. Synthetic only.
- Never present synthetic metrics (precision, recall) as real-world accuracy. Label them "on synthetic data".
- Never hide the synthetic-data banner.
- Never invent a data field, threshold or fact silently. Log it as an Assumption in MEMORY.md.
- Never expose `planted_label` or `ground_truth` in any shop-level API response or UI. It is for aggregate evaluation only.
- No real officer names, emails or phone numbers. Synthetic only.
- Ground-truth labels stay hidden from every endpoint and screen, including the activity simulator's output.

## LLM
- Never let the LLM decide, change or compute a risk score or rank.
- Never send the LLM anything except the computed facts payload for one shop.
- Never show LLM text that failed validation. Use the template.
- Never hardcode API keys or model names. Use env vars. Never commit `.env`.
- Never make the app depend on the LLM being available.

## Code
- No magic numbers. Tunables live in `backend/config.yaml`.
- No hand-written frontend API types. Generate them.
- No new dependency without a Decision entry in MEMORY.md explaining why existing ones don't work. (V2 permitted: `argon2-cffi`, `PyJWT`).
- No copy-pasted components or duplicated logic. Extract and reuse.
- No dead code, commented-out code, `TODO` or placeholder text on `main`.
- Never delete, skip or weaken a test to make a check pass. Fix the cause.
- Never swallow exceptions silently.
- No network calls in tests. Use fakes.
- Do not break V1 behaviour or tests. Do not refactor unrelated code.

## Security & Access Control (V2)
- Deny by default. Authorisation and scope in the backend only; the UI hides, the server enforces.
- Never store or log plaintext passwords or tokens. Never return `password_hash`.
- Never put secrets or real credentials in the repo. `JWT_SECRET` and `DEMO_PASSWORD` come from env. Startup fails without `JWT_SECRET`.
- `case_actions` and `audit_log` are append-only. No update or delete code paths; SQLite triggers enforce this.
- Return 404 for out-of-scope records (never 403) to prevent leaking existence.
- Use one generic login error (no user enumeration).
- Write an `audit_log` entry for every login attempt, access denial and admin change.

## Frontend
- No dark mode. No theme toggle.
- No styling outside tokens. No hex colours in components.
- No emoji as icons. No gradients, glow, glassmorphism or decorative shadows.
- No lorem ipsum, fake testimonials or invented statistics.
- Everything in `docs/DESIGN.md` under "Banned patterns" is banned.
- No modals for confirmations; use inline confirmation.

## Git
- Never force-push. Never rewrite history. Never commit to any branch other than `main`.
- Never commit secrets, `.db` files, `node_modules`, build output.
- One task per commit. Message format: `type: short description (P2.2)`.
- If `git push` fails, log it in MEMORY.md and continue. Do not stop.

## Process
- Never stop to ask a human. Choose the safest option, log it, continue.
- Never skip a phase exit gate.
- Never expand scope beyond `docs/PRODUCT.md` and `docs/V2_SPEC.md`.
- Never run destructive commands outside this repo directory.
