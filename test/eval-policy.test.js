import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// eval-policy.js is an IIFE that attaches window.EvalPolicy (no exports) — import for side-effects.
import '../src/lib/eval-policy.js';

const EvalPolicy = window.EvalPolicy;

const readSrc = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('eval policy — per-mode AI grading', () => {
  it('exposes window.EvalPolicy.usesAIJudge', () => {
    expect(typeof EvalPolicy.usesAIJudge).toBe('function');
  });

  // The non-negotiable guardrail (CLAUDE.md · Pedagogy & AI usage):
  // AI grades reading only; spelling is always deterministic.
  it('spelling is NEVER graded by AI', () => {
    expect(EvalPolicy.usesAIJudge('spelling')).toBe(false);
  });
  it('reading MAY be graded by AI', () => {
    expect(EvalPolicy.usesAIJudge('reading')).toBe(true);
  });
  it('fails closed for unknown / unset modes', () => {
    expect(EvalPolicy.usesAIJudge('mixed')).toBe(false);
    expect(EvalPolicy.usesAIJudge(undefined)).toBe(false);
    expect(EvalPolicy.usesAIJudge('')).toBe(false);
  });
});

// Source-level guardrails: prove the WIRING matches the policy, so a future edit
// can't silently route AI into spelling or ungate the reading judge.
describe('eval policy — wiring guardrails', () => {
  const hud = readSrc('../src/screens/hud-reading.jsx');
  const spelling = readSrc('../src/screens/spelling.jsx');
  const setup = readSrc('../src/screens/setup-summary.jsx');

  it('reading gates the LLM judge behind EvalPolicy.usesAIJudge', () => {
    expect(hud).toMatch(/EvalPolicy\.usesAIJudge\(\s*['"]reading['"]\s*\)/);
    expect(hud).toContain('Judge.evalReading');
  });

  it('spelling has NO LLM judge or realtime evaluation path', () => {
    expect(spelling).not.toMatch(/\bJudge\b/);
    expect(spelling).not.toMatch(/evalReading/);
    expect(spelling).not.toMatch(/realtime/i);
    // spelling's only verdict authority is the deterministic engine
    expect(spelling).toContain('PHON.evalSpelling');
  });

  it('setup shows the deterministic-spelling note for spelling/mix modes only', () => {
    expect(setup).toMatch(/config\.mode === ['"]spelling['"] \|\| config\.mode === ['"]mixed['"]/);
    expect(setup).toMatch(/deterministic tolerance engine/i);
  });
});
