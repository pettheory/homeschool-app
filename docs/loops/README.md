# Autonomous loops

This app is improved by Claude **routines** (cloud agents) coordinated through **Git** —
there's no direct agent-to-agent messaging, so branches, PRs, and GitHub events are the bus.

```
you + /spec ──▶ spec PR ──▶ (merge) ──▶ build routine ──▶ feat/<slug> PR ──▶ review routine
                                                                               │
                                                                     human reviews & merges
```

## The loops
| Loop | Type | Trigger | Output |
|------|------|---------|--------|
| **Spec** | interactive (you) | `/spec` | `docs/specs/<slug>.md` (the source of truth) |
| **Build** | cloud routine | a spec marked `ready` / merged | `feat/<slug>` branch + tests + PR — see [build-routine.md](build-routine.md) |
| **Review** | cloud routine | PR opened on `feat/*` | review comments / fix commits *(Phase 2)* |
| **Refine** | cloud routine | nightly cron | cleanup PR *(Phase 2)* |

Tests are **not** a loop — they're enforced deterministically by CI
(`.github/workflows/ci.yml`) and the local Stop hook in `.claude/settings.json`.

## Safety (non-negotiable)
Loops **propose via PR only**. They never push to or merge the default branch. CI must be
green before a human merges. This single rule keeps the system safe to run unattended.

## Creating a routine
Create routines in your account at **claude.ai/code/routines** (or via `/schedule`). Paste
the standing prompt + trigger from the matching file here (e.g. `build-routine.md`). Each run
is a fresh cloud checkout that reads `CLAUDE.md`. Notes for this repo:
- Routines push to `claude/`-prefixed branches by default; we use `feat/<slug>`, so enable
  "unrestricted branch pushes" on the routine (or adjust the branch prefix).
- Consider a clean `main` as the integration branch (the current default branch is itself a
  `claude/*` branch).
