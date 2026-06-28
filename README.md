# Word Lab — Reading & Spelling Assistant

A browser-based, voice-driven AI tutor that helps a 9–10 year old practise
**reading fluency** and **spelling**. A parent/dev configures a session; the
child plays mostly hands-free using their voice.

This is the **Arcade** design build — a faithful Vite + React port of the
validated prototype (see the `handoff/` package for the full design system,
UX spec, and the tolerance-engine IP).

---

## What this build does (and doesn't) yet

- ✅ The full validated **UX**: setup → reading / spelling games → celebration → summary.
- ✅ The **tolerance engine** (`src/lib/phonetics.js`): forgiving verdicts, the
  sound-alike "confirm" gate, "start over" handling, phonetic-alphabet parsing.
  All `TOLERANCE_SPEC §6` regression cases pass.
- ✅ **Real mic** input via the browser Web Speech API (Chrome), plus a
  "stand-in for the child's voice" demo bar for deterministic testing. During
  **spelling** the mic stays continuously listening (auto-restarts through pauses)
  with a live "Listening… tap to stop" control — click "🎤 Use mic" once per word.
- ✅ **Phase 4 — ElevenLabs TTS is wired end-to-end.** Add `ELEVENLABS_API_KEY`
  to `.env` and Bolt speaks with the real ElevenLabs voice (front-end → `/api/tts`
  → ElevenLabs). The voice (`ELEVENLABS_VOICE_ID`, default Jessica) and model
  (`ELEVENLABS_MODEL`, default `eleven_multilingual_v2`) are configurable. With no
  key it falls back to the browser voice, so the app always runs — and a HUD chip
  shows which voice is actually playing (`🗣 Jessica` vs `⚠️ Browser voice`) so a
  silent autoplay→browser downgrade is never hidden.
- ✅ **Voice Lab** (setup → 🎚 Voice Lab): audition several ElevenLabs voices/models
  on the same phrase (with a **Normal/Slow/Slower** speed control), compare first-byte
  latency, and pick Bolt's voice — saved per-browser, used immediately (overrides the
  `.env` default, no restart).
- ✅ **Clear spelling prompts.** When asking the child to spell, Bolt says the word
  **slowly** (ElevenLabs `voice_settings.speed` ≈ 0.75) so quick words like "because"
  are enunciated clearly. `/api/tts` takes an optional `speed` (0.7–1.2).
- ✅ **Phase 4 — the cheap-LLM judge is wired for reading.** When a key is present,
  `/api/judge` (OpenAI `gpt-5.4-nano` or Google `gemini-3.1-flash-lite`) grades the
  spoken reading and is reconciled with the tolerance engine (more-forgiving wins;
  PHON stays the authority + fallback). Spelling stays on the deterministic letter
  engine by design.
- 🔌 **Phase 4 — server-ready, not yet called from the UI:** the OpenAI Realtime
  voice session (`/api/realtime/session`, `gpt-realtime-2`) for real-time STT/voice.
- A/B/C engine **latencies** remain **simulated** from `engine-profiles.js` (they
  shape the *feel*; they don't gate which provider is called).
- The Express server in `server/` reads keys from `.env` and **never** sends them
  to the browser — `/api/config` reports only each key's presence.

> **Browser:** use **Google Chrome**. The Web Speech API (mic) only works in a
> secure context — that means **HTTPS or `localhost`**. A dev server reached over
> the LAN (`http://192.168.…`) will not get mic permission.

---

## Run locally

```bash
npm install
npm run dev        # Vite (5173) + Express (3001) together
```

Open **http://localhost:5173** in Chrome. `localhost` is a secure context, so the
real-mic button works. No API keys are needed to run the simulated build.

Frontend only (no server): `npm run dev:client` (Bolt uses the browser voice; the
`/api` engines are unavailable without the server).

---

## Configure API keys

All keys live in a single **`.env`** file at the project root (gitignored; never
committed). Copy the template and fill in only the engine(s) you want to turn on:

```bash
cp .env.example .env   # already done if .env exists
```

| Key | Turns on | Used by |
|-----|----------|---------|
| `ELEVENLABS_API_KEY` | **Bolt's real voice (wired now)** | `/api/tts` → ElevenLabs (`ELEVENLABS_VOICE_ID` · `ELEVENLABS_MODEL`) |
| `OPENAI_API_KEY` | LLM judge and/or Realtime voice | `/api/judge` (`gpt-5.4-nano`), `/api/realtime/session` (`gpt-realtime-2`) |
| `GEMINI_API_KEY` | LLM judge (Google alternative) | `/api/judge` when `TEXT_PROCESSING_MODEL=gemini-3.1-flash-lite` |
| `GOOGLE_STT_API_KEY` | *(optional, unused)* Google Cloud Speech-to-Text | not wired — STT is the browser Web Speech API today |

Model names, Bolt's voice, and the backend port are also set in `.env`
(`TEXT_PROCESSING_MODEL`, `REALTIME_MODEL`, `ELEVENLABS_MODEL`, `ELEVENLABS_VOICE_ID`,
`SERVER_PORT`). After editing `.env`, **restart `npm run dev`** — the Express server
reads it at boot. The active config is visible at `http://localhost:3001/api/config`.

`ELEVENLABS_API_KEY` (Bolt's voice) and `OPENAI_API_KEY`/`GEMINI_API_KEY` (the reading
judge) both produce visible changes today. The Realtime key only makes that endpoint
live; it isn't called by the front-end yet.

---

## Testing & CI

- **Unit tests** (`npm test`, vitest): cover the tolerance engine (`test/phonetics.test.js`).
  Fast, offline, no keys. `npm run test:watch` for TDD.
- **CI** (`.github/workflows/ci.yml`): runs `npm run build` + `npm test` on every push/PR —
  the gate a routine's PR must pass before a human merges.
- A local **Stop hook** (`.claude/settings.json`) re-runs unit tests when you've changed
  `src/`, `server/`, or `index.html` this turn. Remove that hook block to disable.

### The synthetic speaker (integration)

`scripts/synthetic-speaker.mjs` tests the reading pipeline with **generated speech
instead of a human**: it synthesizes each "child" utterance with ElevenLabs, sends
the audio through real STT (`/api/transcribe` → OpenAI), and judges the result —
asserting the verdict end-to-end.

```bash
npm run dev        # in one terminal (needs OPENAI_API_KEY + ELEVENLABS_API_KEY)
npm run test:voice # in another → prints a PASS/FAIL table, exits non-zero on failure
```

Each row shows what was spoken, what STT heard, and the verdict — so you can spot
where speech→text→judge drifts. Edit the `CASES` array to add words/utterances.
(The live game still hears the child via the browser Web Speech API; this harness
uses a server STT so it can run headless, validating the judge + speech realism.)

---

## Deploy to Vercel (static)

The current build is a static SPA, so it deploys with no server and gets HTTPS
(which the mic needs on a tablet):

```bash
npm i -g vercel      # if needed
vercel               # first run links/creates the project
vercel --prod        # production deploy
```

Or connect the GitHub repo at vercel.com → it auto-detects Vite (`vite build` →
`dist/`). `vercel.json` is already configured.

When you reach Phase 4 and need the real engines, move `server/`'s routes into
Vercel serverless functions (`/api/*`) or host the Express server separately, and
add the API keys as Vercel environment variables (never commit `.env`).

---

## Project layout

```
src/lib/         phonetics.js (tolerance engine) · engine-profiles.js · words.js
src/screens/     arcade-kit (design system) · setup-summary · hud-reading · spelling
src/App.jsx      session routing, queue, scoring
server/index.js  Phase 4 backend seam (realtime token mint, TTS proxy, LLM judge)
handoff/         the original design package (specs + prototype) — reference
```

See `handoff/README.md` for the full design intent and `handoff/TOLERANCE_SPEC.md`
for the core IP.
