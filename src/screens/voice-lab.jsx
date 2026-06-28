/* voice-lab.jsx — parent/dev "Voice Lab": audition several ElevenLabs voices/models
   on the SAME phrase, compare how they sound + their latency, and pick the winner
   (which becomes Bolt's voice instantly via window.VoiceEngine.setVoice — a
   per-browser override of the .env default, no restart needed). Exports to window. */
import React from 'react';

const LAB_VOICES = [
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', blurb: 'Playful, bright, warm' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', blurb: 'Enthusiast, quirky' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', blurb: 'Clear educator · UK' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', blurb: 'Warm storyteller · UK' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', blurb: 'Confident, energetic' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', blurb: 'Mature, reassuring' },
];
const LAB_MODELS = [
  { value: 'eleven_multilingual_v2', label: 'Multilingual v2' },
  { value: 'eleven_turbo_v2_5', label: 'Turbo v2.5' },
  { value: 'eleven_flash_v2_5', label: 'Flash v2.5' },
];
const LAB_SPEEDS = [
  { value: 1, label: 'Normal' },
  { value: 0.85, label: 'Slow' },
  { value: 0.72, label: 'Slower' },
];

function VoiceLabScreen({ onBack }) {
  const A = window.ARC;
  const ve = window.VoiceEngine;
  const cfg = (ve && ve.state.config) || {};
  const [text, setText] = React.useState('Hi! I’m Bolt. Can you read this word for me?');
  const [model, setModel] = React.useState((ve && ve.state.model) || 'eleven_multilingual_v2');
  const [speed, setSpeed] = React.useState(1);
  const [results, setResults] = React.useState({}); // voice_id -> { ms, kb, loading, err }
  const [playingId, setPlayingId] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [current, setCurrent] = React.useState(
    (ve && ve.state.override && ve.state.override.voice_id) || cfg.ttsVoiceId || 'cgSgspJ2msm6clMCkdW9');
  const audioRef = React.useRef(null);
  const available = !!(cfg.keys && cfg.keys.elevenlabs);

  // a phrase/model/speed change invalidates the cached audio metrics
  React.useEffect(() => { setResults({}); }, [text, model, speed]);
  React.useEffect(() => () => { try { audioRef.current && audioRef.current.pause(); } catch (e) {} }, []);

  function stopAudio() {
    if (audioRef.current) { try { audioRef.current.pause(); } catch (e) {} audioRef.current = null; }
    setPlayingId(null);
  }

  function play(v) {
    return new Promise(async (resolve) => {
      stopAudio();
      setResults((r) => ({ ...r, [v.id]: { ...(r[v.id] || {}), loading: true, err: null } }));
      try {
        const t0 = performance.now();
        const resp = await fetch('/api/tts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice_id: v.id, model_id: model, ...(speed !== 1 ? { speed } : {}) }),
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const buf = await resp.arrayBuffer();
        const ms = Math.round(performance.now() - t0);
        const url = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }));
        setResults((r) => ({ ...r, [v.id]: { ms, kb: Math.round(buf.byteLength / 1024), loading: false, err: null } }));
        const audio = new Audio(url);
        audioRef.current = audio; setPlayingId(v.id);
        const done = () => { try { URL.revokeObjectURL(url); } catch (e) {} if (audioRef.current === audio) { audioRef.current = null; setPlayingId(null); } resolve(); };
        audio.onended = done; audio.onerror = done;
        await audio.play();
      } catch (e) {
        setResults((r) => ({ ...r, [v.id]: { loading: false, err: e.message } }));
        setPlayingId(null); resolve();
      }
    });
  }

  async function playAll() {
    setBusy(true);
    for (const v of LAB_VOICES) { if (!busy) await play(v); }
    setBusy(false);
  }

  function useVoice(v) {
    if (ve && ve.setVoice) ve.setVoice(v.id, model, v.name);
    setCurrent(v.id);
    // a quick confirmation in Bolt's new voice
    if (window.ttsSay) window.ttsSay(`Hi! I’m ${v.name}. Let’s read together!`);
  }

  return (
    <window.ArcScreen>
      <div style={{ position: 'relative', height: '100%', padding: '30px 56px 0', display: 'flex', flexDirection: 'column' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <window.Bolt size={60} mood="idle" />
          <div>
            <div style={{ fontFamily: A.display, fontWeight: 600, fontSize: 30, letterSpacing: -.5 }}>Voice Lab</div>
            <div style={{ fontFamily: A.ui, fontSize: 14, color: A.sub }}>Audition Bolt’s voice — same line, every voice. Pick the one you like.</div>
          </div>
          <button className="arc-btn" onClick={onBack}
            style={{ marginLeft: 'auto', background: 'rgba(255,255,255,.06)', border: `2px solid ${A.cardBorder}`, color: A.sub, borderRadius: 30, padding: '9px 18px', fontFamily: A.ui, fontWeight: 800, fontSize: 14 }}>← Back to setup</button>
        </div>

        {!available && (
          <div style={{ background: 'rgba(255,210,63,.1)', border: `2px solid ${A.gold}55`, borderRadius: 14, padding: '12px 18px', marginBottom: 14, fontFamily: A.ui, fontSize: 13.5, color: A.gold }}>
            No ElevenLabs key detected — add <b>ELEVENLABS_API_KEY</b> to <code>.env</code> and restart to audition voices.
          </div>
        )}

        {/* phrase + model controls */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontFamily: A.ui, fontWeight: 800, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: A.faint, marginBottom: 8 }}>Test phrase</div>
            <input value={text} onChange={(e) => setText(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.06)', border: `2px solid ${A.cardBorder}`, borderRadius: 12, padding: '11px 14px', color: '#fff', fontFamily: A.ui, fontSize: 15, outline: 'none' }} />
          </div>
          <div>
            <div style={{ fontFamily: A.ui, fontWeight: 800, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: A.faint, marginBottom: 8 }}>Model</div>
            <window.Segmented options={LAB_MODELS} value={model} onChange={setModel} color={A.purple} />
          </div>
          <div>
            <div style={{ fontFamily: A.ui, fontWeight: 800, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: A.faint, marginBottom: 8 }}>Speed</div>
            <window.Segmented options={LAB_SPEEDS} value={speed} onChange={setSpeed} color={A.gold} />
          </div>
          <button className="arc-btn" onClick={playAll} disabled={!available || busy}
            style={{ background: busy ? 'rgba(255,255,255,.08)' : A.cyan, color: busy ? A.faint : '#160d33', borderRadius: 30, padding: '12px 20px', fontFamily: A.ui, fontWeight: 800, fontSize: 14.5, opacity: available ? 1 : .5 }}>
            {busy ? 'Playing…' : '▶ Play all'}
          </button>
        </div>

        {/* voice rows */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
          {LAB_VOICES.map((v) => {
            const res = results[v.id] || {};
            const isCurrent = v.id === current;
            const isPlaying = playingId === v.id;
            return (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: isCurrent ? 'rgba(45,226,230,.10)' : A.card, border: `2px solid ${isCurrent ? A.cyan : A.cardBorder}`, borderRadius: 16, padding: '12px 16px' }}>
                <button className="arc-btn" onClick={() => play(v)} disabled={!available} title="Play this voice"
                  style={{ flex: '0 0 auto', width: 46, height: 46, borderRadius: 23, background: isPlaying ? A.cyan : 'rgba(255,255,255,.08)', color: isPlaying ? '#160d33' : '#fff', border: `2px solid ${isPlaying ? A.cyan : A.cardBorder}`, fontSize: 18 }}>
                  {res.loading ? '…' : isPlaying ? '❚❚' : '▶'}
                </button>
                <div style={{ minWidth: 150 }}>
                  <div style={{ fontFamily: A.ui, fontWeight: 800, fontSize: 16, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {v.name}
                    {isCurrent && <span style={{ fontSize: 11, fontWeight: 800, color: A.cyan, background: 'rgba(45,226,230,.16)', border: `1px solid ${A.cyan}66`, borderRadius: 20, padding: '2px 9px' }}>Bolt’s voice</span>}
                  </div>
                  <div style={{ fontFamily: A.ui, fontSize: 12.5, color: A.sub }}>{v.blurb}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 18 }}>
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12.5, color: res.err ? A.pink : A.faint, minWidth: 120, textAlign: 'right' }}>
                    {res.err ? `error: ${res.err}` : res.ms != null ? `${res.ms} ms · ${res.kb} KB` : '—'}
                  </div>
                  <button className="arc-btn" onClick={() => useVoice(v)} disabled={!available || isCurrent}
                    style={{ background: isCurrent ? 'transparent' : `${A.lime}22`, color: isCurrent ? A.faint : A.lime, border: `2px solid ${isCurrent ? 'rgba(255,255,255,.12)' : A.lime + '66'}`, borderRadius: 30, padding: '9px 16px', fontFamily: A.ui, fontWeight: 800, fontSize: 13.5 }}>
                    {isCurrent ? 'In use' : 'Use this'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ fontFamily: A.ui, fontSize: 12, color: A.faint, padding: '12px 0 18px' }}>
          Timing is request→audio latency on the chosen model. Your pick is saved in this browser and used immediately — the <code>.env</code> default still applies elsewhere.
        </div>
      </div>
    </window.ArcScreen>
  );
}

Object.assign(window, { VoiceLabScreen });
