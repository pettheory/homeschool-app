/* hud-reading.jsx — game HUD, voice helpers (real browser TTS for Bolt),
   shared FeedbackOverlay + DemoBar shell, and the Reading game with its full
   tolerant-feedback state machine. Exports to window. */
import React from 'react';

// ── Bolt's voice. Delegates to window.VoiceEngine (real ElevenLabs TTS when a
// key is configured, browser SpeechSynthesis otherwise — see src/lib/voice.js).
// A tiny inline browser fallback remains in case voice.js failed to load. The
// state machine advances on its own timers, so async voice can never stall it. ──
window.__soundOn = window.__soundOn !== false;
let _voice = null;
function _pickVoice() {
  try {
    const vs = speechSynthesis.getVoices();
    _voice = vs.find((v) => /samantha|karen|google uk english female|google us english/i.test(v.name))
      || vs.find((v) => v.lang && v.lang.startsWith('en')) || vs[0] || null;
  } catch (e) {}
}
if (typeof speechSynthesis !== 'undefined') { _pickVoice(); speechSynthesis.onvoiceschanged = _pickVoice; }
function say(text, opts = {}) {
  if (!window.__soundOn) return;
  if (window.VoiceEngine) { window.VoiceEngine.speak(text, opts); return; }
  const { rate = 0.96, pitch = 1.12 } = opts; // fallback if voice.js absent
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (_voice) u.voice = _voice;
    u.rate = rate; u.pitch = pitch;
    speechSynthesis.speak(u);
  } catch (e) {}
}
function sayLetters(word) { say(word.toUpperCase().split('').join(', '), { rate: 0.8 }); }
window.ttsSay = say;

// ── HUD ────────────────────────────────────────────────────────────────────
function HUD({ streak, stars, voiceState, index, total, onExit }) {
  const A = window.ARC;
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30, display: 'flex', alignItems: 'center', gap: 16, padding: '18px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,.07)', border: `2px solid ${A.cardBorder}`, borderRadius: 40, padding: '6px 16px 6px 8px' }}>
        <window.Bolt size={38} mood={voiceState === 'listen' ? 'listen' : voiceState === 'think' ? 'think' : 'idle'} />
        <window.VoiceChip state={voiceState} />
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* streak */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,61,154,.14)', border: `2px solid ${A.pink}55`, borderRadius: 40, padding: '7px 16px' }}>
          <window.Equalizer color={A.pink} h={0} bars={0} />
          <svg width="20" height="20" viewBox="0 0 24 24"><path d="M13 2L4 14h6l-1 8 9-12h-6z" fill={A.pink} /></svg>
          <span style={{ fontFamily: A.display, fontWeight: 600, fontSize: 18, color: A.pink }}>{streak} streak</span>
        </div>
        {/* stars / points */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,210,63,.14)', border: `2px solid ${A.gold}55`, borderRadius: 40, padding: '7px 16px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24"><polygon points="12,2 15,9 22.5,9.5 16.5,14.5 18.5,22 12,17.5 5.5,22 7.5,14.5 1.5,9.5 9,9" fill={A.gold} /></svg>
          <span style={{ fontFamily: A.display, fontWeight: 600, fontSize: 18, color: A.gold }}>{stars}</span>
        </div>
        {/* which voice is actually playing (ElevenLabs vs browser fallback) */}
        <VoiceSourceChip />
        {/* sound toggle */}
        <SoundToggle />
        {/* progress + exit */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 4 }}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: i < index ? A.lime : i === index ? '#fff' : 'rgba(255,255,255,.2)' }} />
          ))}
        </div>
        <button className="arc-btn" onClick={onExit} title="End session"
          style={{ width: 38, height: 38, borderRadius: 19, background: 'rgba(255,255,255,.08)', color: A.sub, fontSize: 18, border: `2px solid ${A.cardBorder}` }}>✕</button>
      </div>
    </div>
  );
}

// Shows who is actually speaking — real ElevenLabs voice vs the browser fallback.
// Subscribes to VoiceEngine so a silent autoplay→browser downgrade is visible, not hidden.
function VoiceSourceChip() {
  const A = window.ARC;
  const ve = window.VoiceEngine;
  const [, bump] = React.useState(0);
  React.useEffect(() => {
    if (!ve || !ve.subscribe) return;
    return ve.subscribe(() => bump((n) => n + 1));
  }, []);
  if (!ve) return null;
  const s = ve.state;
  const usingEleven = s.lastSource ? s.lastSource === 'elevenlabs' : s.useEleven;
  const fellBack = s.useEleven && s.lastSource === 'browser'; // intended ElevenLabs, got browser
  const label = usingEleven ? `${s.voiceName || 'ElevenLabs'}` : 'Browser voice';
  const color = fellBack ? A.gold : usingEleven ? A.cyan : A.faint;
  return (
    <div title={fellBack
      ? 'ElevenLabs was blocked or failed — using the browser voice. Reload after clicking, or check the key.'
      : (usingEleven ? `Bolt: real ElevenLabs voice (${s.model || ''})` : 'Bolt: browser speech synthesis')}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 40, background: 'rgba(255,255,255,.06)', border: `2px solid ${color}55`, fontFamily: A.ui, fontWeight: 700, fontSize: 12.5, color }}>
      <span style={{ fontSize: 13 }}>{fellBack ? '⚠️' : '🗣'}</span> {label}
    </div>
  );
}

function SoundToggle() {
  const A = window.ARC;
  const [on, setOn] = React.useState(window.__soundOn);
  return (
    <button className="arc-btn" onClick={() => { window.__soundOn = !on; if (on) { try { (window.VoiceEngine ? window.VoiceEngine.cancel() : speechSynthesis.cancel()); } catch (e) {} } setOn(!on); }}
      title={on ? 'Mute Bolt' : 'Unmute Bolt'}
      style={{ width: 38, height: 38, borderRadius: 19, background: on ? 'rgba(45,226,230,.14)' : 'rgba(255,255,255,.06)', border: `2px solid ${on ? A.cyan + '55' : A.cardBorder}`, color: on ? A.cyan : A.faint, fontSize: 16 }}>
      {on ? '🔊' : '🔇'}
    </button>
  );
}

// ── Shared feedback overlay ─────────────────────────────────────────────────
function FeedbackOverlay({ tone, title, message, readback, mood, actions, children }) {
  const A = window.ARC;
  const c = { good: A.lime, close: A.cyan, unsure: A.gold, oops: A.pink }[tone] || A.cyan;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,5,20,.55)', backdropFilter: 'blur(6px)', animation: 'arcSlideUp .25s ease both' }}>
      <div style={{ width: 'min(620px, 82%)', background: `radial-gradient(120% 120% at 50% 0%, ${A.bg2}, ${A.bg0})`, border: `3px solid ${c}`, borderRadius: 28, padding: '34px 40px', textAlign: 'center', boxShadow: `0 0 60px ${c}55` }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}><window.Bolt size={92} mood={mood} /></div>
        <div style={{ fontFamily: A.display, fontWeight: 600, fontSize: 38, color: c, lineHeight: 1.05, textShadow: `0 0 20px ${c}66` }}>{title}</div>
        {message && <div style={{ fontFamily: A.ui, fontSize: 17, color: A.sub, marginTop: 10, lineHeight: 1.45 }}>{message}</div>}
        {readback && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 14, background: 'rgba(255,255,255,.06)', border: '2px solid rgba(255,255,255,.1)', borderRadius: 30, padding: '7px 16px', fontFamily: 'ui-monospace, monospace', fontSize: 13, color: A.faint }}>
            <span style={{ opacity: .7 }}>I heard:</span> <span style={{ color: '#fff', letterSpacing: 1 }}>{readback}</span>
          </div>
        )}
        {children}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 }}>{actions}</div>
      </div>
    </div>
  );
}

// ── DemoBar — stand-in for the child's voice ────────────────────────────────
function DemoBar({ title, children, open, setOpen }) {
  const A = window.ARC;
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto', margin: '0 0 18px', maxWidth: 'min(900px, 94%)', background: 'rgba(12,8,28,.86)', backdropFilter: 'blur(10px)', border: `2px solid ${A.cardBorder}`, borderRadius: 18, boxShadow: '0 12px 40px rgba(0,0,0,.4)' }}>
        <button className="arc-btn" onClick={() => setOpen(!open)} style={{ width: '100%', background: 'transparent', color: A.faint, padding: '8px 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, letterSpacing: .5, textTransform: 'uppercase' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: A.lime }} />🎙 {title} {open ? '▾' : '▴'}
        </button>
        {open && <div style={{ padding: '4px 16px 16px', display: 'flex', flexWrap: 'wrap', gap: 9, justifyContent: 'center', maxWidth: 860 }}>{children}</div>}
      </div>
    </div>
  );
}
function DemoChip({ children, onClick, color }) {
  const A = window.ARC;
  const c = color || A.cyan;
  return (
    <button className="arc-btn" onClick={onClick}
      style={{ background: `${c}1f`, color: '#fff', border: `2px solid ${c}66`, borderRadius: 12, padding: '9px 14px', fontSize: 13.5, fontWeight: 700 }}>{children}</button>
  );
}

// ── READING game ────────────────────────────────────────────────────────────
function ReadingScreen({ word, config, hud, onResult }) {
  const A = window.ARC;
  const [phase, setPhase] = React.useState('intro'); // intro|listen|think|result
  const [verdict, setVerdict] = React.useState(null);
  const [heard, setHeard] = React.useState('');
  const [showHint, setShowHint] = React.useState(false);
  const [demoOpen, setDemoOpen] = React.useState(true);
  const [latency, setLatency] = React.useState(null);
  const timer = React.useRef(null);
  const alive = React.useRef(true); // guards async (LLM judge) state updates across word changes
  const set = (fn, ms) => { clearTimeout(timer.current); timer.current = setTimeout(fn, ms); };

  React.useEffect(() => {
    alive.current = true;
    setPhase('intro'); setVerdict(null); setHeard(''); setShowHint(false);
    say('Can you read this word for me?');
    set(() => setPhase('listen'), 1500);
    return () => { alive.current = false; clearTimeout(timer.current); };
  }, [word.word]);

  const voiceState = phase === 'intro' ? 'speak' : phase === 'listen' ? 'listen' : phase === 'think' ? 'think' : 'idle';

  // forgiveness shaping — applied to BOTH the tolerance-engine and LLM verdicts
  // so the setup's sensitivity knob still governs the final outcome.
  const shape = (v) => {
    if (config.sensitivity === 'forgiving') {
      if (v.verdict === 'incorrect') {
        const sim = 1 - window.PHON.lev(window.PHON.norm(word.word), window.PHON.norm(heardText)) / Math.max(word.word.length, 1);
        if (sim >= 0.4) return { verdict: 'unclear', reason: 'ambiguous' };
      }
    } else if (config.sensitivity === 'strict') {
      if (v.verdict === 'close') return { verdict: 'unclear', reason: 'confirm' };
    }
    return v;
  };
  let heardText = ''; // bound per inject() so shape() can recompute similarity

  function inject(text, conf) {
    if (phase !== 'listen') return;
    heardText = text;
    setHeard(text);
    setPhase('think');
    const wait = window.ENGINES.evalLatency(config.approach); // engine-specific think beat
    setLatency(wait);

    // Engine C's evaluator: kick the real LLM judge off NOW so it overlaps the
    // simulated think beat. PHON stays the authority + fallback; we keep whichever
    // verdict is more forgiving. No key / error / timeout → tolerance engine only.
    //
    // Guardrail: the AI judge may only ever grade READING. window.EvalPolicy is the
    // single source of truth for that rule (spelling stays deterministic — see
    // src/lib/eval-policy.js). This is the reading screen, so we ask for 'reading'.
    const aiAllowed = !!(window.EvalPolicy && window.EvalPolicy.usesAIJudge('reading'));
    const judgeP = (aiAllowed && window.Judge && window.Judge.state.available && text)
      ? window.Judge.evalReading(word.word, text).catch(() => null)
      : null;

    set(async () => {
      let v = shape(window.PHON.evalReading(word.word, text, conf)); // baseline (authority)
      if (judgeP) {
        const llm = await judgeP;
        if (llm && llm.verdict) v = window.Judge.moreForgiving(v, shape(llm));
      }
      if (!alive.current) return; // word changed while awaiting the judge
      setVerdict(v); setPhase('result');
      if (v.verdict === 'correct') say('Yes! Perfect reading!');
      else if (v.verdict === 'close') say('That counts! Nicely done.');
      else if (v.verdict === 'unclear') say("Hmm, I didn't quite catch that. Try once more?");
      else say("Not quite — let's sound it out together.");
    }, wait);
  }
  const reHear = () => { setPhase('intro'); say('Can you read this word for me?'); set(() => setPhase('listen'), 1400); };
  const reListen = () => { setVerdict(null); setHeard(''); setPhase('listen'); };

  const finish = (outcome, tricky) => {
    const stars = outcome === 'correct' ? 2 : outcome === 'close' ? 1 : 0;
    onResult({ word: word.word, outcome, stars, tricky: !!tricky });
  };

  return (
    <window.ArcScreen>
      <HUD {...hud} voiceState={voiceState} />
      <div style={{ position: 'absolute', top: 72, left: 26, zIndex: 25 }}>
        <window.EngineBadge approach={config.approach} lastLatency={phase === 'think' ? null : latency} note={phase === 'think' ? ((window.Judge && window.Judge.state.available) ? `judge · ${window.Judge.state.model}` : 'evaluating…') : undefined} />
      </div>

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '90px 40px 120px' }}>
        <div style={{ fontFamily: A.ui, fontWeight: 800, fontSize: 15, letterSpacing: 3, textTransform: 'uppercase', color: A.lime }}>Read it out loud</div>
        <div style={{ animation: phase === 'listen' ? 'arcGlowPulse 2s ease-in-out infinite' : 'none' }}>
          <window.GlowWord size={118}>{word.word}</window.GlowWord>
        </div>

        {/* sound-it-out hint */}
        {showHint ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, animation: 'arcSlideUp .2s ease both' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {word.syllables.map((s, i) => (
                <span key={i} style={{ fontFamily: A.display, fontWeight: 500, fontSize: 26, color: A.gold, background: 'rgba(255,210,63,.12)', border: `2px solid ${A.gold}55`, borderRadius: 12, padding: '4px 14px' }}>{s}</span>
              ))}
            </div>
            <div style={{ fontFamily: A.ui, fontSize: 13.5, color: A.sub }}>{word.tip}</div>
          </div>
        ) : (
          <button className="arc-btn" onClick={() => { setShowHint(true); say(word.syllables.join('... ')); }}
            style={{ background: 'transparent', color: A.gold, border: `2px solid ${A.gold}55`, borderRadius: 30, padding: '8px 18px', fontSize: 14 }}>
            🔎 Sound it out
          </button>
        )}
      </div>

      {/* listening hint line */}
      {phase === 'listen' && (
        <div style={{ position: 'absolute', bottom: 96, left: 0, right: 0, textAlign: 'center', fontFamily: A.ui, fontSize: 14, color: A.faint, zIndex: 20 }}>
          No timer. No rush. Say it whenever you’re ready — or tap “Sound it out”.
        </div>
      )}

      {/* feedback */}
      {phase === 'result' && verdict && (() => {
        if (verdict.verdict === 'correct' || verdict.verdict === 'close') {
          return (
            <>
              <window.Confetti run count={verdict.verdict === 'correct' ? 80 : 45} />
              <FeedbackOverlay tone={verdict.verdict === 'correct' ? 'good' : 'close'} mood="cheer"
                title={verdict.verdict === 'correct' ? 'You got it!' : 'That counts! ⭐'}
                message={verdict.verdict === 'correct' ? `“${word.word}” — perfect.` : `A tiny slip, but you clearly read “${word.word}”. We’ll take it!`}
                actions={<window.NeonButton color={A.lime} size="lg" onClick={() => finish(verdict.verdict)}>Next word →</window.NeonButton>} />
            </>
          );
        }
        if (verdict.verdict === 'unclear') {
          return (
            <FeedbackOverlay tone="unsure" mood="listen" title="Let’s try that again" readback={heard || '—'}
              message="That one’s on me — the mic wasn’t sure. Have another go; this won’t count against you."
              actions={<>
                <window.NeonButton color={A.lime} onClick={reListen}>🎤 Say it again</window.NeonButton>
                <window.NeonButton color={A.cyan} variant="outline" onClick={reHear}>🔊 Hear the question</window.NeonButton>
              </>} />
          );
        }
        return (
          <FeedbackOverlay tone="oops" mood="oops" title="Not quite — and that’s okay" readback={heard}
            message="Tricky word! Let’s sound it out, then give it another shot. No streak lost for trying."
            actions={<>
              <window.NeonButton color={A.gold} onClick={() => { setShowHint(true); setPhase('listen'); say(word.syllables.join('... ')); }}>🔎 Sound it out & retry</window.NeonButton>
              <window.NeonButton color={A.cyan} variant="outline" onClick={() => finish('incorrect', true)}>Come back to it later →</window.NeonButton>
            </>} />
        );
      })()}

      {/* demo controls */}
      <DemoBar title="Stand-in for the child’s voice" open={demoOpen} setOpen={setDemoOpen}>
        <DemoChip color={A.lime} onClick={() => inject(word.word, 0.95)}>✓ Reads it correctly</DemoChip>
        <DemoChip color={A.cyan} onClick={() => inject(word.readClose || word.word, 0.8)}>~ Slight mispronunciation</DemoChip>
        <DemoChip color={A.gold} onClick={() => inject(word.word.slice(0, 2), 0.3)}>? Mumbles / mic unsure</DemoChip>
        <DemoChip color={A.pink} onClick={() => inject(word.readWrong || 'something', 0.9)}>✗ Reads the wrong word</DemoChip>
        <DemoChip color={A.purple} onClick={() => inject('', 0.0)}>🤫 Stays quiet</DemoChip>
        <DemoChip color={A.cyan} onClick={() => window.startRealMic && window.startRealMic(inject, false)}>🎤 Use real mic</DemoChip>
      </DemoBar>
    </window.ArcScreen>
  );
}

Object.assign(window, { HUD, SoundToggle, FeedbackOverlay, DemoBar, DemoChip, ReadingScreen, say, sayLetters });
