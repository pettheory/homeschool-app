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
app.get('/api/config', (_req, res) => {
  res.json({
    approach: process.env.ACTIVE_APPROACH || 'B',
    textProcessingModel: process.env.TEXT_PROCESSING_MODEL || 'gpt-5.4-nano',
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
app.post('/api/realtime/session', async (req, res) => {
  if (!process.env.OPENAI_API_KEY) return res.status(400).json({ error: 'OPENAI_API_KEY not configured' });
  try {
    const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: req.body.model || 'gpt-4o-realtime-preview',
        voice: req.body.voice || 'shimmer',
        input_audio_transcription: { model: 'whisper-1' },
      }),
    });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });
    res.json(await r.json());
  } catch (e) {
    console.error('[realtime] session error:', e);
    res.status(500).json({ error: 'Failed to mint realtime session' });
  }
});

// ── Engine C: ElevenLabs TTS proxy (Bolt's higher-quality voice) ─────────────
app.post('/api/tts', async (req, res) => {
  if (!process.env.ELEVENLABS_API_KEY) return res.status(400).json({ error: 'ELEVENLABS_API_KEY not configured' });
  try {
    const { text, voice_id = 'EXAVITQu4vr4xnSDxMaL' } = req.body;
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.7, similarity_boost: 0.8 } }),
    });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    console.error('[tts] error:', e);
    res.status(500).json({ error: 'TTS failed' });
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
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, response_format: { type: 'json_object' }, temperature: 0.1 }),
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[server] Word Lab backend on http://localhost:${PORT}`));
