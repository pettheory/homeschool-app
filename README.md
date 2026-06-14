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
  "stand-in for the child's voice" demo bar for deterministic testing.
- ✅ Bolt speaks via the browser SpeechSynthesis API; A/B/C engine latencies are
  **simulated** from `engine-profiles.js`.
- ⏳ **Phase 4 (not wired yet):** the real voice engines — OpenAI Realtime,
  ElevenLabs TTS, and the cheap-LLM judge. The Express server in `server/` is
  the seam where these get wired behind the same UX contract; it reads keys from
  `.env` and never sends them to the browser.

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
real-mic button works. No API keys are needed for this build.

Frontend only (no server): `npm run dev:client`

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
