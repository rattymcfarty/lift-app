#!/usr/bin/env node
/**
 * Free-model pool state for scripts/delegate.sh.
 * A model that is throttled, overloaded or gone is put on a cooldown so the next
 * attempt (and the next job) skips it instead of failing again.
 *
 *   pool.mjs classify <events.jsonl> [exitcode]   -> "<kind> <cooldownSeconds>"
 *   pool.mjs mark <model> <seconds> <reason>       record a cooldown
 *   pool.mjs ok <model>                            clear a cooldown
 *   pool.mjs filter                                stdin models -> available ones (order kept)
 *   pool.mjs order <ranked...>                     ranked first, then the rest of pool_order, deduped
 *   pool.mjs status                                human-readable table
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(here, 'models.json'), 'utf8'));
const STATE = process.env.LIFT_POOL_STATE || join(process.env.LIFT_DELEGATIONS_DIR || join(homedir(), 'lift/delegations'), '.model-state.json');
const now = () => Math.floor(Date.now() / 1000);
const load = () => { try { return JSON.parse(readFileSync(STATE, 'utf8')); } catch { return {}; } };
const save = (s) => { mkdirSync(dirname(STATE), { recursive: true }); writeFileSync(STATE, JSON.stringify(s, null, 2) + '\n', { mode: 0o600 }); };
const live = (s, m) => !(s[m] && s[m].until > now());

const [cmd, ...a] = process.argv.slice(2);
if (cmd === 'classify') {
  let text = '';
  try { text = readFileSync(a[0], 'utf8'); } catch { /* no events file */ }
  const rc = Number(a[1] || 0);
  const errs = [];
  for (const line of text.split('\n')) { try { const e = JSON.parse(line); if (e.type === 'error') errs.push(JSON.stringify(e.error || e)); } catch { /* not json */ } }
  const blob = errs.join(' ');
  let kind = 'ok', secs = 0;
  if (/FreeUsageLimit|Rate limit|provider\.quota|"status":429/i.test(blob)) { kind = 'quota'; secs = 1800; }
  else if (/Model unavailable/i.test(blob)) { kind = 'gone'; secs = 86400; }
  else if (/overloaded|Upstream error|idle timeout|"status":50[234]|\[50[234]\]/i.test(blob)) { kind = 'transient'; secs = 600; }
  else if (rc === 124) { kind = 'stall'; secs = 900; }
  else if (rc !== 0) { kind = 'failed'; secs = 0; }
  console.log(`${kind} ${secs}`);
} else if (cmd === 'mark') {
  const s = load(); s[a[0]] = { until: now() + Number(a[1]), reason: a[2] || '', at: now() }; save(s);
} else if (cmd === 'ok') {
  const s = load(); delete s[a[0]]; save(s);
} else if (cmd === 'filter') {
  const s = load(); let input = ''; process.stdin.on('data', (d) => (input += d)).on('end', () => {
    for (const m of input.split('\n').filter(Boolean)) if (live(s, m)) console.log(m);
  });
} else if (cmd === 'order') {
  const seen = new Set(); const out = [];
  for (const m of [...a, ...(cfg.pool_order || cfg.allowed)]) if (cfg.allowed.includes(m) && !seen.has(m)) { seen.add(m); out.push(m); }
  console.log(out.join('\n'));
} else if (cmd === 'status') {
  const s = load();
  for (const m of cfg.pool_order || cfg.allowed) {
    const e = s[m];
    console.log(`${live(s, m) ? 'available ' : 'cooldown  '} ${m}${e && !live(s, m) ? `  until +${Math.round((e.until - now()) / 60)} min (${e.reason})` : ''}`);
  }
} else { console.error('usage: pool.mjs classify|mark|ok|filter|order|status'); process.exit(2); }
