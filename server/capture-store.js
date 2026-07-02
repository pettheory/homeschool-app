/* capture-store.js — filesystem side of session capture.
 *
 * Where the browser's POST /api/capture payload lands on disk: one folder per
 * session under `.captures/` (gitignored — a child's voice never leaves this
 * machine). Kept out of the route handler so the naming + writing is unit-
 * testable against a temp dir with no HTTP. See
 * docs/specs/session-capture-replay.md.
 */
import fs from 'node:fs';
import path from 'node:path';

// Folder name for a capture: `<sanitised-ISO-timestamp>-<word>`. ISO strings
// contain ':' and '.', which are illegal in Windows paths, so we swap them for
// '-'; the word is reduced to lowercase alphanumerics. Both fall back to a
// stable default so a capture always gets a folder.
export function captureFolderName(meta, fallbackNow) {
  const m = meta || {};
  const ms = m.startedAt != null ? m.startedAt : (fallbackNow != null ? fallbackNow : 0);
  const stamp = new Date(ms).toISOString().replace(/[:.]/g, '-');
  const word = String(m.word || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'session';
  return `${stamp}-${word}`;
}

// Write a capture to `<baseDir>/<folder>/{audio.webm,events.json,meta.json}`.
// `audio` is base64 (from the browser's FileReader) or omitted. Returns the
// folder name that was written.
export function writeCapture(baseDir, payload, fallbackNow) {
  const p = payload || {};
  const meta = p.meta || {};
  const events = p.events || [];
  const folderName = captureFolderName(meta, fallbackNow);
  const dir = path.join(baseDir, folderName);
  fs.mkdirSync(dir, { recursive: true });
  if (p.audio) {
    fs.writeFileSync(path.join(dir, 'audio.webm'), Buffer.from(p.audio, 'base64'));
  }
  fs.writeFileSync(path.join(dir, 'events.json'), JSON.stringify(events, null, 2));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  return folderName;
}

// List capture folders (newest first — folder names sort chronologically since
// they start with an ISO timestamp). Missing dir → empty list, never an error.
export function listCaptures(baseDir) {
  if (!fs.existsSync(baseDir)) return [];
  return fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();
}
