/* spelling.jsx — Spelling game. Bolt says the word (browser TTS), a picture
   clue is shown from the start, and letters pop into a row as they're spoken.
   The tolerant core: if the only mismatches are letters that SOUND alike
   (B/P/D/E…), we don't fail — we ask the child to tap which they meant.
   "Start over" and single-letter fixes are always available. Exports SpellingScreen. */
import React from 'react';

function deriveTileStates(target, tiles) {
  // returns { states:[...per tile], hasMissing, ops }
  const res = window.PHON.evalSpelling(target, tiles);
  const states = tiles.map(() => 'normal');
  let hi = 0; let hasMissing = false;
  for (const op of res.ops) {
    if (op.type === 'match') { states[hi] = 'normal'; hi++; }
    else if (op.type === 'sub') { states[hi] = window.PHON.confusable(op.target, op.heard) ? 'suspect' : 'wrong'; hi++; }
    else if (op.type === 'ins') { states[hi] = 'wrong'; hi++; }
    else if (op.type === 'del') { hasMissing = true; }
  }
  return { states, hasMissing, verdict: res.verdict, ops: res.ops };
}

function SpellingScreen({ word, config, hud, onResult }) {
  const A = window.ARC;
  const target = word.word.toUpperCase();
  const [phase, setPhase] = React.useState('intro'); // intro|spell|think|confirm|result|fix
  const [tiles, setTiles] = React.useState([]);
  const [verdict, setVerdict] = React.useState(null);
  const [tileStates, setTileStates] = React.useState([]);
  const [suspects, setSuspects] = React.useState([]);     // [{i, target, heard, options, chosen}]
  const [fixIndex, setFixIndex] = React.useState(null);
  const [revealed, setRevealed] = React.useState(false);
  const [demoOpen, setDemoOpen] = React.useState(true);
  const [latency, setLatency] = React.useState(null);
  const [micOn, setMicOn] = React.useState(false);
  const timers = React.useRef([]);
  const tilesRef = React.useRef([]);
  tilesRef.current = tiles;
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const after = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); return t; };

  React.useEffect(() => {
    setPhase('intro'); setTiles([]); setVerdict(null); setTileStates([]); setSuspects([]); setFixIndex(null); setRevealed(false);
    window.ttsSay && window.ttsSay('Spell the word…');
    after(() => { window.ttsSay && window.ttsSay(word.word, { speed: 0.75 }); }, 900);
    after(() => setPhase('spell'), 2100);
    return () => { try { window.__micCtl && window.__micCtl.stop(); } catch (e) {} clearTimers(); };
  }, [word.word]);

  const voiceState = phase === 'intro' ? 'speak' : phase === 'spell' || phase === 'fix' ? 'listen' : phase === 'think' ? 'think' : 'idle';

  // live letter input -------------------------------------------------------
  const pushLetter = (L) => setTiles((t) => [...t, L.toUpperCase()]);
  const undoLetter = () => setTiles((t) => t.slice(0, -1));
  // Real mic: stays continuously hot (see window.startRealMic in index.html), feeding
  // letters via pushLetter. startRealMic auto-stops any prior session, so restarting
  // (e.g. on "start over") gives a fresh transcript so letters don't double up.
  const startMic = () => { const ctl = window.startRealMic && window.startRealMic((L) => pushLetter(L), true); setMicOn(!!ctl); };
  const stopMic = () => { try { window.__micCtl && window.__micCtl.stop(); } catch (e) {} setMicOn(false); };
  const startOver = () => { clearTimers(); setTiles([]); setPhase('spell'); window.ttsSay && window.ttsSay('No problem — from the top!'); if (micOn) startMic(); };

  const scheduleSpell = (letters) => {
    clearTimers(); setTiles([]); setPhase('spell');
    // letter timing comes from the chosen engine profile (burst vs stream + jitter)
    const sched = window.ENGINES.letterSchedule(config.approach, letters.length);
    const start = 260;
    sched.forEach(({ index, delay }) => after(() => pushLetter(letters[index]), start + delay));
    const last = sched.length ? sched[sched.length - 1].delay : 0;
    after(() => evaluate(letters), start + last + 620);
  };

  function evaluate(letters) {
    const seq = letters || tilesRef.current;
    try { window.__micCtl && window.__micCtl.stop(); } catch (e) {} setMicOn(false); // done listening
    setPhase('think');
    const wait = window.ENGINES.evalLatency(config.approach); // engine-specific judge latency
    setLatency(wait);
    after(() => {
      const d = deriveTileStates(target, seq);
      setTileStates(d.states);
      if (d.verdict === 'correct') {
        setVerdict({ kind: 'correct' });
        setPhase('result'); window.ttsSay && window.ttsSay('Perfect spelling! Amazing!');
      } else if (d.verdict === 'confirm') {
        // build suspect gates
        const sus = [];
        seq.forEach((h, i) => {
          if (d.states[i] === 'suspect') {
            const tgt = target[ /* find aligned target */ alignTargetFor(d.ops, i)];
            const opts = buildOptions(tgt, h);
            sus.push({ i, target: tgt, heard: h, options: opts, chosen: null });
          }
        });
        setSuspects(sus);
        setVerdict({ kind: 'confirm' });
        setPhase('confirm');
        window.ttsSay && window.ttsSay('Ooh, some of those letters sound almost the same. Tap the one you meant!');
      } else {
        setVerdict({ kind: 'incorrect', hasMissing: d.hasMissing });
        setPhase('result'); window.ttsSay && window.ttsSay("So close. Let's fix the tricky part.");
      }
    }, wait);
  }

  // map a heard tile index to its aligned target letter
  function alignTargetFor(ops, heardIdx) {
    let hi = 0, ti = 0;
    for (const op of ops) {
      if (op.type === 'match' || op.type === 'sub') { if (hi === heardIdx) return ti; hi++; ti++; }
      else if (op.type === 'ins') { if (hi === heardIdx) return ti; hi++; }
      else if (op.type === 'del') { ti++; }
    }
    return Math.min(heardIdx, target.length - 1);
  }
  function buildOptions(tgt, heard) {
    const set = new Set([tgt, heard]);
    const partners = window.PHON.partners(tgt);
    for (const p of partners) { if (set.size >= 3) break; set.add(p); }
    return Array.from(set).sort(() => Math.random() - 0.5);
  }

  const chooseSuspect = (susIdx, letter) => {
    setSuspects((prev) => {
      const next = prev.map((s, k) => k === susIdx ? { ...s, chosen: letter } : s);
      // update tile visual
      setTiles((t) => { const c = t.slice(); c[next[susIdx].i] = letter; return c; });
      setTileStates((st) => { const c = st.slice(); c[next[susIdx].i] = letter === next[susIdx].target ? 'fixed' : 'wrong'; return c; });
      // all resolved?
      if (next.every((s) => s.chosen != null)) {
        const allRight = next.every((s) => s.chosen === s.target);
        after(() => {
          if (allRight) { setVerdict({ kind: 'confirmed' }); setPhase('result'); window.ttsSay && window.ttsSay('Yes! That was it. Great listening!'); }
          else { setVerdict({ kind: 'incorrect', fromConfirm: true }); setPhase('result'); window.ttsSay && window.ttsSay('Good try — let me show you that one.'); }
        }, 450);
      }
      return next;
    });
  };

  // fix a single letter --------------------------------------------------
  const beginFix = () => {
    const idx = tileStates.findIndex((s) => s === 'wrong');
    if (idx < 0) { startOver(); return; }
    setFixIndex(idx); setPhase('fix'); setVerdict(null);
    window.ttsSay && window.ttsSay(`Just letter ${idx + 1}. Say it again for me.`);
  };
  const injectFix = (L) => {
    if (fixIndex == null) return;
    setTiles((t) => { const c = t.slice(); c[fixIndex] = L.toUpperCase(); evaluate(c); return c; });
    setFixIndex(null);
  };

  const finish = (outcome, stars, tricky) => onResult({ word: word.word, outcome, stars, tricky: !!tricky });

  // tile row ----------------------------------------------------------------
  const slots = Math.max(target.length, tiles.length);
  const tileRow = (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
      {Array.from({ length: slots }, (_, i) => {
        const has = i < tiles.length;
        const st = phase === 'spell' || phase === 'fix' ? 'normal' : (tileStates[i] || 'normal');
        const isFixing = phase === 'fix' && i === fixIndex;
        return <window.Tile key={i} index={i} letter={has && !isFixing ? tiles[i] : ''} state={isFixing ? 'suspect' : (has ? st : 'blank')} />;
      })}
    </div>
  );

  return (
    <window.ArcScreen>
      <HUD {...hud} voiceState={voiceState} />
      <div style={{ position: 'absolute', top: 72, left: 26, zIndex: 25 }}>
        <window.EngineBadge approach={config.approach} lastLatency={phase === 'think' ? null : latency} note={phase === 'think' ? 'judging spelling…' : (phase === 'spell' ? undefined : undefined)} />
      </div>

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '92px 40px 130px' }}>
        <div style={{ fontFamily: A.ui, fontWeight: 800, fontSize: 15, letterSpacing: 3, textTransform: 'uppercase', color: A.cyan }}>Spell what you hear</div>

        {/* picture clue (shown from the start) + replay */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <window.PictureClue label={word.picture} size={132} />
          <button className="arc-btn" onClick={() => window.ttsSay && window.ttsSay(word.word, { speed: 0.75 })}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'rgba(45,226,230,.12)', border: `2px solid ${A.cyan}55`, borderRadius: 18, padding: '16px 18px', color: A.cyan }}>
            <span style={{ fontSize: 30 }}>🔊</span>
            <span style={{ fontFamily: A.ui, fontWeight: 800, fontSize: 13 }}>Hear it again</span>
          </button>
        </div>

        {tileRow}

        {/* phonetic coaching nudge */}
        {config.phoneticCoach && (phase === 'spell' || phase === 'fix') && (
          <div style={{ fontFamily: A.ui, fontSize: 13.5, color: A.faint, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>💡</span> Tip: say <b style={{ color: A.gold }}>“B for ball”</b> for letters that sound alike — it helps me hear you.
          </div>
        )}

        {/* spell controls (child-facing, hands optional) */}
        {(phase === 'spell') && (
          <div style={{ display: 'flex', gap: 10, marginTop: 4, alignItems: 'center' }}>
            {micOn ? (
              <button className="arc-btn" onClick={stopMic} title="Stop the microphone"
                style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,61,154,.16)', border: `2px solid ${A.pink}66`, color: A.pink, borderRadius: 30, padding: '8px 15px', fontSize: 13.5, fontWeight: 800 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: A.pink, animation: 'arcGlowPulse 1.2s ease-in-out infinite' }} /> Listening… tap to stop
              </button>
            ) : (
              <button className="arc-btn" onClick={startMic} title="Start the microphone — it stays on while you spell"
                style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(45,226,230,.12)', border: `2px solid ${A.cyan}55`, color: A.cyan, borderRadius: 30, padding: '8px 15px', fontSize: 13.5, fontWeight: 800 }}>
                🎤 Use mic
              </button>
            )}
            <window.NeonButton color={A.pink} variant="outline" size="sm" onClick={startOver}>↺ Start over</window.NeonButton>
            <window.NeonButton color={A.gold} variant="outline" size="sm" onClick={undoLetter}>⌫ Undo letter</window.NeonButton>
            <window.NeonButton color={A.lime} size="sm" onClick={() => evaluate()} disabled={!tiles.length}>✓ I’m done</window.NeonButton>
          </div>
        )}
      </div>

      {/* confirm gate */}
      {phase === 'confirm' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,5,20,.55)', backdropFilter: 'blur(6px)', animation: 'arcSlideUp .25s ease both' }}>
          <div style={{ width: 'min(680px,86%)', background: `radial-gradient(120% 120% at 50% 0%, ${A.bg2}, ${A.bg0})`, border: `3px solid ${A.gold}`, borderRadius: 28, padding: '30px 38px', textAlign: 'center', boxShadow: `0 0 60px ${A.gold}55` }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><window.Bolt size={84} mood="listen" /></div>
            <div style={{ fontFamily: A.display, fontWeight: 600, fontSize: 32, color: A.gold, textShadow: `0 0 20px ${A.gold}66` }}>Almost! These sound alike</div>
            <div style={{ fontFamily: A.ui, fontSize: 15.5, color: A.sub, marginTop: 8, lineHeight: 1.45 }}>The mic can’t always tell these letters apart. Tap the one you <i>meant</i> — you’re probably right!</div>
            <div style={{ display: 'flex', gap: 26, justifyContent: 'center', flexWrap: 'wrap', marginTop: 22 }}>
              {suspects.map((s, k) => (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontFamily: A.ui, fontSize: 12, color: A.faint }}>letter {s.i + 1} — I heard “{s.heard}”</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {s.options.map((o) => {
                      const chosen = s.chosen === o;
                      const isAnswerShown = s.chosen != null;
                      const right = o === s.target;
                      return (
                        <button key={o} className="arc-btn" disabled={isAnswerShown} onClick={() => chooseSuspect(k, o)}
                          style={{ width: 60, height: 70, borderRadius: 14, fontFamily: A.display, fontWeight: 600, fontSize: 36, textTransform: 'uppercase',
                            background: isAnswerShown ? (right ? 'rgba(182,255,61,.2)' : (chosen ? 'rgba(255,61,154,.2)' : 'rgba(255,255,255,.05)')) : 'rgba(255,255,255,.08)',
                            border: `3px solid ${isAnswerShown ? (right ? A.lime : (chosen ? A.pink : 'rgba(255,255,255,.12)')) : A.gold + '99'}`,
                            color: isAnswerShown ? (right ? A.lime : (chosen ? A.pink : A.faint)) : '#fff' }}>{o}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* result overlays */}
      {phase === 'result' && verdict && (verdict.kind === 'correct' || verdict.kind === 'confirmed') && (
        <>
          <window.Confetti run count={verdict.kind === 'correct' ? 85 : 55} />
          <window.FeedbackOverlay tone="good" mood="cheer"
            title={verdict.kind === 'correct' ? 'Perfect spelling! ⭐' : 'Sorted — that was it!'}
            message={verdict.kind === 'correct' ? `“${word.word}” — every letter spot on.` : `You meant “${word.word}” all along. The mic just got confused, not you.`}
            actions={<window.NeonButton color={A.lime} size="lg" onClick={() => finish(verdict.kind === 'correct' ? 'correct' : 'close', verdict.kind === 'correct' ? 2 : 1, false)}>Next word →</window.NeonButton>} />
        </>
      )}
      {phase === 'result' && verdict && verdict.kind === 'incorrect' && (
        <window.FeedbackOverlay tone="oops" mood="oops" title="Not yet — let’s fix it"
          readback={tiles.join('')}
          message={revealed ? `The word was “${word.word}”. Spelling’s tricky — this one’s worth another go next time.` : 'Only a letter or two off. Want to fix just that bit, or hear it again?'}
          actions={revealed ? (
            <window.NeonButton color={A.cyan} size="lg" onClick={() => finish('incorrect', 0, true)}>Next word →</window.NeonButton>
          ) : (<>
            <window.NeonButton color={A.gold} onClick={beginFix}>🔧 Fix the tricky letter</window.NeonButton>
            <window.NeonButton color={A.cyan} variant="outline" onClick={() => { window.ttsSay && window.ttsSay(word.word, { speed: 0.75 }); startOver(); }}>🔊 Hear it & retry</window.NeonButton>
            <window.NeonButton color={A.pink} variant="outline" onClick={() => { setRevealed(true); setTileStates(target.split('').map(() => 'fixed')); setTiles(target.split('')); }}>Show me the word</window.NeonButton>
          </>)} />
      )}

      {/* demo controls — context aware */}
      <window.DemoBar title="Stand-in for the child’s voice" open={demoOpen} setOpen={setDemoOpen}>
        {phase === 'fix' ? (<>
          <window.DemoChip color={A.lime} onClick={() => injectFix(target[fixIndex])}>✓ Says the right letter ({target[fixIndex]})</window.DemoChip>
          <window.DemoChip color={A.pink} onClick={() => injectFix(window.PHON.partners(target[fixIndex])[0] || 'X')}>✗ Says a wrong letter</window.DemoChip>
        </>) : (<>
          <window.DemoChip color={A.lime} onClick={() => scheduleSpell(target.split(''))}>Spells it correctly</window.DemoChip>
          <window.DemoChip color={A.gold} onClick={() => scheduleSpell(window.PHON.makeConfusableSpelling(target))}>~ Sound-alike letter slip</window.DemoChip>
          <window.DemoChip color={A.pink} onClick={() => scheduleSpell(window.PHON.makeWrongSpelling(target))}>✗ A real spelling mistake</window.DemoChip>
          <window.DemoChip color={A.cyan} onClick={() => pushLetter(target[tiles.length] || 'A')}>＋ One letter at a time</window.DemoChip>
          <window.DemoChip color={A.purple} onClick={startOver}>Says “start over”</window.DemoChip>
          <window.DemoChip color={A.cyan} onClick={startMic}>🎤 Use real mic</window.DemoChip>
        </>)}
      </window.DemoBar>
    </window.ArcScreen>
  );
}

Object.assign(window, { SpellingScreen, deriveTileStates });
