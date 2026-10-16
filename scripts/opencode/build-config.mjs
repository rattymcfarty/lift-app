#!/usr/bin/env node
// Write the locked OpenCode config for one delegated run.
//
//   node scripts/opencode/build-config.mjs <out.jsonc> [--readonly]
//
// Base = delegate.opencode.jsonc. Adds:
//   - providers.opencode.models: { <id>: {disabled:true} } for EVERY Console model
//     that is not in models.json "allowed" (read live from `opencode models`);
//   - hidden title/summary/compaction agents pinned to the free maintenance model
//     (OpenCode otherwise uses cheap PAID models to write session titles);
//   - --readonly: no edits and no shell at all (for "ask" tasks).
// Fails closed: if the live model list can't be read, no config is written.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OC = process.env.LIFT_OPENCODE_BIN || join(homedir(), '.local/node/bin/opencode');
const [out, flag] = process.argv.slice(2);
if (!out) { console.error('usage: build-config.mjs <out.jsonc> [--readonly]'); process.exit(2); }

// Only whole-line // comments are used in the template (URLs contain "//").
const base = JSON.parse(readFileSync(join(here, 'delegate.opencode.jsonc'), 'utf8')
  .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n'));
const registry = JSON.parse(readFileSync(join(here, 'models.json'), 'utf8'));

let live;
try {
  live = execFileSync(OC, ['models'], { encoding: 'utf8', timeout: 60000 })
    .split(/\s+/).filter((m) => m.startsWith('opencode/'));
} catch (e) {
  console.error(`build-config: cannot list models (${e.message}); refusing to write a config`);
  process.exit(1);
}
if (live.length < registry.allowed.length) {
  console.error(`build-config: only ${live.length} Console models listed; refusing (is the Console signed in?)`);
  process.exit(1);
}
const allowed = new Set(registry.allowed);
const disabled = Object.fromEntries(live.filter((m) => !allowed.has(m)).map((m) => [m.slice('opencode/'.length), { disabled: true }]));

const cfg = { ...base };
cfg.providers = { opencode: { models: disabled } };
cfg.agents = Object.fromEntries(['title', 'summary', 'compaction'].map((a) => [a, { model: registry.maintenance_model }]));
if (flag === '--readonly') {
  cfg.permissions = [
    ...base.permissions,
    { action: 'edit', resource: '*', effect: 'deny' },
    { action: 'shell', resource: '*', effect: 'deny' },
    { action: 'subagent', resource: '*', effect: 'deny' },
  ];
}
writeFileSync(out, JSON.stringify(cfg, null, 1) + '\n');
console.error(`build-config: ${live.length} Console models, ${Object.keys(disabled).length} disabled, ${live.length - Object.keys(disabled).length} free allowed`);
