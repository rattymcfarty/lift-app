#!/usr/bin/env node
// MCP server (stdio) that exposes the OpenCode helper as tools for any
// MCP-capable harness: Claude Code, Cursor, Codex, Hermes, Gemini CLI, …
// Registered in the repo's .mcp.json as "opencode-helper". No dependencies.
//
// Tools
//   delegate_to_opencode_free  hand a task to OpenCode on a free model.
//        mode "ask"  → read-only answer (regex, log parsing, code search, explanations)
//        mode "code" → edits on its own branch delegate/<slug>; returns the report + diffstat
//   opencode_route             which category/models the router (Jev → rules) would pick
//   opencode_delegations       list | diff | clean open delegation branches
//
// Every call shells out to scripts/delegate.sh, so the same sandbox, lock,
// free-model allowlist and fallback apply whichever harness calls it.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const DELEGATE = join(here, '..', 'delegate.sh');
const registry = JSON.parse(readFileSync(join(here, 'models.json'), 'utf8'));

const TOOLS = [
  {
    name: 'delegate_to_opencode_free',
    description:
      'Delegate a self-contained sub-task to the OpenCode helper agent running FREE models (cost $0, ' +
      'does not use your context). Use for boilerplate, unit tests for pure functions, doc/changelog drafts, ' +
      'content passes, mechanical refactors, log parsing, regex, code search. Do NOT use for migrations, ' +
      'backup format, privacy/security code, architecture, or final review. mode "ask" = read-only answer; ' +
      'mode "code" = edits on branch delegate/<slug> which YOU must review (opencode_delegations diff) and ' +
      'merge only after `npm run verify`. Never trust the output blindly.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Self-contained instructions: goal, exact files, acceptance check (a command that must pass), what not to touch.' },
        mode: { type: 'string', enum: ['ask', 'code'], default: 'ask' },
        slug: { type: 'string', description: 'code mode: short branch name, lowercase-dashes (e.g. "tests-copyweek").' },
        model: { type: 'string', enum: registry.allowed, description: 'Optional. Omit to let the router (Jev, else rules) pick from measured rankings.' },
        timeout_minutes: { type: 'integer', minimum: 1, maximum: 60, default: 15 },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'opencode_route',
    description: 'Show which task category and free models the router would choose for a task (asks Jev, falls back to rules). No work is done.',
    inputSchema: { type: 'object', properties: { task: { type: 'string' } }, required: ['task'] },
  },
  {
    name: 'opencode_delegations',
    description: 'Manage helper branches: "list" open delegations, "diff" one (full diff vs its base), "clean" one (delete worktree + branch after merging or rejecting).',
    inputSchema: {
      type: 'object',
      properties: { action: { type: 'string', enum: ['list', 'diff', 'clean'] }, slug: { type: 'string' } },
      required: ['action'],
    },
  },
];

function runDelegate(args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn('bash', [DELEGATE, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const t = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.on('close', (code) => { clearTimeout(t); resolve({ code, out: out.slice(-20000) }); });
  });
}

async function callTool(name, a = {}) {
  if (name === 'delegate_to_opencode_free') {
    const mode = a.mode === 'code' ? 'code' : 'ask';
    const minutes = Math.min(60, Math.max(1, Number(a.timeout_minutes) || 15));
    const extra = [...(a.model ? ['-m', a.model] : []), '-t', String(minutes)];
    // Budget: two attempts (first choice + fallback) plus setup.
    const limit = (minutes * 2 + 5) * 60_000;
    if (mode === 'code') {
      const slug = String(a.slug || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
        || `task-${Date.now().toString(36)}`;
      return runDelegate(['run', slug, String(a.prompt), ...extra], limit);
    }
    return runDelegate(['ask', String(a.prompt), ...extra], limit);
  }
  if (name === 'opencode_route') return runDelegate(['route', String(a.task || '')], 30_000);
  if (name === 'opencode_delegations') {
    const act = ['list', 'diff', 'clean'].includes(a.action) ? a.action : 'list';
    return runDelegate(act === 'list' ? ['list'] : [act, String(a.slug || '')], 60_000);
  }
  return { code: 1, out: `unknown tool ${name}` };
}

const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const rl = createInterface({ input: process.stdin });
rl.on('line', async (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  if (id === undefined) return; // notifications (initialized, cancelled) need no reply
  try {
    if (method === 'initialize') {
      send({ jsonrpc: '2.0', id, result: {
        protocolVersion: params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'opencode-helper', version: '1.0.0' },
        instructions: 'Lead agent orchestrates; this server delegates sub-tasks to OpenCode on free models. Review every result before using it.',
      } });
    } else if (method === 'tools/list') {
      send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    } else if (method === 'tools/call') {
      const r = await callTool(params?.name, params?.arguments);
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: r.out || '(no output)' }], isError: r.code !== 0 } });
    } else if (method === 'ping') {
      send({ jsonrpc: '2.0', id, result: {} });
    } else {
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
    }
  } catch (e) {
    send({ jsonrpc: '2.0', id, error: { code: -32603, message: String(e?.message || e) } });
  }
});
