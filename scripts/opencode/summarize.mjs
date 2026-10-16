#!/usr/bin/env node
// Condense an `opencode run --format json` event log into a short report for
// the lead agent: tools used, blocked attempts, tokens, cost, final message.
//   node scripts/opencode/summarize.mjs <events.jsonl> [--json]
import { readFileSync } from 'node:fs';

export function summarize(text) {
  const tools = {}, blocked = [], errors = [];
  let cost = 0, final = '', events = 0;
  const tok = { in: 0, out: 0, reasoning: 0, cacheRead: 0 };
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    events++;
    const p = e.part || {};
    if (e.type === 'error') errors.push(String(e.error?.message ?? JSON.stringify(e.error)).slice(0, 200));
    if (p.type === 'tool') {
      const st = typeof p.state === 'object' && p.state ? p.state : {};
      tools[p.tool] = (tools[p.tool] || 0) + 1;
      const msg = String(st.error || '');
      if (st.status === 'error' && /denied|policy|blocked|not allowed|permission/i.test(msg)) {
        blocked.push(`${p.tool}: ${JSON.stringify(st.input ?? '').slice(0, 100)}`);
      }
    }
    if (p.type === 'step-finish') {
      cost += Number(p.cost || 0);
      const t = p.tokens || {};
      tok.in += t.input || 0; tok.out += t.output || 0; tok.reasoning += t.reasoning || 0; tok.cacheRead += t.cache?.read || 0;
    }
    if (p.type === 'text' && p.text) final = p.text;
  }
  return { events, tools, blocked, errors, cost, tokens: tok, final: final.trim() };
}

export function format(s) {
  const lines = [];
  lines.push('tools:   ' + (Object.entries(s.tools).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(', ') || 'none'));
  lines.push(`tokens:  in ${s.tokens.in}  out ${s.tokens.out}  reasoning ${s.tokens.reasoning}  cache-read ${s.tokens.cacheRead}`);
  lines.push(`cost:    $${s.cost.toFixed(4)}` + (s.cost > 0 ? '   ⚠ NON-ZERO — free-model rule broken, investigate' : ''));
  if (s.blocked.length) lines.push('blocked: ' + s.blocked.slice(0, 8).join('; '));
  if (s.errors.length) lines.push('errors:  ' + s.errors.slice(0, 3).join(' | '));
  if (!s.events) lines.push('events:  none (service stalled or model never answered)');
  lines.push('report:');
  for (const l of (s.final.slice(0, 2500) || '(no final message)').split('\n')) lines.push('  ' + l);
  return lines.join('\n');
}

if (process.argv[1]?.endsWith('summarize.mjs')) {
  const [file, flag] = process.argv.slice(2);
  const s = summarize(readFileSync(file, 'utf8'));
  console.log(flag === '--json' ? JSON.stringify(s) : format(s));
}
