# Realtime/LLM grades reading only — spelling stays deterministic

- **Slug:** realtime-reading-only
- **Status:** ready   <!-- draft → ready → building → done -->
- **Owner:** dnichol

## Problem / why
Realtime conversational AI is great for **reading** — natural coaching ("let's sound it out"),
where a small slip is harmless. For **spelling** it's risky: realtime STT mishears similar
letter names (B/P/D), and a model that then *asserts* right/wrong mis-teaches and can confuse
the child. The deterministic tolerance engine instead uses the sound-alike confirm gate — it
never declares a wrong answer, it asks ("did you mean B or P?"). We want the realtime feature,
used wisely: reading yes, spelling never graded by AI. Today this is true in code by accident
(spelling happens to call only `PHON`), but it's undocumented and unguarded — a future change
could wire AI into spelling.

## Outcome
Spelling is *provably* graded only by the tolerance engine; realtime/LLM never grades a spelled
answer. The setup screen makes this explicit so a parent understands the engine choice affects
reading + Bolt's voice, not spelling grading.

## Scope
- **In:**
  - An explicit, testable per-mode evaluation policy (which modes may use AI grading).
  - Gate the reading LLM judge behind that policy; assert spelling can never reach it.
  - A short setup note for spelling / mix modes.
- **Out:** building the realtime pipeline itself (separate spec); any reading-side behavior change.

## Approach
- Add `src/lib/eval-policy.js` attaching `window.EvalPolicy` with `usesAIJudge(mode)` →
  `true` for `'reading'`, `false` for `'spelling'`. Load it in `src/main.jsx` with the other
  `window.*` libs.
- In `src/screens/hud-reading.jsx`, gate the existing `window.Judge` call behind
  `window.EvalPolicy.usesAIJudge('reading')` (reading only). `src/screens/spelling.jsx` keeps
  using `PHON.evalSpelling` only — confirm no judge/realtime path exists there.
- In `src/screens/setup-summary.jsx`, render a one-line note under the engine picker when
  `config.mode` is `'spelling'` or `'mixed'`: spelling is always graded by the deterministic
  engine; the voice engine only affects reading and Bolt's voice.

## Acceptance criteria (verifiable)
- [ ] `test/eval-policy.test.js` asserts `window.EvalPolicy.usesAIJudge('spelling') === false`
      and `usesAIJudge('reading') === true`.
- [ ] The reading judge in `hud-reading.jsx` is invoked only when `EvalPolicy.usesAIJudge`
      allows it; spelling has no judge/realtime evaluation path.
- [ ] `npm test` and `npm run build` pass (existing tests still green).
- [ ] Setup shows the "spelling is always deterministic" note for spelling/mix modes (observable).

## Notes / open questions
Keep it small — this is a guardrail + a UX clarification, not the realtime build.
