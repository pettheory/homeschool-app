/* arcade-kit.jsx — Arcade visual system + shared components.
   Neon-on-deep-indigo, Fredoka display / Nunito UI. Everything the screens
   share: Bolt the star buddy (with moods), voice-state chip, listening
   equalizer, neon buttons, confetti, picture-clue placeholder, letter tiles.
   Exports to window. */
import React from 'react';

const ARC = {
  bg0: '#160d33', bg1: '#2a1857', bg2: '#3a1f6e',
  ink: '#ffffff', sub: 'rgba(255,255,255,.62)', faint: 'rgba(255,255,255,.4)',
  pink: '#ff3d9a', cyan: '#2de2e6', lime: '#b6ff3d', gold: '#ffd23f', purple: '#8a6cff',
  card: 'rgba(255,255,255,.06)', cardBorder: 'rgba(255,255,255,.12)',
  display: '"Fredoka", system-ui, sans-serif', ui: '"Nunito", system-ui, sans-serif',
};
window.ARC = ARC;

// one-time keyframes / base
if (!document.getElementById('arc-kf')) {
  const s = document.createElement('style');
  s.id = 'arc-kf';
  s.textContent = `
    @keyframes arcEq { 0%,100%{transform:scaleY(.3)} 50%{transform:scaleY(1)} }
    @keyframes arcPulse { 0%{transform:scale(.6);opacity:.7} 100%{transform:scale(1.5);opacity:0} }
    @keyframes arcTwinkle { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1.15)} }
    @keyframes arcPop { 0%{transform:scale(0) rotate(-12deg);opacity:0} 60%{transform:scale(1.18) rotate(4deg)} 100%{transform:scale(1) rotate(0);opacity:1} }
    @keyframes arcBob { 0%,100%{transform:translateY(0) rotate(-2deg)} 50%{transform:translateY(-7px) rotate(2deg)} }
    @keyframes arcThink { 0%,100%{opacity:.3} 50%{opacity:1} }
    @keyframes arcFloatUp { 0%{transform:translateY(0);opacity:0} 15%{opacity:1} 100%{transform:translateY(-40px);opacity:0} }
    @keyframes arcConfFall { 0%{transform:translateY(-10vh) rotate(0);opacity:1} 100%{transform:translateY(105vh) rotate(720deg);opacity:1} }
    @keyframes arcGlowPulse { 0%,100%{filter:drop-shadow(0 0 14px rgba(45,226,230,.5))} 50%{filter:drop-shadow(0 0 26px rgba(45,226,230,.95))} }
    @keyframes arcSlideUp { from{transform:translateY(40px);opacity:0} to{transform:translateY(0);opacity:1} }
    @keyframes arcShakeX { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
    .arc-btn{font-family:${ARC.ui};font-weight:800;cursor:pointer;border:none;transition:transform .12s,box-shadow .12s,background .12s;}
    .arc-btn:hover{transform:translateY(-2px)}
    .arc-btn:active{transform:translateY(0)}
    .arc-screen *{box-sizing:border-box}
  `;
  document.head.appendChild(s);
}

// ── Bolt — the star buddy. moods: idle|speak|listen|think|cheer|oops ──────
function Bolt({ size = 96, mood = 'idle' }) {
  const pts = (cx, cy, R, r, n = 5) => {
    let s = '';
    for (let i = 0; i < n * 2; i++) {
      const rad = (Math.PI / n) * i - Math.PI / 2, rr = i % 2 ? r : R;
      s += `${cx + rr * Math.cos(rad)},${cy + rr * Math.sin(rad)} `;
    }
    return s.trim();
  };
  const listen = mood === 'listen' || mood === 'think';
  const cheer = mood === 'cheer';
  const oops = mood === 'oops';
  const anim = mood === 'idle' || mood === 'speak' ? 'arcBob 3s ease-in-out infinite'
    : mood === 'cheer' ? 'arcBob 0.5s ease-in-out infinite' : 'none';
  return (
    <svg width={size} height={size} viewBox="0 0 140 140" style={{ display: 'block', overflow: 'visible', animation: anim, filter: 'drop-shadow(0 0 14px rgba(255,200,60,.55))' }}>
      <polygon points={pts(70, 72, 60, 27)} fill="#ffc83d" stroke="#ffb01f" strokeWidth="4" strokeLinejoin="round" />
      <polygon points={pts(70, 70, 50, 22)} fill="#ffd968" />
      {/* cheeks */}
      <g fill="#ff9a5c" opacity="0.7"><ellipse cx="50" cy="78" rx="6" ry="4" /><ellipse cx="90" cy="78" rx="6" ry="4" /></g>
      {/* eyes */}
      {listen || oops ? (
        <g stroke="#2b2440" strokeWidth="3.6" strokeLinecap="round" fill="none">
          <path d={oops ? 'M52 64 L66 70' : 'M51 66 Q59 73 67 66'} />
          <path d={oops ? 'M88 64 L74 70' : 'M73 66 Q81 73 89 66'} />
        </g>
      ) : (
        <g>
          <circle cx="59" cy="66" r="8" fill="#fff" /><circle cx="81" cy="66" r="8" fill="#fff" />
          <circle cx={cheer ? 60 : 60.5} cy="67" r="4.4" fill="#2b2440" />
          <circle cx={cheer ? 82 : 82.5} cy="67" r="4.4" fill="#2b2440" />
          <circle cx="62" cy="64.5" r="1.5" fill="#fff" /><circle cx="84" cy="64.5" r="1.5" fill="#fff" />
        </g>
      )}
      {/* mouth */}
      {cheer ? <path d="M58 82 Q70 96 82 82 Q70 88 58 82 Z" fill="#7a2f3a" />
        : oops ? <ellipse cx="70" cy="86" rx="6" ry="7" fill="#7a2f3a" />
          : <path d="M58 82 Q70 92 82 82" stroke="#2b2440" strokeWidth="3.6" fill="none" strokeLinecap="round" />}
    </svg>
  );
}

// ── Voice-state chip: communicates the system is patient ──────────────────
function VoiceChip({ state }) {
  const map = {
    speak: { c: ARC.gold, label: 'Bolt is talking' },
    listen: { c: ARC.lime, label: 'Listening — take your time' },
    think: { c: ARC.cyan, label: 'Thinking…' },
    idle: { c: ARC.faint, label: 'Ready' },
  };
  const m = map[state] || map.idle;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,.07)', border: `2px solid ${m.c}55`, borderRadius: 40, padding: '7px 16px 7px 12px', fontFamily: ARC.ui, fontWeight: 800, fontSize: 14, color: m.c }}>
      {state === 'listen' ? <Equalizer color={m.c} h={16} />
        : state === 'think' ? (
          <span style={{ display: 'inline-flex', gap: 3 }}>
            {[0, 1, 2].map((i) => <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: m.c, animation: `arcThink 1s ${i * 0.2}s infinite` }} />)}
          </span>
        ) : <span style={{ width: 9, height: 9, borderRadius: '50%', background: m.c, boxShadow: `0 0 8px ${m.c}` }} />}
      {m.label}
    </div>
  );
}

function Equalizer({ color = ARC.pink, h = 26, bars = 5 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, height: h }}>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} style={{ width: Math.max(3, h / 6), height: h, borderRadius: 3, background: color, transformOrigin: 'center', animation: `arcEq ${0.6 + (i % 3) * 0.22}s ${i * 0.11}s ease-in-out infinite` }} />
      ))}
    </span>
  );
}

// ── Engine badge — shows which approach is live + the last measured latency.
// Makes the A/B/C tradeoff visible during play (dev affordance, top-left). ──
function EngineBadge({ approach, lastLatency, note }) {
  const p = window.ENGINES.get(approach);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'rgba(255,255,255,.05)', border: `1.5px solid ${p.color}55`, borderRadius: 12, padding: '5px 11px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: ARC.faint }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, boxShadow: `0 0 7px ${p.color}` }} />
      <span style={{ color: '#fff', fontWeight: 700 }}>Engine {p.id}</span>
      <span style={{ opacity: .8 }}>{note || p.blurb}</span>
      {lastLatency != null && (
        <span style={{ color: p.color, fontWeight: 700, borderLeft: '1px solid rgba(255,255,255,.16)', paddingLeft: 9 }}>{lastLatency}ms</span>
      )}
    </div>
  );
}

// ── Buttons ───────────────────────────────────────────────────────────────
function NeonButton({ children, onClick, color = ARC.pink, variant = 'solid', size = 'md', style = {}, disabled }) {
  const pad = size === 'lg' ? '16px 32px' : size === 'sm' ? '8px 16px' : '12px 24px';
  const fs = size === 'lg' ? 21 : size === 'sm' ? 14 : 17;
  const base = variant === 'solid'
    ? { background: color, color: '#1a0f33', boxShadow: `0 6px 0 ${shade(color)}, 0 10px 24px ${color}55` }
    : { background: 'transparent', color, border: `2.5px solid ${color}`, boxShadow: `0 0 0 ${color}` };
  return (
    <button className="arc-btn" onClick={disabled ? undefined : onClick} disabled={disabled}
      style={{ borderRadius: 40, padding: pad, fontSize: fs, letterSpacing: .2, opacity: disabled ? .45 : 1,
        ...base, ...style }}>
      {children}
    </button>
  );
}
function shade(hex) {
  const c = hex.replace('#', '');
  const r = Math.max(0, parseInt(c.slice(0, 2), 16) - 60), g = Math.max(0, parseInt(c.slice(2, 4), 16) - 60), b = Math.max(0, parseInt(c.slice(4, 6), 16) - 60);
  return `rgb(${r},${g},${b})`;
}

// ── Glowing word display ──────────────────────────────────────────────────
function GlowWord({ children, size = 110, color = ARC.ink }) {
  return (
    <div style={{ fontFamily: ARC.display, fontWeight: 600, fontSize: size, color, lineHeight: 1, letterSpacing: -1,
      textShadow: `0 0 18px ${ARC.cyan}e6, 0 0 44px ${ARC.pink}88` }}>{children}</div>
  );
}

// ── Letter tile (spelling) ────────────────────────────────────────────────
function Tile({ letter, state = 'normal', index = 0 }) {
  // state: normal | suspect | wrong | fixed | blank
  const palette = {
    normal: { bg: 'rgba(255,255,255,.1)', bd: ARC.cyan, fg: '#fff', glow: `${ARC.cyan}66` },
    suspect: { bg: 'rgba(255,210,63,.16)', bd: ARC.gold, fg: ARC.gold, glow: `${ARC.gold}88` },
    wrong: { bg: 'rgba(255,61,154,.16)', bd: ARC.pink, fg: ARC.pink, glow: `${ARC.pink}88` },
    fixed: { bg: 'rgba(182,255,61,.18)', bd: ARC.lime, fg: ARC.lime, glow: `${ARC.lime}88` },
    blank: { bg: 'rgba(255,255,255,.04)', bd: 'rgba(255,255,255,.18)', fg: 'transparent', glow: 'transparent' },
  }[state] || {};
  return (
    <div style={{ width: 72, height: 86, borderRadius: 16, background: palette.bg, border: `3px solid ${palette.bd}`,
      display: 'grid', placeItems: 'center', fontFamily: ARC.display, fontWeight: 600, fontSize: 46, color: palette.fg,
      boxShadow: `0 0 20px ${palette.glow}`, animation: state === 'blank' ? 'none' : `arcPop .35s ${index * 0.02}s cubic-bezier(.2,.8,.3,1.2) both`,
      textTransform: 'uppercase' }}>{letter || ''}</div>
  );
}

// ── Picture-clue placeholder (no faux illustration) ───────────────────────
function PictureClue({ label, size = 150, dim = false }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 20, position: 'relative', overflow: 'hidden',
      border: `2px dashed ${ARC.cardBorder}`, opacity: dim ? .5 : 1,
      backgroundImage: `repeating-linear-gradient(45deg, rgba(255,255,255,.05) 0 10px, transparent 10px 20px)`,
      backgroundColor: 'rgba(255,255,255,.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 }}>
      <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 10, letterSpacing: 1, color: ARC.faint, textTransform: 'uppercase' }}>picture</div>
      <div style={{ fontFamily: ARC.ui, fontWeight: 700, fontSize: 14, color: ARC.sub, textAlign: 'center', lineHeight: 1.25 }}>{label}</div>
    </div>
  );
}

// ── Starfield backdrop ────────────────────────────────────────────────────
function Starfield() {
  const stars = React.useMemo(() => Array.from({ length: 26 }, () => ({
    x: Math.random() * 100, y: Math.random() * 100, s: 2 + Math.random() * 4, d: 1.5 + Math.random() * 3, delay: Math.random() * 3,
    c: [ARC.lime, ARC.cyan, ARC.gold][Math.floor(Math.random() * 3)],
  })), []);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {stars.map((st, i) => (
        <span key={i} style={{ position: 'absolute', left: st.x + '%', top: st.y + '%', width: st.s, height: st.s, borderRadius: '50%', background: st.c, animation: `arcTwinkle ${st.d}s ${st.delay}s ease-in-out infinite` }} />
      ))}
    </div>
  );
}

// ── Confetti burst ────────────────────────────────────────────────────────
function Confetti({ run, count = 70 }) {
  const pieces = React.useMemo(() => Array.from({ length: count }, () => ({
    x: Math.random() * 100, delay: Math.random() * 0.5, dur: 1.8 + Math.random() * 1.4, size: 7 + Math.random() * 9,
    c: [ARC.pink, ARC.cyan, ARC.lime, ARC.gold, ARC.purple][Math.floor(Math.random() * 5)], rot: Math.random() * 360,
    round: Math.random() > 0.5,
  })), [run]);
  if (!run) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 60 }}>
      {pieces.map((p, i) => (
        <span key={i} style={{ position: 'absolute', left: p.x + '%', top: 0, width: p.size, height: p.size * (p.round ? 1 : 0.5),
          background: p.c, borderRadius: p.round ? '50%' : 2, transform: `rotate(${p.rot}deg)`,
          animation: `arcConfFall ${p.dur}s ${p.delay}s linear forwards` }} />
      ))}
    </div>
  );
}

// ── Screen shell ──────────────────────────────────────────────────────────
function ArcScreen({ children, style = {} }) {
  return (
    <div className="arc-screen" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
      background: `radial-gradient(120% 90% at 50% -10%, ${ARC.bg2}, ${ARC.bg0} 70%)`, fontFamily: ARC.ui, color: ARC.ink, ...style }}>
      <Starfield />
      {children}
    </div>
  );
}

Object.assign(window, { Bolt, VoiceChip, Equalizer, EngineBadge, NeonButton, GlowWord, Tile, PictureClue, Starfield, Confetti, ArcScreen });
