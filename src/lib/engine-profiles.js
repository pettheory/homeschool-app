/* engine-profiles.js — turns the A/B/C choice from a label into real, felt
   behaviour. Each profile encodes the latency + letter-delivery character of
   that architecture so the parent/dev can FEEL the tradeoff in the prototype.

   Modelled on the three POC approaches:
   - A · Realtime (all-in-one): the model drives letter display via tool calls,
     which fire in BURSTS (a couple of letters, pause, a couple more). Eval is
     in-conversation so it's quick. Voice = Realtime.
   - B · Realtime + parse: client parses the transcript as it streams, so
     letters appear one-by-one almost in lockstep with speech — the fastest,
     smoothest letter display. Eval quick. Voice = Realtime.
   - C · Split pipeline: browser STT emits letters fast but a touch irregular;
     evaluation is a round-trip to a cheap LLM, so there's a visible THINK beat.
     Voice = ElevenLabs (higher quality, slight start delay).

   Plain JS, attaches to window.ENGINES. Returns concrete numbers + helpers so
   screens stay declarative. */
(function () {
  const PROFILES = {
    A: {
      id: 'A', name: 'Realtime (all-in-one)', voice: 'OpenAI Realtime',
      // spelling letter delivery
      delivery: 'burst', burstSize: 2, intraBurstMs: 90, interBurstMs: 540,
      // evaluation "thinking" beat (ms) — [min,max]
      evalMs: [340, 560],
      // word audio start delay before TTS begins (ms)
      ttsStartMs: 180,
      blurb: 'Letters arrive in tool-call bursts',
      detail: 'One session does TTS + STT + tool calls. Letter tiles update when the model fires a display tool, so they land in small bursts rather than perfectly live.',
      color: '#ff3d9a',
    },
    B: {
      id: 'B', name: 'Realtime + client parse', voice: 'OpenAI Realtime',
      delivery: 'stream', burstSize: 1, intraBurstMs: 0, interBurstMs: 300,
      evalMs: [300, 470],
      ttsStartMs: 180,
      blurb: 'Letters stream live as spoken',
      detail: 'Same Realtime voice, but the client parses the transcript itself and paints each letter the instant it is recognised — the smoothest, lowest-latency tile display.',
      color: '#2de2e6',
    },
    C: {
      id: 'C', name: 'Split pipeline', voice: 'ElevenLabs',
      delivery: 'stream', burstSize: 1, intraBurstMs: 0, interBurstMs: 360, jitterMs: 220,
      evalMs: [620, 1080],
      ttsStartMs: 480,
      blurb: 'Browser STT · eval waits on an LLM hop',
      detail: 'ElevenLabs speaks the word; the browser does STT so letters appear quickly but a little irregularly; correctness is judged by a separate cheap LLM, so expect a visible pause before feedback.',
      color: '#b6ff3d',
    },
  };

  function get(id) { return PROFILES[id] || PROFILES.B; }

  // a sample think-latency for this attempt (ms), with C's wider variance
  function evalLatency(id) {
    const p = get(id); const [lo, hi] = p.evalMs;
    return Math.round(lo + Math.random() * (hi - lo));
  }

  // schedule of {delay, index} for delivering `n` letters under a profile.
  // Returns absolute delays (ms) from t0 for each letter, honouring burst vs
  // stream + jitter. Screens add their own start offset.
  function letterSchedule(id, n) {
    const p = get(id);
    const out = []; let t = 0;
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        const isBurstBreak = p.delivery === 'burst' && i % p.burstSize === 0;
        let gap = isBurstBreak ? p.interBurstMs : (p.delivery === 'burst' ? p.intraBurstMs : p.interBurstMs);
        if (p.jitterMs) gap += (Math.random() - 0.5) * p.jitterMs;
        t += Math.max(40, gap);
      }
      out.push({ index: i, delay: Math.round(t) });
    }
    return out;
  }

  window.ENGINES = { PROFILES, get, evalLatency, letterSchedule };
})();
