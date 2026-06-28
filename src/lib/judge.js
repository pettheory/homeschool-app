/* judge.js — the cheap-LLM judge, wired for real (Engine C's evaluator).
 *
 * When a judge key is configured — OpenAI `gpt-5.4-nano` or Google
 * `gemini-3.1-flash-lite`, selected by TEXT_PROCESSING_MODEL on the server — a
 * child's spoken READING answer is also evaluated by the LLM via /api/judge and
 * reconciled with the local tolerance engine.
 *
 * The tolerance engine (window.PHON) stays the AUTHORITY and the guaranteed
 * fallback: we take whichever verdict is MORE FORGIVING ("forgive the mic, never
 * the child"), so the LLM can only ever rescue a child the string-distance check
 * would have failed — never punish one it would have passed. Any LLM error,
 * timeout, or missing key leaves the PHON verdict standing.
 *
 * SPELLING deliberately stays on the deterministic letter engine: exact-letter
 * spelling with the sound-alike confirm gate is more accurate there than an LLM,
 * and the UI needs PHON's per-letter ops to render tiles + the confirm gate.
 *
 * Verdicts use the SAME vocabulary as PHON.evalReading so the UI never changes:
 *   correct | close | unclear | incorrect
 */
(function () {
  const state = { ready: false, available: false, model: null, provider: null };

  // ── One-time probe: is a judge key actually present for the active model? ──
  const ready = (async () => {
    try {
      const r = await fetch('/api/config');
      if (r.ok) {
        const c = await r.json();
        state.model = c.textProcessingModel || '';
        const k = c.keys || {};
        if (state.model.startsWith('gpt')) { state.provider = 'OpenAI'; state.available = !!k.openai; }
        else if (state.model.startsWith('gemini')) { state.provider = 'Google'; state.available = !!k.gemini; }
      }
    } catch (e) {
      /* no server → judge unavailable, tolerance engine handles everything */
    }
    state.ready = true;
    try {
      console.info(`[judge] reading evaluation → ${state.available
        ? state.provider + ' ' + state.model + ' (real)'
        : 'local tolerance engine (no judge key)'}`);
    } catch (e) {}
    return state;
  })();

  // forgiveness order: correct > close > unclear > incorrect
  const RANK = { correct: 3, close: 2, unclear: 1, incorrect: 0 };
  function moreForgiving(a, b) {
    if (!b) return a;
    if (!a) return b;
    return (RANK[b.verdict] > RANK[a.verdict]) ? b : a; // ties keep PHON (authority)
  }

  function buildMessages(target, heard) {
    const system = [
      'You are a gentle reading tutor for a child aged 9-10.',
      'Decide whether the child correctly READ ALOUD the TARGET word, given a',
      'speech-to-text TRANSCRIPT that may contain microphone errors.',
      'Principle: forgive the mic, never the child. Accept homophones, accents,',
      'and minor speech-to-text noise.',
      'Reply with STRICT JSON only:',
      '{"verdict": "correct" | "close" | "unclear" | "incorrect", "reason": "<=8 words"}.',
      'correct = clearly read the target word.',
      'close = essentially right, a tiny slip.',
      'unclear = transcript empty/garbled/too short to tell; let them retry, never penalize.',
      'incorrect = clearly a different word.',
      'When unsure between incorrect and unclear, choose unclear.',
    ].join(' ');
    const user = JSON.stringify({ target, transcript: heard || '' });
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }

  // Returns a PHON-shaped verdict from the LLM, or throws (caller falls back).
  async function evalReading(target, heard, { timeoutMs = 3000 } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch('/api/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: buildMessages(target, heard) }),
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error('judge ' + r.status);
      const data = await r.json();
      const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      const parsed = JSON.parse(content);
      const verdict = ['correct', 'close', 'unclear', 'incorrect'].includes(parsed.verdict) ? parsed.verdict : 'unclear';
      try { console.info(`[judge] "${target}" heard "${heard}" → ${verdict} (${state.model})`); } catch (e) {}
      return { verdict, reason: parsed.reason || 'llm', source: 'llm' };
    } finally {
      clearTimeout(t);
    }
  }

  window.Judge = { ready, state, evalReading, moreForgiving };
})();
