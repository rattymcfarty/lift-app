#!/usr/bin/env node
// Guard for the cross-agent foundation (npm run test:agents, part of verify).
// Checks that any harness can still find its way: AGENTS.md is canonical, the
// pointer files point at it, every skill is well-formed, every repo path cited
// in AGENTS.md / skills exists, and the delegation tooling is consistent.
import { existsSync, readFileSync, readdirSync, lstatSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log(`  ✗ ${msg}`); } };
const read = (p) => readFileSync(p, 'utf8');

// 1. canonical guide + pointers
ok(existsSync('AGENTS.md'), 'AGENTS.md exists');
const agents = read('AGENTS.md');
for (const h of ['Resume in five minutes', 'non-negotiables', 'Definition of done', 'Skills']) ok(agents.includes(h), `AGENTS.md has section "${h}"`);
ok(/^@AGENTS\.md$/m.test(read('CLAUDE.md')), 'CLAUDE.md imports @AGENTS.md');
ok(/^@AGENTS\.md$/m.test(read('GEMINI.md')), 'GEMINI.md imports @AGENTS.md');
for (const f of ['.github/copilot-instructions.md', '.cursor/rules/lift.mdc']) ok(existsSync(f) && read(f).includes('AGENTS.md'), `${f} points to AGENTS.md`);
for (const f of ['docs/ops/HANDOFF.md', 'docs/ops/AGENT_COLLABORATION.md', 'docs/ops/DELEGATION.md', 'docs/ops/RESUME_PROMPT.md']) ok(existsSync(f), `${f} exists`);

// 2. skills: .agents/skills/<name>/SKILL.md with matching frontmatter; .claude/skills links there
const SK = '.agents/skills';
const skills = existsSync(SK) ? readdirSync(SK).filter((d) => existsSync(join(SK, d, 'SKILL.md'))) : [];
ok(skills.length >= 5, `at least 5 skills (found ${skills.length})`);
for (const s of skills) {
  const md = read(join(SK, s, 'SKILL.md'));
  const fm = md.match(/^---\n([\s\S]*?)\n---\n/);
  ok(fm, `${s}: has frontmatter`);
  if (!fm) continue;
  const name = fm[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const desc = fm[1].match(/^description:\s*(.+)$/m)?.[1]?.trim() || '';
  ok(name === s, `${s}: frontmatter name matches directory (got "${name}")`);
  ok(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length <= 64, `${s}: name is lowercase-dashes ≤64`);
  ok(desc.length >= 20 && desc.length <= 1024, `${s}: description 20–1024 chars`);
  ok(agents.includes('`' + s + '`'), `${s}: listed in AGENTS.md skills table`);
}
for (const m of agents.matchAll(/^\| `(lift-[a-z0-9-]+)` \|/gm)) if (!['lift-app', 'lift-kb'].includes(m[1])) ok(skills.includes(m[1]), `AGENTS.md lists skill ${m[1]} which exists`);
const link = '.claude/skills';
ok(existsSync(link) && lstatSync(link).isSymbolicLink() && readlinkSync(link) === '../.agents/skills', '.claude/skills → ../.agents/skills symlink');

// 3. every backticked repo path in AGENTS.md and skills exists
const docs = [['AGENTS.md', agents], ...skills.map((s) => [join(SK, s, 'SKILL.md'), read(join(SK, s, 'SKILL.md'))])];
const ROOTS = /^(app|src|scripts|docs|plugins|assets|\.maestro|\.agents)\//;
for (const [file, text] of docs) {
  for (const m of text.matchAll(/`([^`\s]+)`/g)) {
    const p = m[1].replace(/[),.:;]+$/, '');
    if (!ROOTS.test(p) || /[<>*{}]|\.\.\./.test(p)) continue;
    ok(existsSync(p), `${file}: cited path exists: ${p}`);
  }
}

// 3b. portable agent kit: memories and generic skill are well-formed
const KM = 'docs/ops/agent-kit/memory';
const kitMem = existsSync(KM) ? readdirSync(KM).filter((f) => f.endsWith('.md')) : [];
ok(kitMem.length >= 3, `agent kit has memories (found ${kitMem.length})`);
for (const f of kitMem) {
  const fm = read(join(KM, f)).match(/^---\n([\s\S]*?)\n---\n/)?.[1] || '';
  ok(fm.match(/^name:\s*(.+)$/m)?.[1]?.trim() === f.replace(/\.md$/, ''), `kit memory ${f}: name matches file`);
  ok(/^description:\s*\S/m.test(fm) && /^\s+type:\s*(user|feedback|project|reference)\s*$/m.test(fm), `kit memory ${f}: description + type`);
  ok(!/@gmail\.com|oc_sk_[A-Za-z0-9]{6,}|\b100\.\d+\.\d+\.\d+\b/.test(read(join(KM, f))), `kit memory ${f}: no personal email, key or IP`);
}
ok(existsSync('docs/ops/agent-kit/skills/agent-delegation/SKILL.md'), 'agent kit has the generic agent-delegation skill');
ok(existsSync('scripts/setup-agent-kit.sh'), 'setup-agent-kit.sh exists');

// 4. delegation tooling consistent
const reg = JSON.parse(read('scripts/opencode/models.json'));
ok(Array.isArray(reg.allowed) && reg.allowed.length > 0, 'models.json has an allowlist');
ok(reg.allowed.every((m) => m.startsWith('opencode/') && (m.endsWith('-free') || m === 'opencode/big-pickle')), 'allowlist contains only free Console models');
for (const [cat, c] of Object.entries(reg.categories)) ok(c.rank.every((m) => reg.allowed.includes(m)), `category ${cat}: ranked models are all allowed`);
ok(reg.allowed.includes(reg.maintenance_model), 'maintenance (title) model is allowed');
const cfgText = read('scripts/opencode/delegate.opencode.jsonc');
ok(!/"effect":\s*"ask"/.test(cfgText), 'delegation config has no "ask" rules (they hang non-interactive runs)');
ok(/"provider\.use", "resource": "\*", "effect": "deny"/.test(cfgText), 'delegation config denies all providers by default');
ok(!/oc_sk_[A-Za-z0-9_]{6,}/.test(cfgText + read('scripts/opencode/mcp-server.mjs')), 'no service-account key in tooling');
const mcp = JSON.parse(read('.mcp.json'));
ok(mcp.mcpServers?.['opencode-helper']?.args?.includes('scripts/opencode/mcp-server.mjs'), '.mcp.json registers opencode-helper');

console.log(fails ? `agents: ${fails} FAILED, ${passes} passed` : `agents: ${passes} checks passed`);
process.exit(fails ? 1 : 0);
