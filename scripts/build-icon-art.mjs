#!/usr/bin/env node
/**
 * Icon art build: validates assets/icons-src/{muscle,equipment}/*.svg against
 * docs/design/ICON_STYLE.md and writes the generated art registry the app
 * renders (src/components/icons/iconArt.generated.ts). Zero dependencies.
 *
 * Usage:
 *   node scripts/build-icon-art.mjs           # validate, then write
 *   node scripts/build-icon-art.mjs --check   # exit 1 if the output would change
 *   node scripts/build-icon-art.mjs --validate  # validate only, never write
 *
 * ICON_ART_SRC overrides the source directory (scripts/test-icons.mjs uses it
 * to run the validator against fixtures).
 *
 * Every violation prints "<file>: <problem>" and exits 1 without writing.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = process.env.ICON_ART_SRC || join(ROOT, 'assets/icons-src');
const OUT_FILE = join(ROOT, 'src/components/icons/iconArt.generated.ts');

/** The two icon kinds, in generated-file order. */
const KINDS = [
  { dir: 'muscle', export: 'MUSCLE_ART', label: 'muscle' },
  { dir: 'equipment', export: 'EQUIPMENT_ART', label: 'equipment' },
];

/** Style-guide limits (docs/design/ICON_STYLE.md). */
const GRID = 48;
const MAX_BYTES = 24 * 1024;
const MAX_ELEMENTS = 200;
const PALETTE = ['#808080', '#bfbfbf', '#ff7a1a', '#b34700'];
const ELEMENTS = new Set([
  'svg',
  'g',
  'path',
  'circle',
  'ellipse',
  'line',
  'rect',
  'polyline',
  'polygon',
]);
const ATTRIBUTES = new Set([
  'viewBox',
  'width',
  'height',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-opacity',
  'stroke-miterlimit',
  'stroke-dasharray',
  'opacity',
  'transform',
  'd',
  'points',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
]);
/** Attributes whose value is a color and therefore limited to the palette. */
const COLOR_ATTRIBUTES = new Set(['fill', 'stroke']);
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+\-]*$/;
const TAG = /<\s*(\/?)\s*([a-zA-Z][\w:-]*)((?:\s+[\w:.-]+\s*=\s*"[^"]*")*)\s*(\/?)\s*>/g;
const ATTR = /([\w:.-]+)\s*=\s*"([^"]*)"/g;

/** Collapse insignificant whitespace and drop comments. */
function minify(svg) {
  return svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .trim();
}

/** All color-ish tokens in the file (catches colors hiding in any attribute). */
function colorProblem(svg) {
  const problems = [];
  if (/url\s*\(/i.test(svg)) problems.push('url(...) references are not allowed');
  if (/\b(?:rgb|rgba|hsl|hsla|color-mix)\s*\(/i.test(svg)) {
    problems.push('rgb()/hsl() colors are not allowed — use the four palette hexes');
  }
  if (/currentColor/i.test(svg)) problems.push('currentColor is not allowed');
  for (const m of svg.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const hex = m[0].toLowerCase();
    if (!PALETTE.includes(hex)) {
      problems.push(`color ${m[0]} is not one of ${PALETTE.join(' / ')}`);
    }
  }
  return [...new Set(problems)];
}

/** Validate one file's markup against the style guide. Returns problem strings. */
function validate(svg) {
  const problems = [];
  if (Buffer.byteLength(svg, 'utf8') > MAX_BYTES) {
    problems.push(`file is larger than ${MAX_BYTES} bytes`);
  }

  const stripped = svg.replace(/<!--[\s\S]*?-->/g, '');
  const tags = [...stripped.matchAll(TAG)];
  if (tags.length === 0 || tags[0][2] !== 'svg' || tags[0][1] !== '') {
    problems.push('first element must be <svg>');
  }
  if (tags.length > MAX_ELEMENTS) {
    problems.push(`more than ${MAX_ELEMENTS} elements`);
  }

  let stack = [];
  let sawRootViewBox = false;
  tags.forEach(([, closing, tag, rawAttrs, selfClose], i) => {
    const at = `<${tag}>`;
    if (!ELEMENTS.has(tag)) {
      problems.push(`${at} element is not allowed (use only ${[...ELEMENTS].join(', ')})`);
      return;
    }
    const attrs = [...rawAttrs.matchAll(ATTR)];
    for (const [, name, value] of attrs) {
      if (!ATTRIBUTES.has(name)) {
        problems.push(`${at} attribute "${name}" is not allowed`);
        continue;
      }
      if (COLOR_ATTRIBUTES.has(name) && value !== 'none' && !PALETTE.includes(value.toLowerCase())) {
        problems.push(`${at} ${name}="${value}" must be none or one of ${PALETTE.join(' / ')}`);
      }
      if (name === 'd' && !PATH_DATA.test(value)) {
        problems.push(`${at} path data has unsupported characters`);
      }
    }
    if (i === 0 && !closing) {
      const vb = attrs.find(([, n]) => n === 'viewBox');
      if (!vb) {
        problems.push('<svg> needs a viewBox');
      } else {
        sawRootViewBox = true;
        const nums = vb[2].trim().split(/[\s,]+/).map(Number);
        if (nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) {
          problems.push(`viewBox="${vb[2]}" must be four numbers "x y w h"`);
        } else {
          const [x, y, w, h] = nums;
          if (w !== h) problems.push(`viewBox "${vb[2]}" must be a square crop`);
          if (x < 0 || y < 0 || x + w > GRID || y + h > GRID) {
            problems.push(`viewBox "${vb[2]}" leaves the ${GRID}x${GRID} grid`);
          }
        }
      }
    }
    if (closing) {
      const open = stack.pop();
      if (open !== tag) problems.push(`</${tag}> does not close <${open ?? 'nothing'}>`);
    } else if (!selfClose) {
      stack.push(tag);
    }
  });
  if (stack.length) problems.push(`unclosed <${stack.join('>, <')}>`);
  if (!sawRootViewBox) return problems;
  problems.push(...colorProblem(stripped));
  return [...new Set(problems)];
}

/** Read + validate one kind. Returns { entries, problems }. */
function readKind(kind) {
  const dir = join(SRC_DIR, kind.dir);
  const entries = [];
  const problems = [];
  if (!existsSync(dir)) return { entries, problems };
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.svg')).sort()) {
    const rel = `assets/icons-src/${kind.dir}/${file}`;
    const svg = readFileSync(join(dir, file), 'utf8');
    const found = validate(svg);
    if (found.length) problems.push(...found.map((p) => `${rel}: ${p}`));
    else entries.push([file.replace(/\.svg$/, ''), minify(svg)]);
  }
  return { entries, problems };
}

/** TS single-quoted string literal. */
function tsString(value) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function key(id) {
  return /^[A-Za-z_$][\w$]*$/.test(id) ? id : JSON.stringify(id);
}

function render(records) {
  const header = [
    '/**',
    ' * GENERATED FILE — do not edit.',
    ' *',
    ' * Built from assets/icons-src/{muscle,equipment}/*.svg by',
    ' * scripts/build-icon-art.mjs — see docs/design/ICON_STYLE.md for the rules.',
    ' * The four authoring colors (#808080 body, #bfbfbf line, #ff7a1a highlight,',
    ' * #b34700 highlight line) are substituted for theme colors at render time by',
    ' * src/lib/iconColors.ts, so the art follows light and dark mode.',
    ' */',
  ].join('\n');
  const blocks = records.map(({ export: name, kind, entries }) => {
    const body = entries.map(([id, svg]) => `  ${key(id)}: ${tsString(svg)},`).join('\n');
    return `export const ${name}: Record<string, string> = {\n${body}\n};`;
  });
  return `${header}\n\n${blocks.join('\n\n')}\n`;
}

const records = [];
const allProblems = [];
for (const kind of KINDS) {
  const { entries, problems } = readKind(kind);
  records.push({ export: kind.export, kind: kind.label, entries });
  allProblems.push(...problems);
}

if (allProblems.length) {
  for (const p of allProblems) console.error(p);
  console.error(`icon art: ${allProblems.length} problem(s) — see docs/design/ICON_STYLE.md`);
  process.exit(1);
}

const total = records.reduce((n, r) => n + r.entries.length, 0);
const out = render(records);
const counts = records.map((r) => `${r.kind}: ${r.entries.length}`).join(', ');

if (process.argv.includes('--validate')) {
  console.log(`icon art: ${total} icon(s) valid (${counts})`);
} else if (process.argv.includes('--check')) {
  const current = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, 'utf8') : '';
  if (current !== out) {
    console.error(
      `icon art: src/components/icons/iconArt.generated.ts is stale — run: node scripts/build-icon-art.mjs`,
    );
    process.exit(1);
  }
  console.log(`icon art: generated file is up to date (${total} icon(s))`);
} else {
  writeFileSync(OUT_FILE, out);
  console.log(`icon art: wrote ${total} icon(s) (${counts})`);
}