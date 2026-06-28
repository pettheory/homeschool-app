# Specs

Specs are the **source of truth** that drive the build loop — one file per feature.

## Flow
1. Author a spec with **`/spec`** (interactive) — it writes `docs/specs/<slug>.md` from
   `TEMPLATE.md`.
2. Open a PR with the spec and refine it. **This is the human-in-the-loop step.**
3. Marking the spec `ready` (and merging it) is the signal for the **build routine** to
   implement it on a `feat/<slug>` branch, with tests, and open a feature PR.
4. The **review routine** reviews that PR; a **human merges**.

## Rules
- A spec is done when a build agent could implement it **cold**, with no extra context.
- One shippable change per spec. Split big ideas into multiple specs.
- Acceptance criteria must be **verifiable** — a test, a build, or an observable behavior.
- `Status` tracks the lifecycle: `draft → ready → building → done`.

## Why this shape
Routines get a fresh checkout each run and can't message each other — Git (branches, PRs,
events) is the only coordination channel. A precise spec file is the durable hand-off that
makes an unattended build agent reliable.
