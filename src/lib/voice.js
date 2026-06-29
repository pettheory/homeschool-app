/* voice.js — Bolt's voice, wired for real.
 *
 * This is the first Phase 4 engine connected end-to-end: front-end → /api/tts →
 * ElevenLabs. When the server reports an ElevenLabs key (via /api/config), Bolt
 * speaks with the real high-quality voice; otherwise we fall back to the browser
 * SpeechSynthesis API so the UX never breaks (no key, no server, or offline).
 *
 * No API key is ever exposed to the browser — /api/config returns only the
 * PRESENCE of each key. Loaded before the screens so window.VoiceEngine exists;
 * screens call window.ttsSay, which delegates here.
 */
(function () {
  const state = {
    config: null,        // /api/config result, once loaded
    ready: false,        // config probe resolved (success or fail)
    useEleven: false,    // ElevenLabs key present → use real TTS
    audio: null,         // currently-playing HTMLAudioElement (real TTS)
    browserVoice: null,  // picked SpeechSynthesis voice (fallback)
    voiceName: null,     // active ElevenLabs voice name (from /api/config)
    model: null,         // active ElevenLabs model (from /api/config)
    lastSource: null,    // 'elevenlabs' | 'browser' — path the LAST utterance actually took
    unlocked: false,     // audio playback primed by a user gesture?
    audioCtx: null,
    override: null,      // { voice_id, model_id, name } chosen in the Voice Lab (localStorage)
  };

  // Subscribers (the HUD voice-source indicator) — notified when lastSource changes.
  const listeners = new Set();
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function notify() { listeners.forEach((fn) => { try { fn(state); } catch (e) {} }); }
  function setSource(src) { if (state.lastSource !== src) { state.lastSource = src; notify(); } }

  // ── Voice Lab pick: a per-browser override that beats the .env default, applied
  // by sending voice_id/model_id on /api/tts. Persisted in localStorage. ──
  try { state.override = JSON.parse(localStorage.getItem('boltVoice') || 'null'); } catch (e) {}
  function applyOverrideLabels() {
    if (state.override) {
      if (state.override.name) state.voiceName = state.override.name;
      if (state.override.model_id) state.model = state.override.model_id;
    }
  }
  function setVoice(voice_id, model_id, name) {
    state.override = { voice_id, model_id, name };
    try { localStorage.setItem('boltVoice', JSON.stringify(state.override)); } catch (e) {}
    applyOverrideLabels(); notify();
  }
  function clearVoice() {
    state.override = null;
    try { localStorage.removeItem('boltVoice'); } catch (e) {}
    if (state.config) { state.voiceName = state.config.ttsVoiceName || null; state.model = state.config.ttsModel || null; }
    notify();
  }

  // ── One-time probe: which engines are actually available (keys present) ──
  const ready = (async () => {
    try {
      const r = await fetch('/api/config');
      if (r.ok) {
        state.config = await r.json();
        state.useEleven = !!(state.config.keys && state.config.keys.elevenlabs);
        state.voiceName = state.config.ttsVoiceName || null;
        state.model = state.config.ttsModel || null;
      }
    } catch (e) {
      /* no server (e.g. `npm run dev:client`) → stay on the browser voice */
    }
    applyOverrideLabels(); // a Voice Lab pick wins over the .env default
    state.ready = true;
    try {
      console.info(`[voice] Bolt → ${state.useEleven
        ? 'ElevenLabs (' + (state.model || 'real') + (state.voiceName ? ', ' + state.voiceName : '') + ')'
        : 'browser SpeechSynthesis (fallback)'}`);
    } catch (e) {}
    notify();
    return state.config;
  })();

  // ── Prime audio playback on a user gesture (the "Start session" click) so the
  // first ElevenLabs clip isn't blocked by the browser autoplay policy and
  // silently downgraded to the browser voice. Safe to call repeatedly. ──
  function unlock() {
    if (state.unlocked) return;
    state.unlocked = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { state.audioCtx = state.audioCtx || new AC(); if (state.audioCtx.state === 'suspended') state.audioCtx.resume(); }
    } catch (e) {}
  }

  // ── Browser fallback voice pick ──
  function pickVoice() {
    try {
      const vs = speechSynthesis.getVoices();
      state.browserVoice = vs.find((v) => /samantha|karen|google uk english female|google us english/i.test(v.name))
        || vs.find((v) => v.lang && v.lang.startsWith('en')) || vs[0] || null;
    } catch (e) {}
  }
  if (typeof speechSynthesis !== 'undefined') { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

  function cancel() {
    try { speechSynthesis.cancel(); } catch (e) {}
    if (state.audio) { try { state.audio.pause(); } catch (e) {} state.audio = null; }
  }

  function browserSay(text, opts = {}) {
    setSource('browser');
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (state.browserVoice) u.voice = state.browserVoice;
      // opts.speed (ElevenLabs scale ~0.7–1.2) maps onto the browser rate so "say it
      // slowly" works in the fallback path too.
      u.rate = opts.speed != null ? opts.speed : (opts.rate != null ? opts.rate : 0.96);
      u.pitch = opts.pitch != null ? opts.pitch : 1.12;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  async function elevenSay(text, opts = {}) {
    cancel(); // never overlap utterances
    const ov = state.override || {};
    const body = { text };
    if (ov.voice_id) body.voice_id = ov.voice_id;
    if (ov.model_id) body.model_id = ov.model_id;
    if (opts.speed != null) body.speed = opts.speed; // slow, deliberate enunciation
    const r = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('tts ' + r.status);
    const buf = await r.arrayBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }));
    const audio = new Audio(url);
    state.audio = audio;
    const cleanup = () => { try { URL.revokeObjectURL(url); } catch (e) {} if (state.audio === audio) state.audio = null; };
    audio.onended = cleanup; audio.onerror = cleanup;
    await audio.play();      // rejects if autoplay-blocked → caller falls back to browser voice
    setSource('elevenlabs'); // only on successful playback
  }

  // ── Public speak(): mute-aware, real engine with a browser fallback ──
  function speak(text, opts = {}) {
    if (!text || window.__soundOn === false) return;
    const go = () => {
      if (state.useEleven) {
        elevenSay(text, opts).catch((e) => {
          try { console.warn('[voice] ElevenLabs failed — falling back to browser voice:', e.message); } catch (_) {}
          browserSay(text, opts);
        });
      } else {
        browserSay(text, opts);
      }
    };
    // First utterance(s) wait for the one-time probe; the screens' state machines
    // advance on their own timers, so a brief async delay can never stall the game.
    if (state.ready) go(); else ready.then(go);
  }

  window.VoiceEngine = { speak, cancel, unlock, subscribe, setVoice, clearVoice, ready, state };
})();
