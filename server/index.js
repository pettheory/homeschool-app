/* server/index.js — Express backend.
 *
 * The validated Arcade prototype runs fully client-side: Bolt speaks via the
 * browser SpeechSynthesis API and the mic uses the Web Speech API, while each
 * engine's latency/cadence is simulated from engine-profiles.js. That is the
 * Phase 0–3 deliverable (the UX contract) and needs no server.
 *
 * This server is the Phase 4 seam (see handoff/IMPLEMENTATION_PLAN.md): where
 * the real voice/AI engines get wired behind the SAME UX contract. It already
 * mints what the real engines need from the keys in `.env`, so switching the
 * front end from simulated voice to a real engine is an additive change, not a
 * rewrite. No keys are ever sent to the browser — only their presence.
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Config: which engine is active + which keys are present (never the keys) ──
// Friendly names for the curated ElevenLabs voices (so the UI can show who's speaking).
const VOICE_NAMES = {
  cgSgspJ2msm6clMCkdW9: 'Jessica',
  FGY2WhTYpPnrIDTdsKH5: 'Laura',
  Xb7hH8MSUJpSbSDYk0k2: 'Alice',
  JBFqnCBsd6RMkjVDRZzb: 'George',
  EXAVITQu4vr4xnSDxMaL: 'Sarah',
};
app.get('/api/config', (_req, res) => {
  const ttsVoiceId = process.env.ELEVENLABS_VOICE_ID || 'cgSgspJ2msm6clMCkdW9';
  res.json({
    approach: process.env.ACTIVE_APPROACH || 'B',
    textProcessingModel: process.env.TEXT_PROCESSING_MODEL || 'gpt-5.4-nano',
    realtimeModel: process.env.REALTIME_MODEL || 'gpt-realtime-2',
    ttsModel: process.env.ELEVENLABS_MODEL || 'eleven_v3',
    ttsVoiceId,
    ttsVoiceName: VOICE_NAMES[ttsVoiceId] || 'custom',
    wordListMode: process.env.WORD_LIST_MODE || 'mixed',
    keys: {
      openai: !!process.env.OPENAI_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      elevenlabs: !!process.env.ELEVENLABS_API_KEY,
      googleStt: !!process.env.GOOGLE_STT_API_KEY,
    },
  });
});

// ── Engine A/B: mint an ephemeral OpenAI Realtime session token ──────────────
// The browser uses this short-lived secret to open the WebRTC session directly;
// the long-lived key never leaves the server.
//
// Current API (2026): POST /v1/realtime/client_secrets with the session config
// nested under `session` (type/model/audio). This replaced the older
// /v1/realtime/sessions + flat body + gpt-4o-realtime-preview shape.
// See https://developers.openai.com/api/docs/guides/realtime-webrtc
app.post('/api/realtime/session', async (req, res) => {
  if (!process.env.OPENAI_API_KEY) return res.status(400).json({ error: 'OPENAI_API_KEY not configured' });
  // Caller may pass a full `session` object to override; otherwise sensible current defaults.
  const session = req.body.session || {
    type: 'realtime',
    model: req.body.model || process.env.REALTIME_MODEL || 'gpt-realtime-2',
    audio: {
      input: { transcription: { model: req.body.transcribeModel || 'gpt-4o-transcribe' } },
      output: { voice: req.body.voice || 'marin' },
    },
  };
  try {
    const r = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ session }),
    });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });
    res.json(await r.json());
  } catch (e) {
    console.error('[realtime] session error:', e);
    res.status(500).json({ error: 'Failed to mint realtime session' });
  }
});

// ── Engine C: ElevenLabs TTS proxy (Bolt's higher-quality voice) ─────────────
// Pause markup: callers write SSML `<break time="Xs"/>` (works on v2 models). Eleven v3
// doesn't support SSML breaks — it uses expressive audio tags — so we translate here,
// keeping the server the single place that knows which markup the final model needs.
function adaptMarkup(text, model_id) {
  if (!/^eleven_v3/.test(model_id)) return text;
  return String(text)
    .replace(/<break\s+time="([\d.]+)s?"\s*\/>/gi, (_, s) => {
      const t = parseFloat(s);
      return t >= 1 ? ' [long pause] ' : t >= 0.7 ? ' [pause] ' : ' [short pause] ';
    })
    .replace(/<break[^>]*\/>/gi, ' [pause] ');
}

app.post('/api/tts', async (req, res) => {
  if (!process.env.ELEVENLABS_API_KEY) return res.status(400).json({ error: 'ELEVENLABS_API_KEY not configured' });
  try {
    // Voice + model are config-driven (ELEVENLABS_VOICE_ID / ELEVENLABS_MODEL), with a
    // per-request override so the Voice Lab can audition options. Defaults: a warm,
    // kid-friendly voice (Jessica) and eleven_v3 — the most expressive model, with
    // audio-tag markup ability.
    const voice_id = req.body.voice_id || process.env.ELEVENLABS_VOICE_ID || 'cgSgspJ2msm6clMCkdW9';
    const model_id = req.body.model_id || process.env.ELEVENLABS_MODEL || 'eleven_v3';
    const text = adaptMarkup(req.body.text, model_id);
    // `speed` (0.7–1.2, <1 = slower) lets callers ask for slow, deliberate enunciation —
    // e.g. saying the word to SPELL. v3 gets a minimal settings object (its stability
    // works on coarse presets and it rejects some v2-era fields).
    const voice_settings = /^eleven_v3/.test(model_id)
      ? { stability: 0.5, ...(req.body.voice_settings || {}) }
      : { stability: 0.5, similarity_boost: 0.8, style: 0, use_speaker_boost: true, ...(req.body.voice_settings || {}) };
    if (req.body.speed != null) voice_settings.speed = Math.max(0.7, Math.min(1.2, req.body.speed));
    // Ground truth of what actually got synthesized — lands in the service log
    // (.loops/shawl_for_word-lab-api_*.log), so "which model played?" is never guesswork.
    console.log(`[tts] model=${model_id} voice=${voice_id} speed=${voice_settings.speed ?? 'default'} text="${String(text).slice(0, 60)}${String(text).length > 60 ? '…' : ''}"`);
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id, voice_settings }),
    });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    console.error('[tts] error:', e);
    res.status(500).json({ error: 'TTS failed' });
  }
});

// ── Speech-to-text (for the synthetic-speaker test harness) ──────────────────
// Accepts raw audio bytes and transcribes them via OpenAI. Used by
// scripts/synthetic-speaker.mjs to "hear" generated ElevenLabs audio as text —
// automated end-to-end testing of the reading pipeline with no human at the mic.
// (The live game still hears the child via the browser Web Speech API.)
app.post('/api/transcribe', express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '25mb' }), async (req, res) => {
  if (!process.env.OPENAI_API_KEY) return res.status(400).json({ error: 'OPENAI_API_KEY not configured' });
  try {
    const model = req.query.model || process.env.STT_MODEL || 'gpt-4o-transcribe';
    const form = new FormData();
    form.append('file', new Blob([req.body], { type: req.headers['content-type'] || 'audio/mpeg' }), 'audio.mp3');
    form.append('model', model);
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, // fetch sets multipart boundary
      body: form,
    });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });
    res.json(await r.json());
  } catch (e) {
    console.error('[transcribe] error:', e);
    res.status(500).json({ error: 'transcription failed' });
  }
});

// ── Engine C: cheap-LLM judge ────────────────────────────────────────────────
// The verdict shape returned here must match PHON.evalReading / PHON.evalSpelling
// (see handoff/TOLERANCE_SPEC.md) so the UI stays engine-agnostic. The tolerance
// engine remains the authority; an LLM judge is an optional accuracy boost.
app.post('/api/judge', async (req, res) => {
  const model = process.env.TEXT_PROCESSING_MODEL || 'gpt-5.4-nano';
  const { messages } = req.body;
  try {
    if (model.startsWith('gpt')) {
      if (!process.env.OPENAI_API_KEY) return res.status(400).json({ error: 'OPENAI_API_KEY not configured' });
      // NB: GPT-5-series (e.g. gpt-5.4-nano) only accept the default temperature on
      // Chat Completions, so we omit it. Determinism comes from the prompt + json_object.
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, response_format: { type: 'json_object' } }),
      });
      if (!r.ok) return res.status(r.status).json({ error: await r.text() });
      return res.json(await r.json());
    }
    if (model.startsWith('gemini')) {
      if (!process.env.GEMINI_API_KEY) return res.status(400).json({ error: 'GEMINI_API_KEY not configured' });
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
            systemInstruction: { parts: [{ text: messages.find((m) => m.role === 'system')?.content || '' }] },
            generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
          }),
        },
      );
      if (!r.ok) return res.status(r.status).json({ error: await r.text() });
      const data = await r.json();
      return res.json({ choices: [{ message: { content: data.candidates?.[0]?.content?.parts?.[0]?.text || '{}' } }] });
    }
    res.status(400).json({ error: `Unsupported model: ${model}` });
  } catch (e) {
    console.error('[judge] error:', e);
    res.status(500).json({ error: 'Judge failed' });
  }
});

// Dedicated backend port (NOT the generic PORT): in dev, `npm run dev` runs Vite
// and this server side-by-side, and tooling/hosts often inject PORT for the
// front-end. Using SERVER_PORT keeps the API on a stable port the Vite proxy
// (vite.config.js → localhost:3001) can always reach.
const PORT = process.env.SERVER_PORT || 3001;
app.listen(PORT, () => console.log(`[server] Word Lab backend on http://localhost:${PORT}`));
