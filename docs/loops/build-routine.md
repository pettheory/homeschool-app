# Build routine

Implements one `ready` spec end-to-end on a branch, with tests, and opens a PR.
Paste the **Trigger** + **Standing prompt** below into a routine at claude.ai/code/routines.

## Trigger (pick one)
- **Recommended — GitHub event:** a PR touching `docs/specs/**` merges to the default branch.
  (The build agent then picks up the newly-`ready` spec.)
- **Label:** add the `build` label to a spec PR.
- **Manual / API:** one-off run, passing the spec slug in the prompt.

## Standing prompt
```
Read CLAUDE.md and docs/specs/README.md first.

Pick the spec to build: the most recently `ready` spec in docs/specs/ that does NOT already
have an open `feat/<slug>` PR (or the slug given to you). If there is none, stop and report
"no ready spec to build" — do nothing else.

Implement that ONE spec, end to end:
1. Create a branch `feat/<slug>` from the default branch.
2. Implement the spec, reusing existing patterns and the seams listed in CLAUDE.md
   (the `window.*` attach pattern; src/lib, server/index.js). Stay within the spec's scope.
3. Add or extend tests under test/ so every acceptance criterion is covered. Run `npm test`
   and `npm run build`; iterate until BOTH pass.
4. Set the spec's Status to `building`.
5. Commit, push `feat/<slug>`, and open a PR into the default branch. The PR body MUST link
   the spec file, restate the acceptance criteria as checkboxes, and say how you verified.

Hard rules:
- Propose via PR ONLY. NEVER push to or merge the default branch.
- One spec per run. Do not invent scope beyond the spec.
- If you cannot make tests/build pass, open the PR as a DRAFT and clearly explain what's
  blocked and what you tried.
```

## After it runs
A human reviews the PR; CI must be green; on merge, set the spec Status to `done`. The Review
routine (Phase 2) can pre-screen the PR before you look.
