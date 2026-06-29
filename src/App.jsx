/* App.jsx — app root: routing, session state, queue building, scoring.
   Ported from the prototype's <App> (the source of truth). Screens and content
   are read off `window` (populated by the side-effect imports in main.jsx). */
import React from 'react';

const { useState } = React;

export default function App() {
  const [screen, setScreen] = useState('setup'); // setup | play | summary
  const [config, setConfig] = useState({ mode: 'mixed', listId: 'starter', approach: 'B', phoneticCoach: true, sensitivity: 'forgiving', length: 6 });
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [stars, setStars] = useState(0);
  const [results, setResults] = useState([]);

  function start() {
    // This runs inside the Start-session click — prime audio so the first ElevenLabs
    // clip isn't autoplay-blocked and silently downgraded to the browser voice.
    if (window.VoiceEngine && window.VoiceEngine.unlock) window.VoiceEngine.unlock();
    const list = window.WORDS.list(config.listId);
    const words = list.words.slice(0, config.length);
    const q = words.map((w, i) => ({
      data: w,
      mode: config.mode === 'mixed' ? (i % 2 === 0 ? 'reading' : 'spelling') : config.mode,
    }));
    setQueue(q); setIndex(0); setStreak(0); setStars(0); setResults([]); setScreen('play');
  }

  function handleResult(r) {
    // POC: no persistence — session summary is the only record (see spec).
    console.log('[result]', JSON.stringify(r));
    setResults((rs) => [...rs, r]);
    const win = r.outcome === 'correct' || r.outcome === 'close';
    setStreak((s) => (win ? s + 1 : 0));
    setStars((s) => s + (r.stars || 0));
    if (index + 1 >= queue.length) setTimeout(() => setScreen('summary'), 50);
    else setIndex((i) => i + 1);
  }

  if (screen === 'setup') return <window.SetupScreen config={config} setConfig={setConfig} onStart={start} onOpenLab={() => setScreen('voicelab')} />;
  if (screen === 'voicelab') return <window.VoiceLabScreen onBack={() => setScreen('setup')} />;
  if (screen === 'summary') return <window.SummaryScreen results={results} config={config} onReplay={start} onSetup={() => setScreen('setup')} />;

  const cur = queue[index];
  if (!cur) return null;
  const hud = { streak, stars, index, total: queue.length, onExit: () => setScreen('summary') };
  const Screen = cur.mode === 'spelling' ? window.SpellingScreen : window.ReadingScreen;
  return <Screen key={index + cur.mode} word={cur.data} config={config} hud={hud} onResult={handleResult} />;
}
