# Session capture & replay — record real mic sessions, analyze later, promote failures to tests

- **Slug:** session-capture-replay
- **Status:** building   <!-- draft → ready → building → done -->
- **Owner:** dnichol

## Problem / why
Mic bugs (missed letters, late letters) are hard to reproduce: by the time we notice, the
audio and recognizer events are gone. The Mic Console (`window.__micEvents`, `miclog`
CustomEvents from `index.html`) shows events live, but nothing is saved. We want a live
capture of **audio + mic events + context** so failures can be analyzed after the fact,
replayed through the server STT for comparison, and promoted into regression tests.

## Outcome
With capture armed, a real-mic spelling attempt leaves a folder on disk containing the
recorded audio, the full mic-event stream, and the context (target word, final tiles). A CLI
replays a capture through `/api/transcribe` + the letter parser and prints a comparison
(browser-heard vs server-STT vs target). Interesting failures become test cases.

## Scope
- **In:**
  1. **Browser capture** (`index.html` + `src/screens/spelling.jsx` area): when the Mic
     Console is armed (🐞 open) and the real mic starts in spelling mode, also record the
     mic audio with `MediaRecorder` (`getUserMedia({audio:true})`, webm/opus — runs fine
     alongside SpeechRecognition). When the mic stops (or `evaluate()` runs), POST the
     capture to `/api/capture`: audio blob + the `window.__micEvents` slice for this
     session + meta `{ word, tiles, startedAt, endedAt, userAgent }`. Capture is **OFF by
     default** — only when the Mic Console is open (privacy: a child's voice).
  2. **Server** (`server/index.js`): `POST /api/capture` (multipart or raw audio +
     `X-Capture-Meta` JSON header, or two-part JSON+base64 — implementer's choice, keep it
     simple) → writes `.captures/<ISO-timestamp>-<word>/{audio.webm,events.json,meta.json}`.
     `GET /api/captures` lists capture folders. `.captures/` is **gitignored**.
  3. **Replay CLI** (`scripts/replay-capture.mjs`): given a capture folder, send
     `audio.webm` to `/api/transcribe`, parse letters from the transcript with
     `window.PHON.parseLetters` (load `src/lib/phonetics.js` in Node with a
     `globalThis.window = {}` shim — it's plain JS), and print a table: target word ·
     letters the browser emitted (from events.json finals) · letters server STT heard ·
     match/mismatch. Non-zero exit on mismatch so it can gate automation.
  4. **Test promotion (docs)**: a short section in README describing the flow — copy the
     `final` transcripts from a capture's `events.json` into `test/phonetics.test.js` as
     transcript-level regression cases (no audio in the repo); keep audio-level replays
     local via the CLI.
- **Out:** reading-mode capture; uploading captures anywhere off-machine; automatic test
  generation; UI for browsing captures.

## Approach
Reuse the existing seams: `micLog`/`window.__micEvents` (index.html) for events,
`/api/transcribe` (server) for replay STT, the `window.*` attach pattern, and the
`scripts/*.mjs` style of `synthetic-speaker.mjs`. Keep the capture recorder inside
`startRealMic` (it already owns mic lifecycle) with a `capture: true` option or a global
armed flag set by the Mic Console toggle.

## Acceptance criteria (verifiable)
- [ ] `npm test` and `npm run build` pass; new unit tests cover the pure parts (e.g. a
      capture-meta builder / events slicing / replay comparison logic extracted as plain
      functions).
- [ ] `POST /api/capture` with a small fake payload writes the three files under
      `.captures/…` (verified by a test hitting the handler or by the replay CLI's own
      fixture); `.captures/` is gitignored.
- [ ] `node scripts/replay-capture.mjs <folder>` on a capture prints the comparison table
      and exits non-zero when browser-emitted letters ≠ target.
- [ ] Capture only happens when armed (Mic Console open); no recording otherwise.
- [ ] README documents capture → replay → promote-to-test, including the privacy note
      (child audio stays on this machine).

## Notes / open questions
- The API server runs as a Windows service — after this merges, `word-lab-api` needs a
  restart to serve `/api/capture` (operator does this; not the loop's job).
- MediaRecorder needs a secure context like the mic itself (localhost is fine).
