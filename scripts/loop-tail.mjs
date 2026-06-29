// loop-tail.mjs — compact, human-readable view of a loop's stream-json log.
// Usage: node scripts/loop-tail.mjs .loops/build.stream.jsonl [lastN]
import fs from 'fs';
const file = process.argv[2] || '.loops/build.stream.jsonl';
const n = parseInt(process.argv[3] || '50', 10);
const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
const out = [];
for (const ln of lines) {
  if (ln.startsWith('[runner]')) { out.push('· ' + ln.replace('[runner] ', '')); continue; }
  let e; try { e = JSON.parse(ln); } catch { continue; }
  if (e.type === 'system' && e.subtype === 'init') out.push(`▶ session (model ${e.model}, ${e.permissionMode})`);
  else if (e.type === 'assistant' && e.message?.content) {
    for (const c of e.message.content) {
      if (c.type === 'text' && c.text.trim()) out.push('💬 ' + c.text.trim().replace(/\s+/g, ' ').slice(0, 220));
      else if (c.type === 'tool_use') {
        const i = c.input || {};
        const detail = i.file_path ? i.file_path.split(/[\\/]/).pop()
          : i.command ? ('$ ' + String(i.command).replace(/\s+/g, ' ').slice(0, 90))
          : i.pattern ? `/${i.pattern}/` : '';
        out.push(`🔧 ${c.name} ${detail}`);
      }
    }
  } else if (e.type === 'user' && Array.isArray(e.message?.content)) {
    for (const c of e.message.content) {
      if (c.type === 'tool_result' && c.is_error) out.push('   ⚠ tool error');
    }
  } else if (e.type === 'result') out.push(`🏁 ${e.subtype || 'done'} — ${e.is_error ? 'ERROR' : 'ok'} (${e.num_turns ?? '?'} turns, ${(e.duration_ms/1000|0)}s)`);
}
console.log(out.slice(-n).join('\n'));
console.log(`\n[${out.length} events; showing last ${Math.min(n, out.length)}]`);
