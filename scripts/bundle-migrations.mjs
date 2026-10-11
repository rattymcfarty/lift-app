#!/usr/bin/env node
/**
 * Bundles drizzle-kit SQL migrations into the JS module the expo-sqlite
 * migrator consumes: src/db/migrations/migrations.js (+ migrations.d.ts).
 *
 * drizzle-kit generate emits only .sql + meta/; this script runs right after:
 *   npm run db:generate  →  drizzle-kit generate && node scripts/bundle-migrations.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'src', 'db', 'migrations');
const metaDir = join(dir, 'meta');

const journal = JSON.parse(readFileSync(join(metaDir, '_journal.json'), 'utf8'));

// The expo-sqlite migrator looks up migrations by `m{idx}` keys
// (m0000, m0001, ...), NOT by tag. See drizzle-orm/expo-sqlite/migrator.js:
//   migrations[`m${journalEntry.idx.toString().padStart(4, "0")}`]
// Keying by tag crashes the app at launch with "Missing migration".
const entries = journal.entries.map((e) => {
  const sql = readFileSync(join(dir, `${e.tag}.sql`), 'utf8');
  const key = `m${String(e.idx).padStart(4, '0')}`;
  return { key, sql };
});

const js =
  `// GENERATED — do not edit. Rebuilt by scripts/bundle-migrations.mjs\n` +
  `export default {\n` +
  `  journal: ${JSON.stringify(journal)},\n` +
  `  migrations: {\n` +
  entries.map((e) => `    ${JSON.stringify(e.key)}: ${JSON.stringify(e.sql)}`).join(',\n') +
  `\n  },\n` +
  `};\n`;

// Literal key types (m0000, m0001, ...) so TypeScript catches a bundle/migrator
// mismatch at compile time instead of crashing at runtime.
const keyType = entries.map((e) => JSON.stringify(e.key)).join(' | ') || 'never';
const dts =
  `// GENERATED — do not edit. Rebuilt by scripts/bundle-migrations.mjs\n` +
  `declare const migrations: {\n` +
  `  journal: {\n` +
  `    entries: Array<{ idx: number; when: number; tag: string; breakpoints: boolean }>;\n` +
  `  };\n` +
  `  migrations: Record<${keyType}, string>;\n` +
  `};\n` +
  `export default migrations;\n`;

writeFileSync(join(dir, 'migrations.js'), js);
writeFileSync(join(dir, 'migrations.d.ts'), dts);
console.log(`bundled ${entries.length} migration(s) → src/db/migrations/migrations.js`);
