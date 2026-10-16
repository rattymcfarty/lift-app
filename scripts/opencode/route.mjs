#!/usr/bin/env node
// Pick the free model for a delegated task.
//
//   node scripts/opencode/route.mjs "<task>"          → prints JSON {category, source, models, ...}
//   node scripts/opencode/route.mjs --category "<task>"   → prints only the category
//
// 1. Ask Jev (a structured-decision model on the OpenCode Console) to classify
//    the task into one of the categories in models.json. It needs the service-
//    account key in ~/lift/secrets/opencode-sa.key and an 8-second answer.
// 2. If Jev is unavailable, refuses, or is unsure (p < 0.5), use keyword rules.
// The category's `rank` list (measured, see DELEGATION.md §6) gives the models.
// No task text is sent anywhere except Jev; the key is never printed.
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(readFileSync(join(here, 'models.json'), 'utf8'));
const KEY_FILE = process.env.LIFT_OC_KEY_FILE || join(homedir(), 'lift/secrets/opencode-sa.key');

const RULES = [
  ['vision', /\b(screenshot|image|png|jpe?g|photo|picture|visual diff)\b/i],
  ['content', /\b(exercise (instructions?|cues?|prose|content)|kb content|knowledge.?base|lift-kb|safety notes?|coaching cues?)\b/i],
  ['docs', /\b(changelog|readme|docs?|documentation|handoff|release notes?|write.?up|comment(s|ary)?|typos?)\b/i],
  ['analysis', /\b(regex|parse|log(s)?\b|find|search|where is|explain|summari[sz]e|list all|grep|count|which files?)\b/i],
  ['code', /\b(tests?|implement|refactor|fix|bug|function|component|typescript|tsx?|lint|type errors?)\b/i],
];

function byRules(task) {
  for (const [cat, re] of RULES) if (re.test(task)) return cat;
  return 'code';
}

async function byJev(task) {
  if (!existsSync(KEY_FILE)) return null;
  const key = readFileSync(KEY_FILE, 'utf8').trim();
  if (!key) return null;
  const criteria = Object.fromEntries(Object.entries(registry.categories).map(([k, v]) => [k, v.criteria]));
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(registry.jev.endpoint, {
      method: 'POST',
      signal: ctl.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: registry.jev.model,
        state: `A software task to hand to a helper coding agent: ${task.slice(0, 2000)}`,
        questions: { category: { type: 'choice', instructions: 'Which kind of work is this task?', criteria } },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body?.error?.message || `HTTP ${res.status}` };
    // Accept the common response shapes: {answers:{category:{value,probability}}} or {category:{...}}.
    const a = body?.answers?.category ?? body?.category ?? body?.results?.category;
    const value = a?.value ?? a?.answer ?? a?.choice;
    const p = Number(a?.probability ?? a?.confidence ?? 1);
    if (typeof value === 'string' && registry.categories[value]) return { category: value, p };
    return { error: 'unrecognised Jev response' };
  } catch (e) {
    return { error: e?.name === 'AbortError' ? 'timeout' : String(e?.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

export async function route(task) {
  const jev = await byJev(task);
  let category, source, note;
  if (jev?.category && jev.p >= 0.5) {
    category = jev.category; source = 'jev'; note = `p=${jev.p.toFixed(2)}`;
  } else {
    category = byRules(task); source = 'rules';
    note = jev?.error ? `jev: ${jev.error}` : jev?.category ? `jev unsure (p=${jev.p})` : 'jev: no key';
  }
  const models = registry.categories[category].rank.filter((m) => registry.allowed.includes(m));
  return { category, source, note, models };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const onlyCat = args[0] === '--category';
  const task = (onlyCat ? args.slice(1) : args).join(' ').trim();
  if (!task) { console.error('usage: route.mjs [--category] "<task>"'); process.exit(2); }
  const r = await route(task);
  console.log(onlyCat ? r.category : JSON.stringify(r));
}
