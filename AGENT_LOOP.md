# AGENT_LOOP.md

How the agent builds this project end to end without human input.

## Loop
Repeat until the Final Gate in `PHASES.md` is true.

1. **Orient.** Read `CLAUDE.md`, `MEMORY.md`, `PHASES.md`, `RULES.md`. Do not trust earlier context; the files are the truth.
2. **Pick.** Take the first unticked task in `PHASES.md`. Read only the docs that task needs.
3. **Build.** Implement the smallest change that satisfies the spec. Reuse existing code and blocks first.
4. **Verify.** Run `make check`. For frontend tasks also run the relevant tests and look at the page (screenshot via Playwright) against `docs/DESIGN.md`.
5. **Record.**
   - Tick the task in `PHASES.md`.
   - Append one line to the `MEMORY.md` Log: date, task ID, what changed, anything surprising.
   - Update `MEMORY.md` Status.
   - Add any new assumption or decision to `MEMORY.md`.
6. **Commit and push.** `git add -A && git commit -m "type: description (Pn.m)" && git push`. If push fails, log it and continue.
7. **Gate.** If the task was the last in its phase, run the phase's exit checks. If they fail, add fix tasks to that phase and do them before moving on.

## When a check fails
1. Read the error. Fix the cause. Re-run. Up to 3 attempts.
2. Still failing: write the failure and what was tried under Blockers in `MEMORY.md`, then try a different approach to the same task.
3. Still failing after a different approach: pick the simplest implementation that meets the acceptance criteria, log the compromise as a known gap, and move on. Never leave `main` red.

## When something is unclear
Do not ask. Choose the safest option, add it to Assumptions in `MEMORY.md` with the reason, and continue.

## Keeping context small
- Re-read files instead of relying on memory.
- When `MEMORY.md` Log exceeds about 60 lines, replace the oldest entries with a short per-phase summary. Keep Decisions and Assumptions intact.
- Prefer many small commits over one large one.

## Finishing
When every phase is ticked: run the Final Gate from a clean clone (`git clone`, `make setup`, `make check`, `make e2e`, `make demo`). Fix anything that fails. When all seven gate items are true, add a final Log line "Final Gate passed" and stop.
