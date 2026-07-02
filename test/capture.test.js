import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// vitest runs with cwd = project root; resolve repo files from there (import.meta.url
// isn't a plain file: URL under vitest's transform).
const repo = (rel) => join(process.cwd(), rel);

// capture.js is an IIFE that attaches window.Capture (no exports) — import for side-effects.
import '../src/lib/capture.js';
import { captureFolderName, writeCapture, listCaptures } from '../server/capture-store.js';

const Capture = window.Capture;

// ── Pure helpers (window.Capture) — the extracted, testable core ────────────────
describe('capture — buildCaptureMeta', () => {
  it('normalises tiles to uppercase letters and records the session window', () => {
    const meta = Capture.buildCaptureMeta({
      word: 'because', tiles: ['b', 'e', 'c', '', 'a', 'u', 's', 'e'],
      startedAt: 1000, endedAt: 2000, userAgent: 'Chrome',
    });
    expect(meta.word).toBe('because');
    expect(meta.tiles).toEqual(['B', 'E', 'C', 'A', 'U', 'S', 'E']);
    expect(meta.startedAt).toBe(1000);
    expect(meta.endedAt).toBe(2000);
    expect(meta.userAgent).toBe('Chrome');
  });
  it('fills sane defaults for a missing/empty payload', () => {
    const meta = Capture.buildCaptureMeta();
    expect(meta).toEqual({ word: '', tiles: [], startedAt: null, endedAt: null, userAgent: '' });
  });
});

describe('capture — sliceMicEvents', () => {
  const ev = (t, kind, detail) => ({ t, kind, detail });
  const stream = [ev(50, 'stop', 'old'), ev(100, 'emit', 'B'), ev(150, 'emit', 'U'), ev(300, 'emit', 'X')];
  it('keeps only events inside the (inclusive) session window', () => {
    expect(Capture.sliceMicEvents(stream, 100, 200)).toEqual([ev(100, 'emit', 'B'), ev(150, 'emit', 'U')]);
  });
  it('treats a null end bound as still-open', () => {
    expect(Capture.sliceMicEvents(stream, 100, null).map((e) => e.detail)).toEqual(['B', 'U', 'X']);
  });
  it('ignores malformed events with no numeric timestamp', () => {
    expect(Capture.sliceMicEvents([{ kind: 'emit' }, ev(120, 'emit', 'B')], 100, 200)).toEqual([ev(120, 'emit', 'B')]);
  });
});

describe('capture — emittedLetters', () => {
  it('extracts the ordered single-letter emit stream, ignoring other kinds', () => {
    const events = [
      { kind: 'interim', detail: 'bee you tee' },
      { kind: 'final', detail: '"bee you tee" → letters [B U T]' },
      { kind: 'emit', detail: 'B' }, { kind: 'emit', detail: 'U' }, { kind: 'emit', detail: 'T' },
      { kind: 'restart', detail: 'session ended' },
    ];
    expect(Capture.emittedLetters(events)).toEqual(['B', 'U', 'T']);
  });
  it('is empty when there are no emit events', () => {
    expect(Capture.emittedLetters([{ kind: 'final', detail: 'x' }])).toEqual([]);
  });
});

describe('capture — compareReplay', () => {
  it('flags a browser match when emitted letters spell the target', () => {
    const c = Capture.compareReplay({ target: 'but', emitted: ['B', 'U', 'T'], sttLetters: ['B', 'U', 'T'] });
    expect(c.browserMatch).toBe(true);
    expect(c.sttMatch).toBe(true);
    expect(c.browserVsStt).toBe(true);
  });
  it('flags a mismatch when the browser dropped a letter (a real mic bug)', () => {
    const c = Capture.compareReplay({ target: 'because', emitted: ['B', 'E', 'C', 'A', 'S', 'E'], sttLetters: [] });
    expect(c.browserMatch).toBe(false);
    expect(c.target).toEqual(['B', 'E', 'C', 'A', 'U', 'S', 'E']);
  });
  it('separates browser-vs-target from server-vs-target', () => {
    // browser heard it right; server STT mangled it → browserMatch true, sttMatch false
    const c = Capture.compareReplay({ target: 'cat', emitted: ['C', 'A', 'T'], sttLetters: ['C', 'A', 'D'] });
    expect(c.browserMatch).toBe(true);
    expect(c.sttMatch).toBe(false);
    expect(c.browserVsStt).toBe(false);
  });
});

// ── Server store (server/capture-store.js) — the /api/capture handler's core ────
describe('capture-store — folder naming', () => {
  it('sanitises the ISO timestamp (no colons/dots — Windows-safe) and the word', () => {
    const name = captureFolderName({ startedAt: Date.parse('2026-07-02T14:30:00.000Z'), word: 'Because!' });
    expect(name).toBe('2026-07-02T14-30-00-000Z-because');
    expect(name).not.toMatch(/[:.]/);
  });
  it('falls back to a stable default when word/startedAt are missing', () => {
    const name = captureFolderName({}, 0);
    expect(name).toBe('1970-01-01T00-00-00-000Z-session');
  });
});

describe('capture-store — writeCapture / listCaptures', () => {
  let base;
  beforeAll(() => { base = mkdtempSync(join(tmpdir(), 'wl-capture-')); });

  it('writes the three files (audio/events/meta) under .captures/<folder>', () => {
    const audio = Buffer.from('fake-webm-bytes').toString('base64');
    const payload = {
      meta: { word: 'because', tiles: ['B'], startedAt: Date.parse('2026-07-02T14:30:00.000Z') },
      events: [{ t: 1, kind: 'emit', detail: 'B' }],
      audio,
    };
    const folder = writeCapture(base, payload, 0);
    const dir = join(base, folder);
    expect(existsSync(join(dir, 'audio.webm'))).toBe(true);
    expect(existsSync(join(dir, 'events.json'))).toBe(true);
    expect(existsSync(join(dir, 'meta.json'))).toBe(true);
    expect(readFileSync(join(dir, 'audio.webm'), 'utf8')).toBe('fake-webm-bytes');
    expect(JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')).word).toBe('because');
    expect(JSON.parse(readFileSync(join(dir, 'events.json'), 'utf8'))).toHaveLength(1);
  });

  it('writes events/meta even with no audio, and lists folders newest-first', () => {
    writeCapture(base, { meta: { word: 'apple', startedAt: Date.parse('2026-07-03T09:00:00.000Z') }, events: [] }, 0);
    const list = listCaptures(base);
    expect(list.length).toBe(2);
    expect(list[0]).toMatch(/apple$/);   // 2026-07-03 sorts after 2026-07-02 → newest first
    expect(list[1]).toMatch(/because$/);
  });

  it('lists nothing for a missing captures dir', () => {
    expect(listCaptures(join(base, 'does-not-exist'))).toEqual([]);
  });
});

// ── Replay CLI (scripts/replay-capture.mjs) — end-to-end via a fixture folder ────
describe('replay CLI — exit codes on a fixture capture (offline, --no-stt)', () => {
  const cli = repo('scripts/replay-capture.mjs');
  let root;
  beforeAll(() => { root = mkdtempSync(join(tmpdir(), 'wl-replay-')); });

  function fixture(name, word, emittedLetters) {
    const dir = join(root, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'meta.json'), JSON.stringify({ word, tiles: emittedLetters }));
    writeFileSync(join(dir, 'events.json'), JSON.stringify(emittedLetters.map((L, i) => ({ t: i, kind: 'emit', detail: L }))));
    return dir;
  }
  const run = (dir) => {
    try {
      const stdout = execFileSync('node', [cli, dir, '--no-stt'], { encoding: 'utf8' });
      return { code: 0, stdout };
    } catch (e) {
      return { code: e.status, stdout: (e.stdout || '').toString() };
    }
  };

  it('exits 0 and prints the table when browser letters match the target', () => {
    const { code, stdout } = run(fixture('good-but', 'but', ['B', 'U', 'T']));
    expect(code).toBe(0);
    expect(stdout).toContain('browser emitted');
    expect(stdout).toContain('MATCH');
  });

  it('exits non-zero when browser-emitted letters ≠ target (a promotable slip)', () => {
    const { code, stdout } = run(fixture('bad-because', 'because', ['B', 'E', 'C', 'A', 'S', 'E'])); // dropped U
    expect(code).toBe(1);
    expect(stdout).toContain('MISMATCH');
  });
});

// ── Guardrails: capture is privacy-gated + gitignored ───────────────────────────
describe('capture — privacy & gitignore guardrails', () => {
  const read = (rel) => readFileSync(repo(rel), 'utf8');

  it('.captures is gitignored (child audio never committed)', () => {
    expect(read('.gitignore')).toMatch(/^\.captures\s*$/m);
  });
  it('the browser only records when the Mic Console is armed', () => {
    const html = read('index.html');
    // capturing is gated on `capture.armed` — no armed flag, no MediaRecorder.
    expect(html).toMatch(/capture\.armed/);
    expect(html).toMatch(/new window\.MediaRecorder/);
    const spelling = read('src/screens/spelling.jsx');
    expect(spelling).toMatch(/armed:\s*micDebug/); // armed flag comes from the 🐞 toggle
  });
});
