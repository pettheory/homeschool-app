/* setup-summary.jsx — parent-facing Setup (Arcade, dev-ish but tidy, engine
   A/B/C kept visible) and the end-of-session Summary. Exports to window. */
import React from 'react';

// small shared controls -----------------------------------------------------
function Segmented({ options, value, onChange, color }) {
  const c = color || window.ARC.cyan;
  return (
    <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,.06)', border: '2px solid rgba(255,255,255,.1)', borderRadius: 40, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button key={o.value} className="arc-btn" onClick={() => onChange(o.value)}
            style={{ borderRadius: 30, padding: '9px 18px', fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap',
              background: on ? c : 'transparent', color: on ? '#160d33' : window.ARC.sub,
              boxShadow: on ? `0 4px 14px ${c}55` : 'none' }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: window.ARC.ui, fontWeight: 800, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: window.ARC.faint, marginBottom: 10 }}>{label}</div>
      {children}
      {hint && <div style={{ fontFamily: window.ARC.ui, fontSize: 12.5, color: window.ARC.faint, marginTop: 8, lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}

function SetupScreen({ config, setConfig, onStart, onOpenLab }) {
  const A = window.ARC;
  const set = (k, v) => setConfig((c) => ({ ...c, [k]: v }));
  const lists = window.WORDS.all();
  const approaches = [
    { value: 'A', name: 'A · Realtime (all-in-one)', desc: 'OpenAI Realtime handles TTS, STT & tool calls.', latency: 'Lowest latency · highest cost', c: A.pink },
    { value: 'B', name: 'B · Realtime + parse', desc: 'Realtime voice, client parses letters for speed.', latency: 'Fast letters · medium cost', c: A.cyan },
    { value: 'C', name: 'C · Split pipeline', desc: 'ElevenLabs TTS + browser STT + cheap LLM judge.', latency: 'Variable latency · lowest cost', c: A.lime },
  ];
  return (
    <window.ArcScreen>
      <div style={{ position: 'relative', height: '100%', padding: '34px 56px 0', display: 'flex', flexDirection: 'column' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
          <window.Bolt size={66} mood="idle" />
          <div>
            <div style={{ fontFamily: A.display, fontWeight: 600, fontSize: 34, letterSpacing: -.5 }}>Word Lab <span style={{ color: A.gold }}>·</span> Session Setup</div>
            <div style={{ fontFamily: A.ui, fontSize: 14.5, color: A.sub }}>Configure the round, then hand the screen to your reader. Voice-only — no keyboard needed.</div>
          </div>
          <div style={{ marginLeft: 'auto', fontFamily: 'ui-monospace, monospace', fontSize: 11, color: A.faint, border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '6px 10px' }}>parent / dev view</div>
        </div>

        {/* two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 34, flex: 1, minHeight: 0 }}>
          {/* left: what to play */}
          <div style={{ background: A.card, border: `2px solid ${A.cardBorder}`, borderRadius: 22, padding: '24px 26px' }}>
            <div style={{ fontFamily: A.display, fontWeight: 600, fontSize: 20, marginBottom: 18, color: A.gold }}>The game</div>
            <Field label="Mode" hint="Reading shows the word to read aloud. Spelling says the word — letters appear as they’re spoken.">
              <Segmented value={config.mode} onChange={(v) => set('mode', v)} color={A.gold}
                options={[{ value: 'reading', label: 'Read it' }, { value: 'spelling', label: 'Spell it' }, { value: 'mixed', label: 'Mix' }]} />
            </Field>
            <Field label="Word list">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lists.map((l) => {
                  const on = config.listId === l.id;
                  return (
                    <button key={l.id} className="arc-btn" onClick={() => set('listId', l.id)}
                      style={{ textAlign: 'left', borderRadius: 16, padding: '14px 16px', background: on ? 'rgba(45,226,230,.14)' : 'rgba(255,255,255,.04)',
                        border: `2px solid ${on ? A.cyan : 'rgba(255,255,255,.1)'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: A.ui, fontWeight: 800, fontSize: 16.5, color: '#fff' }}>{l.name}</span>
                        <span style={{ fontFamily: A.ui, fontWeight: 700, fontSize: 12, color: on ? A.cyan : A.faint }}>{l.words.length} words</span>
                      </div>
                      <div style={{ fontFamily: A.ui, fontSize: 12.5, color: A.sub, marginTop: 3 }}>{l.level}</div>
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label={`Round length — ${config.length} words`}>
              <input type="range" min="3" max="8" value={config.length} onChange={(e) => set('length', +e.target.value)}
                style={{ width: '100%', accentColor: A.gold }} />
            </Field>
          </div>

          {/* right: how it listens (tolerance) + engine */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
            <div style={{ background: A.card, border: `2px solid ${A.cardBorder}`, borderRadius: 22, padding: '20px 24px' }}>
              <div style={{ fontFamily: A.display, fontWeight: 600, fontSize: 20, marginBottom: 6, color: A.lime }}>How it listens</div>
              <div style={{ fontFamily: A.ui, fontSize: 12.5, color: A.sub, marginBottom: 16 }}>Tuned to forgive the mic, never the child. Mishears trigger a friendly re-try, not a fail.</div>
              <Field label="Forgiveness">
                <Segmented value={config.sensitivity} onChange={(v) => set('sensitivity', v)} color={A.lime}
                  options={[{ value: 'forgiving', label: 'Very forgiving' }, { value: 'balanced', label: 'Balanced' }, { value: 'strict', label: 'Strict' }]} />
              </Field>
              <Toggle label="Phonetic-alphabet coaching" hint="Gently suggests “B for ball” so the mic can’t mix up letters that sound alike."
                value={config.phoneticCoach} onChange={(v) => set('phoneticCoach', v)} color={A.lime} />
            </div>

            <div style={{ background: A.card, border: `2px solid ${A.cardBorder}`, borderRadius: 22, padding: '18px 24px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontFamily: A.display, fontWeight: 600, fontSize: 18, color: A.purple }}>Voice engine</span>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: A.faint, border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, padding: '3px 7px' }}>.env</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {approaches.map((ap) => {
                  const on = config.approach === ap.value;
                  return (
                    <button key={ap.value} className="arc-btn" onClick={() => set('approach', ap.value)}
                      style={{ flex: 1, textAlign: 'left', borderRadius: 14, padding: '12px 13px', background: on ? `${ap.c}22` : 'rgba(255,255,255,.03)',
                        border: `2px solid ${on ? ap.c : 'rgba(255,255,255,.1)'}` }}>
                      <div style={{ fontFamily: A.ui, fontWeight: 800, fontSize: 13.5, color: on ? '#fff' : A.sub, lineHeight: 1.2 }}>{ap.name}</div>
                      <div style={{ fontFamily: A.ui, fontSize: 11.5, color: A.sub, margin: '6px 0', lineHeight: 1.35 }}>{ap.desc}</div>
                      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: on ? ap.c : A.faint }}>{ap.latency}</div>
                    </button>
                  );
                })}
              </div>
              {/* Spelling/mix: make clear the engine choice never touches spelling grading. */}
              {(config.mode === 'spelling' || config.mode === 'mixed') && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 13, fontFamily: A.ui, fontSize: 12, color: A.faint, lineHeight: 1.4 }}>
                  <span style={{ fontSize: 13 }}>🔒</span>
                  <span>Spelling is always graded by the deterministic tolerance engine. The voice engine only affects reading and Bolt’s voice — never spelling grading.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* start bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 0 22px' }}>
          <window.NeonButton color={A.lime} size="lg" onClick={onStart}>Start session  →</window.NeonButton>
          <span style={{ fontFamily: A.ui, fontSize: 13, color: A.faint }}>Chrome · mic permission asked on first word</span>
          {onOpenLab && (
            <button className="arc-btn" onClick={onOpenLab} title="Audition and pick Bolt’s voice"
              style={{ marginLeft: 'auto', background: 'rgba(176,135,255,.14)', border: `2px solid ${A.purple}66`, color: A.purple, borderRadius: 30, padding: '11px 18px', fontFamily: A.ui, fontWeight: 800, fontSize: 14 }}>🎚 Voice Lab</button>
          )}
        </div>
      </div>
    </window.ArcScreen>
  );
}

function Toggle({ label, hint, value, onChange, color }) {
  const A = window.ARC;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <button className="arc-btn" onClick={() => onChange(!value)}
        style={{ flex: '0 0 auto', width: 52, height: 30, borderRadius: 20, background: value ? color : 'rgba(255,255,255,.14)', position: 'relative', marginTop: 2 }}>
        <span style={{ position: 'absolute', top: 3, left: value ? 25 : 3, width: 24, height: 24, borderRadius: '50%', background: '#160d33', transition: 'left .15s' }} />
      </button>
      <div>
        <div style={{ fontFamily: A.ui, fontWeight: 800, fontSize: 14.5, color: '#fff' }}>{label}</div>
        {hint && <div style={{ fontFamily: A.ui, fontSize: 12, color: A.sub, marginTop: 2, lineHeight: 1.35 }}>{hint}</div>}
      </div>
    </div>
  );
}

// ── Session summary ────────────────────────────────────────────────────────
function SummaryScreen({ results, config, onReplay, onSetup }) {
  const A = window.ARC;
  const done = results.length;
  const wins = results.filter((r) => r.outcome === 'correct' || r.outcome === 'close').length;
  const stars = results.reduce((s, r) => s + (r.stars || 0), 0);
  const bestStreak = (() => { let b = 0, c = 0; results.forEach((r) => { if (r.outcome === 'correct' || r.outcome === 'close') { c++; b = Math.max(b, c); } else c = 0; }); return b; })();
  const tricky = results.filter((r) => r.tricky);
  const [boom, setBoom] = React.useState(false);
  React.useEffect(() => { const t = setTimeout(() => setBoom(true), 250); return () => clearTimeout(t); }, []);

  const Stat = ({ v, label, c }) => (
    <div style={{ background: A.card, border: `2px solid ${A.cardBorder}`, borderRadius: 18, padding: '18px 8px', textAlign: 'center', flex: 1 }}>
      <div style={{ fontFamily: A.display, fontWeight: 600, fontSize: 44, color: c, lineHeight: 1, textShadow: `0 0 18px ${c}77` }}>{v}</div>
      <div style={{ fontFamily: A.ui, fontWeight: 700, fontSize: 13, color: A.sub, marginTop: 6 }}>{label}</div>
    </div>
  );

  return (
    <window.ArcScreen>
      <window.Confetti run={boom} count={90} />
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 80px', gap: 22 }}>
        <div style={{ animation: 'arcBob .6s ease-in-out infinite' }}><window.Bolt size={120} mood="cheer" /></div>
        <window.GlowWord size={64} color="#fff">Great session!</window.GlowWord>
        <div style={{ fontFamily: A.ui, fontSize: 17, color: A.sub, marginTop: -8 }}>You worked through {done} {done === 1 ? 'word' : 'words'}. Look at those stars. ⭐</div>

        <div style={{ display: 'flex', gap: 14, width: '100%', maxWidth: 760, marginTop: 4 }}>
          <Stat v={`${wins}/${done}`} label="Words got" c={A.lime} />
          <Stat v={stars} label="Stars earned" c={A.gold} />
          <Stat v={bestStreak} label="Best streak" c={A.pink} />
        </div>

        {tricky.length > 0 && (
          <div style={{ width: '100%', maxWidth: 760, background: 'rgba(255,210,63,.08)', border: `2px solid ${A.gold}44`, borderRadius: 18, padding: '16px 22px', marginTop: 4 }}>
            <div style={{ fontFamily: A.ui, fontWeight: 800, fontSize: 14, color: A.gold, marginBottom: 10 }}>Words to revisit next time — no rush, these are the growing edges</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {tricky.map((r, i) => (
                <span key={i} style={{ fontFamily: A.display, fontWeight: 500, fontSize: 18, color: '#fff', background: 'rgba(255,255,255,.07)', border: '2px solid rgba(255,255,255,.12)', borderRadius: 12, padding: '5px 14px' }}>{r.word}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
          <window.NeonButton color={A.lime} size="lg" onClick={onReplay}>Play again</window.NeonButton>
          <window.NeonButton color={A.cyan} variant="outline" onClick={onSetup}>Change setup</window.NeonButton>
        </div>
      </div>
    </window.ArcScreen>
  );
}

Object.assign(window, { SetupScreen, SummaryScreen, Segmented });
