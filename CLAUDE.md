# Word Lab — project guide for Claude

Browser voice tutor that helps a 9–10 yo practise **reading** and **spelling**. A
parent/dev configures a session; the child plays mostly hands-free by voice.

## Stack & run
- **Vite + React** SPA (`src/`) + an **Express** backend seam (`server/`) for the real
  voice/AI engines. ES modules; screens attach to `window` (see `src/main.jsx`).
- `npm run dev` → Vite on **5173** + Express on **3001** (Vite proxies `/api` → 3001).
- `npm run build` (compile gate) · `npm test` (vitest unit tests) · `npm run test:voice`
  (integration harness: ElevenLabs→STT→judge; needs keys + a running dev server).
- Use **Chrome**: the mic (Web Speech API) needs a secure context (localhost/HTTPS).

## Architecture map
- `src/lib/phonetics.js` — **the tolerance engine** (`window.PHON`): the forgiving verdict
  authority for reading & spelling. Pure logic; covered by `test/phonetics.test.js`.
- `src/lib/voice.js` — Bolt's voice (`window.VoiceEngine`): ElevenLabs TTS via `/api/tts`,
  browser-speech fallback, per-browser voice override (the Voice Lab).
- `src/lib/judge.js` — reading judge (`window.Judge`): OpenAI/Gemini via `/api/judge`,
  reconciled with PHON (more-forgiving wins; **PHON stays the authority + fallback**).
- `server/index.js` — `/api/config`, `/api/tts`, `/api/judge`, `/api/transcribe`,
  `/api/realtime/session`. Reads keys from `.env`; **never** sends keys to the browser.
- Config/keys in `.env` (gitignored; template `.env.example`).

## Pedagogy & AI usage (non-negotiable)
- **Realtime/LLM AI grades READING only.** Reading suits conversational coaching and a small
  slip is harmless. **SPELLING is always graded by the deterministic tolerance engine** + the
  sound-alike confirm gate — never by realtime or an LLM. A model that mishears B/P/D and then
  *asserts* right/wrong mis-teaches and can confuse the child; the deterministic engine never
  declares a wrong answer, it asks ("did you mean B or P?").
- In spelling, AI may only **voice Bolt** (TTS) — never evaluate the child's letters. See
  `docs/specs/realtime-reading-only.md`.

## Conventions
- Match the surrounding style; keep the `window.*` attach pattern. Don't add deps without need.
- Secrets only in `.env`. Never commit keys.
- Verify before finishing: `npm run build` + `npm test`; for previewable UI, run the dev server.

## Autonomous loops (spec → build → review)
This repo is set up for Claude "routines" coordinated through **Git**:
- **Specs** are the source of truth in `docs/specs/*.md` (see `docs/specs/README.md` +
  `TEMPLATE.md`). Author them interactively with **`/spec`**.
- **Flow:** spec PR → *(build routine)* implements on a `feat/<slug>` branch **with tests** →
  feature PR → *(review routine)* reviews → **a human reviews & merges.**
- **Safety (non-negotiable):** loops **propose via PR only**. Never push to or merge the
  default branch. CI (`.github/workflows/ci.yml`) must be green before a human merges.
- Keep branches short-lived and PRs focused on a single spec.
