/* synthetic-speaker.mjs — automated end-to-end test of the READING pipeline using
 * GENERATED speech instead of a human at the mic:
 *
 *     ElevenLabs TTS (the "child" speaks)  →  OpenAI STT (the mic "hears")  →  LLM judge
 *
 * For each case we synthesize the child's utterance, transcribe it back to text,
 * judge it, and assert the verdict — so the reading flow is tested with realistic,
 * non-deterministic speech and no human involvement.
 *
 * Requires the dev server running (npm run dev). Run:  node scripts/synthetic-speaker.mjs
 * Exit code 0 = all passed, 1 = a failure (CI-friendly).
 *
 * NOTE: the live game hears the child via the browser Web Speech API; this harness
 * uses a server STT (/api/transcribe) so it can run headless. It validates the
 * judge + the realism of generated speech, not the browser recognizer itself.
 */
const BASE = process.env.LAB_BASE || 'http://localhost:3001';

// Mirrors the judge contract the app sends (src/lib/judge.js buildMessages).
function judgeMessages(target, transcript) {
  const system = [
    'You are a gentle reading tutor for a child aged 9-10.',
    'Decide whether the child correctly READ ALOUD the TARGET word, given a',
    'speech-to-text TRANSCRIPT that may contain microphone errors.',
    'Principle: forgive the mic, never the child. Accept homophones, accents,',
    'and minor speech-to-text noise.',
    'Reply with STRICT JSON only:',
    '{"verdict": "correct" | "close" | "unclear" | "incorrect", "reason": "<=8 words"}.',
    'correct = clearly read the target word.',
    'close = essentially right, a tiny slip.',
    'unclear = transcript empty/garbled/too short to tell; let them retry, never penalize.',
    'incorrect = clearly a different word.',
    'When unsure between incorrect and unclear, choose unclear.',
  ].join(' ');
  return [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify({ target, transcript }) }];
}

// "spoken" is what the synthetic child says aloud; "accept" is the verdict set we allow.
const CASES = [
  { target: 'butterfly', spoken: 'butterfly', accept: ['correct', 'close'] },
  { target: 'friend',    spoken: 'friend',    accept: ['correct', 'close'] },
  { target: 'because',   spoken: 'because',   accept: ['correct', 'close'] },
  { target: 'enough',    spoken: 'enough',    accept: ['correct', 'close'] },
  { target: 'friend',    spoken: 'frog',      accept: ['incorrect', 'unclear'] },
  { target: 'because',   spoken: 'banana',    accept: ['incorrect', 'unclear'] },
];

async function ttsBytes(text) {
  const r = await fetch(`${BASE}/api/tts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  if (!r.ok) throw new Error('tts ' + r.status + ' ' + (await r.text()).slice(0, 140));
  return Buffer.from(await r.arrayBuffer());
}
async function transcribe(buf) {
  const r = await fetch(`${BASE}/api/transcribe`, { method: 'POST', headers: { 'Content-Type': 'audio/mpeg' }, body: buf });
  if (!r.ok) throw new Error('transcribe ' + r.status + ' ' + (await r.text()).slice(0, 140));
  return ((await r.json()).text || '').trim();
}
async function judge(target, transcript) {
  const r = await fetch(`${BASE}/api/judge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: judgeMessages(target, transcript) }) });
  if (!r.ok) throw new Error('judge ' + r.status + ' ' + (await r.text()).slice(0, 140));
  const content = (await r.json()).choices?.[0]?.message?.content || '{}';
  return JSON.parse(content);
}

const pad = (s, n) => String(s).padEnd(n);
let passed = 0;
console.log(`\nSynthetic-speaker harness → ${BASE}\n` + '─'.repeat(82));
console.log(pad('TARGET', 12) + pad('SPOKEN', 12) + pad('HEARD (STT)', 22) + pad('VERDICT', 11) + 'RESULT');
console.log('─'.repeat(82));
for (const c of CASES) {
  try {
    const audio = await ttsBytes(c.spoken);
    const heard = await transcribe(audio);
    const v = await judge(c.target, heard);
    const ok = c.accept.includes(v.verdict);
    if (ok) passed++;
    console.log(pad(c.target, 12) + pad(c.spoken, 12) + pad('"' + heard + '"', 22) + pad(v.verdict, 11) + (ok ? 'PASS' : `FAIL (want ${c.accept.join('/')})`));
  } catch (e) {
    console.log(pad(c.target, 12) + pad(c.spoken, 12) + pad('—', 22) + pad('ERROR', 11) + e.message);
  }
}
console.log('─'.repeat(82));
console.log(`${passed}/${CASES.length} passed\n`);
process.exit(passed === CASES.length ? 0 : 1);
