---
description: Draft or refine a feature spec in docs/specs/ through discussion
argument-hint: [feature idea or slug]
---
You are helping author a **spec** that will drive the autonomous build loop. Specs live in
`docs/specs/<slug>.md` and follow `docs/specs/TEMPLATE.md`. See `docs/specs/README.md`.

Topic: $ARGUMENTS

Do this:
1. If the topic is vague, ask me up to 3 sharp questions to pin down scope, outcome, and
   acceptance criteria. Only ask what you genuinely need — don't pad.
2. Draft the spec from `docs/specs/TEMPLATE.md`. Acceptance criteria MUST be verifiable
   (a test, a build, or an observable behavior). Keep it to ONE shippable change; if it's
   bigger, propose splitting into multiple specs.
3. Write it to `docs/specs/<slug>.md` with `Status: draft`, then show me the result.
4. When I confirm it's ready, change `Status` to `ready` — that's the signal the build
   loop reads.

Safety rule: loops **propose via PR**; a human reviews and merges. Do **not** implement the
feature now — produce a spec a build agent could execute cold.
