/* eval-policy.js — the per-mode evaluation policy (window.EvalPolicy).
 *
 * One small, testable guardrail that encodes a NON-NEGOTIABLE pedagogy rule
 * (see CLAUDE.md · "Pedagogy & AI usage" and docs/specs/realtime-reading-only.md):
 * realtime/LLM AI may grade READING only. SPELLING is always graded by the
 * deterministic tolerance engine (window.PHON) + the sound-alike confirm gate,
 * never by an LLM or realtime model — a model that mishears B/P/D and then
 * *asserts* right/wrong mis-teaches and can confuse the child. The deterministic
 * engine never declares a wrong answer; it asks ("did you mean B or P?").
 *
 * Today spelling avoids AI by accident (it happens to call only PHON). This makes
 * that intent explicit and provable, so a future change can't silently wire AI
 * into spelling without tripping a test.
 *
 *   usesAIJudge(mode) → may a "mode" answer reach the AI reading judge?
 *     'reading'  → true   (conversational coaching; a small slip is harmless)
 *     'spelling' → false  (the guarantee this whole module exists to make provable)
 *     anything else → false  (fail closed: unknown/unset modes never get AI grading)
 */
(function () {
  // The ONLY mode AI is allowed to grade. Spelling is deliberately absent, and
  // a Set means anything not explicitly listed (incl. 'mixed', '', undefined)
  // fails closed to deterministic-only grading.
  const AI_GRADED_MODES = new Set(['reading']);

  function usesAIJudge(mode) {
    return AI_GRADED_MODES.has(mode);
  }

  window.EvalPolicy = { usesAIJudge };
})();
