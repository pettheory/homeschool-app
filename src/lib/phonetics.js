/* phonetics.js — the tolerance engine.
   Live-audio ASR mishears constantly, and spoken letter NAMES are the worst
   case. This module encodes which sounds collide and evaluates a child's
   attempt forgivingly: a near-miss is "close" (counts), an ambiguous capture
   is "unclear" (re-listen, no penalty), and a spelling whose only errors fall
   inside a known confusion set is "confirm" (benefit of the doubt — ask the
   child to tap which letter they meant) rather than "wrong".
   Plain JS, attaches to window.PHON. No build step. */
(function () {
  // ── Letter confusion sets (how letter NAMES collide over noisy audio) ──
  // The "E-set" all rhyme with "ee" and are the single biggest source of
  // spelling-by-voice errors.
  const GROUPS = [
    ['B', 'C', 'D', 'E', 'G', 'P', 'T', 'V', 'Z'], // "ee" rhyming set
    ['A', 'C', 'H', 'J', 'K'],                       // "ay"/"kay" set — C lives in both (see/cee ↔ kay)
    ['I', 'Y'],                                      // "eye" set
    ['M', 'N'],                                      // nasals
    ['F', 'S', 'X'],                                 // sibilants
    ['Q', 'U', 'W'],                                 // "you"-ish
    ['O'], ['L'], ['R'],
  ];
  // A letter can appear in multiple groups (C is in both "ee" and "ay").
  // groupsOf maps letter → Set of group indices.
  const groupsOf = {};
  GROUPS.forEach((g, i) => g.forEach((l) => {
    if (!groupsOf[l]) groupsOf[l] = new Set();
    groupsOf[l].add(i);
  }));
  function confusable(a, b) {
    a = (a || '').toUpperCase(); b = (b || '').toUpperCase();
    if (a === b) return true;
    const ga = groupsOf[a], gb = groupsOf[b];
    if (!ga || !gb) return false;
    for (const g of ga) { if (gb.has(g)) return true; }
    return false;
  }
  // Human-readable confusion partners for a letter (for "did you mean…" UI).
  function partners(l) {
    l = (l || '').toUpperCase();
    if (!groupsOf[l]) return [];
    const out = new Set();
    for (const gi of groupsOf[l]) GROUPS[gi].forEach((x) => { if (x !== l) out.add(x); });
    return Array.from(out);
  }

  // ── Spoken-letter normalisation ────────────────────────────────────────
  // ASR often returns letters as words ("bee", "see", "double-u") or with the
  // phonetic-alphabet trick ("B for ball" / "B as in ball"). Reduce any spoken
  // token to a single letter.
  const WORD_TO_LETTER = {
    ay: 'A', bee: 'B', be: 'B', cee: 'C', see: 'C', sea: 'C', dee: 'D',
    ee: 'E', eff: 'F', ef: 'F', gee: 'G', aitch: 'H', haitch: 'H', eye: 'I',
    jay: 'J', kay: 'K', el: 'L', ell: 'L', em: 'M', en: 'N', oh: 'O', ow: 'O',
    pee: 'P', pea: 'P', cue: 'Q', queue: 'Q', ar: 'R', are: 'R', ess: 'S', es: 'S',
    tee: 'T', tea: 'T', you: 'U', vee: 'V', ve: 'V', 'double-u': 'W', 'double-you': 'W',
    ex: 'X', wy: 'Y', why: 'Y', zee: 'Z', zed: 'Z',
  };
  // NATO phonetic alphabet — an unambiguous way to spell letters by voice
  // ("alpha bravo charlie" → A B C). No collisions with WORD_TO_LETTER, so
  // spokenToLetter can consult both. Includes common spelling variants
  // (juliet, xray/x-ray, whisky) the ASR may return.
  const NATO_TO_LETTER = {
    alpha: 'A', bravo: 'B', charlie: 'C', delta: 'D', echo: 'E', foxtrot: 'F',
    golf: 'G', hotel: 'H', india: 'I', juliett: 'J', juliet: 'J', kilo: 'K',
    lima: 'L', mike: 'M', november: 'N', oscar: 'O', papa: 'P', quebec: 'Q',
    romeo: 'R', sierra: 'S', tango: 'T', uniform: 'U', victor: 'V',
    whiskey: 'W', whisky: 'W', 'x-ray': 'X', xray: 'X', yankee: 'Y', zulu: 'Z',
  };
  function spokenToLetter(tok) {
    if (!tok) return null;
    const t = tok.trim().toLowerCase().replace(/[^a-z-]/g, '');
    if (t.length === 1 && /[a-z]/.test(t)) return t.toUpperCase();
    if (WORD_TO_LETTER[t]) return WORD_TO_LETTER[t];
    if (NATO_TO_LETTER[t]) return NATO_TO_LETTER[t];
    return null;
  }
  // Parse a free-text transcript ("B for ball, U, double-u…") into letters,
  // honouring the "<letter> for/as in <word>" pattern (we take the letter).
  function parseLetters(transcript) {
    if (!transcript) return [];
    const cleaned = transcript.toLowerCase()
      .replace(/\b([a-z]|[a-z]+)\s+(?:for|as in)\s+[a-z]+/g, ' $1 ') // "b for ball" -> "b"
      .replace(/\bdouble[\s-]+(?:you|u)\b/g, 'double-u'); // normalise "double u" variants before split
    const out = [];
    // split on whitespace / commas / dots but NOT hyphens (preserves "double-u")
    for (const tok of cleaned.split(/[\s,.]+/)) {
      const L = spokenToLetter(tok);
      if (L) out.push(L);
    }
    return out;
  }

  // ── String helpers ─────────────────────────────────────────────────────
  function norm(s) { return (s || '').toLowerCase().replace(/[^a-z]/g, ''); }
  function lev(a, b) {
    const m = a.length, n = b.length;
    const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return d[m][n];
  }
  // Needleman–Wunsch-ish alignment so we can classify each spelling diff as a
  // substitution (maybe confusable), insertion (extra letter heard) or
  // deletion (letter missed) — far more forgiving than a length check.
  function align(t, h) {
    const m = t.length, n = h.length;
    const d = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) d[i][0] = i;
    for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      const sub = d[i - 1][j - 1] + (t[i - 1] === h[j - 1] ? 0 : 1);
      d[i][j] = Math.min(sub, d[i - 1][j] + 1, d[i][j - 1] + 1);
    }
    const ops = []; let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (t[i - 1] === h[j - 1] ? 0 : 1)) {
        ops.unshift({ type: t[i - 1] === h[j - 1] ? 'match' : 'sub', ti: i - 1, target: t[i - 1], heard: h[j - 1] });
        i--; j--;
      } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
        ops.unshift({ type: 'del', ti: i - 1, target: t[i - 1], heard: null }); i--; // letter missed
      } else {
        ops.unshift({ type: 'ins', ti: i, target: null, heard: h[j - 1] }); j--; // extra letter
      }
    }
    return ops;
  }

  // Common homophones / reading near-misses we accept outright.
  const HOMOPHONES = [
    ['knight', 'night'], ['night', 'knight'], ['ate', 'eight'], ['eight', 'ate'],
    ['their', 'there'], ['there', 'their'], ['to', 'two'], ['two', 'too'],
    ['flower', 'flour'], ['bee', 'be'], ['sea', 'see'], ['hour', 'our'],
  ];
  function homophoneMatch(a, b) {
    return HOMOPHONES.some(([x, y]) => x === a && y === b);
  }

  // ── READING evaluation ─────────────────────────────────────────────────
  // verdict: 'correct' | 'close' | 'unclear' | 'incorrect'
  //  correct  = nailed it (or a homophone)
  //  close    = slight mispronunciation — STILL COUNTS, just acknowledged
  //  unclear  = low ASR confidence / too different to judge fairly -> re-listen
  //             (never costs the child anything)
  //  incorrect= clearly a different word -> gentle, with a "sound it out" path
  function evalReading(target, heard, asrConfidence) {
    const conf = asrConfidence == null ? 1 : asrConfidence;
    const a = norm(target), b = norm(heard);
    if (!b) return { verdict: 'unclear', reason: 'silence' };
    if (a === b || homophoneMatch(a, b)) return { verdict: 'correct' };
    if (conf < 0.45) return { verdict: 'unclear', reason: 'low-confidence' };
    const sim = 1 - lev(a, b) / Math.max(a.length, b.length, 1);
    // tolerate dropped/added endings (plurals, -ed) generously
    const stemMatch = a.startsWith(b) || b.startsWith(a);
    if (sim >= 0.77 || (stemMatch && Math.abs(a.length - b.length) <= 2)) return { verdict: 'close' };
    if (sim >= 0.5) return { verdict: 'unclear', reason: 'ambiguous' };
    return { verdict: 'incorrect' };
  }

  // ── SPELLING evaluation ────────────────────────────────────────────────
  // verdict: 'correct' | 'confirm' | 'incorrect'
  //  correct  = letters match
  //  confirm  = every mismatch is inside a confusion set -> almost certainly
  //             right, the mic just couldn't tell B from P. Ask the child to
  //             tap which they meant (one quick gate) instead of failing.
  //  incorrect= at least one genuine wrong/missing letter.
  function evalSpelling(target, heardLetters) {
    const t = norm(target).toUpperCase().split('');
    const h = (heardLetters || []).map((x) => (x || '').toUpperCase()).filter(Boolean);
    if (!h.length) return { verdict: 'incorrect', ops: [], issues: [], empty: true };
    const ops = align(t, h);
    const issues = ops.filter((o) => o.type !== 'match');
    if (issues.length === 0) return { verdict: 'correct', ops, issues: [] };
    const allConfusableSubs = issues.every((o) => o.type === 'sub' && confusable(o.target, o.heard));
    if (allConfusableSubs) return { verdict: 'confirm', ops, issues };
    return { verdict: 'incorrect', ops, issues };
  }

  // ── Demo helpers: synthesise a plausible ASR capture from a target ──────
  function makeConfusableSpelling(target) {
    const t = norm(target).toUpperCase().split('');
    // swap the first letter that has a confusion partner
    for (let i = 0; i < t.length; i++) {
      const p = partners(t[i]);
      if (p.length) { const c = t.slice(); c[i] = p[0]; return c; }
    }
    return t;
  }
  function makeWrongSpelling(target) {
    const t = norm(target).toUpperCase().split('');
    if (t.length > 3) t.splice(Math.floor(t.length / 2), 1); // drop a middle letter
    return t;
  }

  window.PHON = {
    GROUPS, confusable, partners, spokenToLetter, parseLetters,
    norm, lev, align, evalReading, evalSpelling,
    makeConfusableSpelling, makeWrongSpelling,
  };
})();
