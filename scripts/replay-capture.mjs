/* replay-capture.mjs — replay a recorded mic session through the server STT and
 * compare what three "ears" heard, so a mic bug that's gone by the time you
 * notice can be reproduced from disk.
 *
 *     .captures/<folder>/audio.webm  →  /api/transcribe (server STT)  →  letters
 *
 * Prints a table:  target word · letters the BROWSER emitted live (events.json)
 * · letters server STT heard on replay · match. Exits non-zero when the browser-
 * emitted letters ≠ the target — that's the regression signal (a real mic bug
 * dropped or added a letter), so this can gate automation. The STT column is
 * additive colour; pass --no-stt (or run with no server) to skip it and still
 * get the browser-vs-target verdict offline.
 *
 *   node scripts/replay-capture.mjs .captures/2026-07-02T14-30-00-000Z-because
 *   node scripts/replay-capture.mjs <folder> --base http://localhost:3001 --no-stt
 *
 * The pure comparison + letter-extraction logic lives in src/lib/capture.js and
 * src/lib/phonetics.js, loaded here in Node behind a `globalThis.window = {}`
 * shim (they're plain window.* modules), so the CLI is a thin I/O wrapper.
 */
import fs from 'node:fs';
import path from 'node:path';

// ── Load the window.* logic modules in Node (shim window, then dynamic import so
// the shim is in place before the IIFEs run — static imports would hoist first).
globalThis.window = globalThis.window || {};
await import(new URL('../src/lib/phonetics.js', import.meta.url));
await import(new URL('../src/lib/capture.js', import.meta.url));
const { PHON, Capture } = globalThis.window;

// ── Args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
let folderArg = null, base = process.env.LAB_BASE || 'http://localhost:3001', noStt = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--no-stt') noStt = true;
  else if (a === '--base') base = argv[++i];
  else if (!folderArg) folderArg = a;
}
if (!folderArg) {
  console.error('usage: node scripts/replay-capture.mjs <capture-folder> [--base <url>] [--no-stt]');
  process.exit(2);
}

const folder = path.resolve(folderArg);
function readJson(name, fallback) {
  const p = path.join(folder, name);
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const meta = readJson('meta.json', null);
if (!meta) { console.error(`No meta.json in ${folder} — is that a capture folder?`); process.exit(2); }
const events = readJson('events.json', []);
const audioPath = path.join(folder, 'audio.webm');

// Letters the browser emitted live; fall back to the final tiles for older
// captures with no 'emit' events.
let emitted = Capture.emittedLetters(events);
if (!emitted.length) emitted = Capture.toLetters(meta.tiles);

// ── Replay the audio through server STT (optional / best-effort) ───────────────
let sttLetters = [];
let sttNote = '';
if (noStt) {
  sttNote = 'skipped (--no-stt)';
} else if (!fs.existsSync(audioPath)) {
  sttNote = 'no audio.webm in capture';
} else {
  try {
    const buf = fs.readFileSync(audioPath);
    const r = await fetch(`${base}/api/transcribe`, {
      method: 'POST', headers: { 'Content-Type': 'audio/webm' }, body: buf,
    });
    if (!r.ok) { sttNote = `transcribe ${r.status}: ${(await r.text()).slice(0, 80)}`; }
    else {
      const transcript = ((await r.json()).text || '').trim();
      sttLetters = PHON.parseLetters(transcript);
      sttNote = transcript ? `"${transcript}"` : '(empty transcript)';
    }
  } catch (e) {
    sttNote = `server unreachable at ${base} (${(e && e.message) || e})`;
  }
}

// ── Compare + print ────────────────────────────────────────────────────────────
const cmp = Capture.compareReplay({ target: meta.word, emitted, sttLetters });
const mark = (ok) => (ok ? 'MATCH' : 'MISMATCH');
const show = (arr) => (arr.length ? arr.join(' ') : '—');

console.log(`\nReplay capture → ${path.basename(folder)}`);
console.log('─'.repeat(74));
console.log(`  target word     : ${meta.word}  [${show(cmp.target)}]`);
console.log(`  browser emitted : ${show(cmp.emitted)}   ${mark(cmp.browserMatch)} vs target`);
console.log(`  server STT      : ${show(cmp.stt)}   ${noStt || !sttLetters.length ? '(no STT comparison)' : mark(cmp.sttMatch) + ' vs target'}`);
console.log(`  STT transcript  : ${sttNote}`);
console.log('─'.repeat(74));
if (cmp.browserMatch) {
  console.log('✓ Browser heard the word correctly — nothing to promote to a test.\n');
} else {
  console.log('✗ Browser-emitted letters ≠ target — a reproducible mic slip.');
  console.log("  Promote it: copy this capture's `final` transcripts from events.json into");
  console.log('  test/phonetics.test.js as a transcript-level regression case (no audio in repo).\n');
}
// Non-zero exit gates automation: the browser mis-heard the target.
process.exit(cmp.browserMatch ? 0 : 1);
