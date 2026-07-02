/* capture.js — session capture & replay helpers (window.Capture).

   Pure, side-effect-free logic shared by the browser recorder (index.html /
   spelling.jsx) and the replay CLI (scripts/replay-capture.mjs). The interesting
   parts — what to record, how to slice the live mic-event stream down to one
   session, and how to compare browser-heard vs server-STT vs target — live here
   so they're unit-testable in Node with no MediaRecorder, no DOM and no network.

   Plain JS, attaches to window.Capture (matches the window.* pattern; the CLI
   loads it in Node behind a `globalThis.window = {}` shim, exactly like PHON).
   See docs/specs/session-capture-replay.md. */
(function () {
  // Build the capture meta sidecar written next to the audio. Normalises the
  // tiles to an uppercase letter array (the final tile row the child left) and
  // records the session window + agent, so a capture is self-describing on disk.
  function buildCaptureMeta(opts) {
    const o = opts || {};
    return {
      word: (o.word == null ? '' : String(o.word)),
      tiles: (o.tiles || []).map((t) => String(t || '').toUpperCase()).filter(Boolean),
      startedAt: o.startedAt == null ? null : o.startedAt,
      endedAt: o.endedAt == null ? null : o.endedAt,
      userAgent: o.userAgent == null ? '' : String(o.userAgent),
    };
  }

  // Slice the global mic-event ring buffer (window.__micEvents) down to just this
  // session's events, by timestamp. Bounds are inclusive; a null bound is open,
  // so an in-progress capture (no endedAt yet) still returns everything since it
  // started.
  function sliceMicEvents(events, startedAt, endedAt) {
    const from = startedAt == null ? -Infinity : startedAt;
    const to = endedAt == null ? Infinity : endedAt;
    return (events || []).filter(
      (e) => e && typeof e.t === 'number' && e.t >= from && e.t <= to,
    );
  }

  // Letters the browser actually emitted to the tiles, in order. The mic bridge
  // logs one 'emit' event per letter pushed (already deduplicated across
  // recognizer restarts), so the ordered 'emit' stream is the browser's ground
  // truth for what it heard — cleaner than re-parsing the cumulative 'final'
  // lines, which repeat as a session's transcript settles.
  function emittedLetters(events) {
    return (events || [])
      .filter((e) => e && e.kind === 'emit')
      .map((e) => String(e.detail || '').trim().toUpperCase())
      .filter((x) => /^[A-Z]$/.test(x));
  }

  // Turn a word / letter list into a normalised uppercase letter array.
  function toLetters(x) {
    if (Array.isArray(x)) {
      return x.map((c) => String(c || '').toUpperCase()).filter((c) => /^[A-Z]$/.test(c));
    }
    return String(x || '').toUpperCase().replace(/[^A-Z]/g, '').split('').filter(Boolean);
  }

  // Compare a capture three ways: the target word, the letters the browser
  // emitted live, and the letters server STT heard on replay. `browserMatch` is
  // the regression signal the CLI gates on — a real mic bug drops or adds a
  // letter, so browser-emitted ≠ target. `sttMatch` / `browserVsStt` add colour:
  // did the server recognizer hear it, and did the two recognizers agree?
  function compareReplay(opts) {
    const o = opts || {};
    const target = toLetters(o.target);
    const emitted = toLetters(o.emitted);
    const stt = toLetters(o.sttLetters);
    const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
    return {
      target,
      emitted,
      stt,
      browserMatch: eq(target, emitted),
      sttMatch: eq(target, stt),
      browserVsStt: eq(emitted, stt),
    };
  }

  window.Capture = {
    buildCaptureMeta,
    sliceMicEvents,
    emittedLetters,
    toLetters,
    compareReplay,
  };
})();
