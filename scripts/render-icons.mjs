#!/usr/bin/env node
/**
 * Icon contact sheet: renders every generated icon at 96 px on a dark tile
 * (#1c1c1e) and a light tile (#f2f2f7) — plus a 48 px pass to check small-size
 * legibility — then screenshots the page with headless Chrome.
 *
 * The art is read from src/components/icons/iconArt.generated.ts so the sheet
 * always shows exactly what the app renders. Build it first:
 *   node scripts/build-icon-art.mjs && node scripts/render-icons.mjs [out.png]
 *
 * Zero dependencies.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GENERATED = join(ROOT, 'src/components/icons/iconArt.generated.ts');
const DEFAULT_OUT = join(ROOT, '.opencode/renders/sheet.png');
const CHROME = '/opt/google/chrome/chrome';

/** Layout constants — the window size is computed from these, not guessed. */
const TILE_BIG = 96;
const TILE_SMALL = 48;
const GAP = 8;
const PAD = 10;
const LABEL_H = 20;
const COLS = 3;
const PAGE_PAD = 28;
const TITLE_H = 56;
const SECTION_H = 32;
const SECTION_GAP = 20;
const CELL_W = TILE_BIG * 2 + TILE_SMALL * 2 + GAP * 3 + PAD * 2;
const CELL_H = TILE_BIG + LABEL_H + PAD * 2;

/**
 * Theme colors the app substitutes, on a dark and a light tile.
 *
 * These are the REAL app values, so the sheet shows what the icons look like in
 * the app: `body` is theme `muted`, `hi` is theme `highlight` (the blue set
 * numbers and active borders use — never the #ff7a1a authoring placeholder),
 * and `line`/`shadow`/`hiLine` are derived exactly as src/lib/iconColors.ts
 * derives them (LINE_LIGHTEN / SHADOW_DARKEN / HI_LINE_DARKEN below, mirrored in
 * `themeIconPalette`).
 */
const LINE_LIGHTEN = 0.35;
const SHADOW_DARKEN = 0.28;
const HI_LINE_DARKEN = 0.35;

function mix(color, target, amount) {
  const hex = color.replace('#', '');
  const parts = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const out = parts.map((v) => Math.round(v + (target - v) * amount));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** muted / highlight per theme, straight from src/theme/tokens.ts. */
const THEME_TOKENS = {
  dark: { tile: '#1c1c1e', muted: '#a1a1a6', highlight: '#4b98e8' },
  light: { tile: '#f2f2f7', muted: '#5c5c60', highlight: '#1a69c8' },
};

const THEMES = Object.fromEntries(
  Object.entries(THEME_TOKENS).map(([name, t]) => [
    name,
    {
      tile: t.tile,
      body: t.muted,
      line: mix(t.muted, 255, LINE_LIGHTEN),
      shadow: mix(t.muted, 0, SHADOW_DARKEN),
      hi: t.highlight,
      hiLine: mix(t.highlight, 0, HI_LINE_DARKEN),
    },
  ]),
);

/**
 * Swap the authoring colors for theme colors in one pass, mirroring
 * applyIconPalette() in src/lib/iconColors.ts (kept here because this script
 * must stay dependency-free and cannot import TS).
 */
const PALETTE = {
  '#808080': 'body',
  '#bfbfbf': 'line',
  '#4d4d4d': 'shadow',
  '#ff7a1a': 'hi',
  '#b34700': 'hiLine',
};
function themeColors(markup, theme) {
  return markup.replace(/#(?:808080|bfbfbf|4d4d4d|ff7a1a|b34700)\b/gi, (match) => theme[PALETTE[match.toLowerCase()]]);
}

/** Pull the two art records out of the generated TS file. */
function readGenerated() {
  if (!existsSync(GENERATED)) {
    console.error(`render-icons: ${GENERATED} is missing — run: node scripts/build-icon-art.mjs`);
    process.exit(1);
  }
  const ts = readFileSync(GENERATED, 'utf8');
  const records = {};
  const entry = /^ {2}(?:"([^"]+)"|([A-Za-z_$][\w$]*)): '((?:[^'\\]|\\.)*)',$/gm;
  for (const block of ts.matchAll(/export const (\w+): Record<string, string> = \{([\s\S]*?)\n\};/g)) {
    const [, name, body] = block;
    const items = [];
    for (const [, quoted, bare, raw] of body.matchAll(entry)) {
      items.push([quoted ?? bare, raw.replace(/\\\\/g, '\\').replace(/\\'/g, "'")]);
    }
    records[name] = items.sort(([a], [b]) => a.localeCompare(b));
  }
  for (const required of ['MUSCLE_ART', 'EQUIPMENT_ART']) {
    if (!records[required]) {
      console.error(`render-icons: could not read ${required} from ${GENERATED}`);
      process.exit(1);
    }
  }
  return records;
}

function tile(id, markup, theme, size) {
  const t = THEMES[theme];
  return `<div class="tile ${theme}" style="width:${size}px;height:${size}px">${themeColors(markup, t)}</div>`;
}

function cell(id, markup) {
  return `<div class="cell">
    ${tile(id, markup, 'dark', TILE_BIG)}${tile(id, markup, 'light', TILE_BIG)}
    ${tile(id, markup, 'dark', TILE_SMALL)}${tile(id, markup, 'light', TILE_SMALL)}
    <div class="label">${id}</div>
  </div>`;
}

function section(title, items) {
  if (!items.length) return { html: '', rows: 0 };
  const rows = Math.ceil(items.length / COLS) || 1;
  return { html: `<h2>${title} <span>${items.length}</span></h2><div class="grid">${items.map(([id, svg]) => cell(id, svg)).join('')}</div>`, rows };
}

function buildHtml(records) {
  const muscle = section('Muscle groups', records.MUSCLE_ART);
  const equipment = section('Equipment', records.EQUIPMENT_ART);
  const width = PAGE_PAD * 2 + CELL_W * COLS;
  const height =
    PAGE_PAD * 2 +
    TITLE_H +
    SECTION_H * (Number(muscle.rows > 0) + Number(equipment.rows > 0)) +
    (muscle.rows && equipment.rows ? SECTION_GAP : 0) +
    CELL_H * (muscle.rows + equipment.rows);
  const css = `
    * { box-sizing: border-box; }
    body { margin: 0; padding: ${PAGE_PAD}px; width: ${width}px; background: #0d0d0f;
           font: 13px/1.4 -apple-system, 'DejaVu Sans', sans-serif; color: #e6e6ea; }
    h1 { font-size: 18px; margin: 0 0 4px; font-weight: 600; }
    .sub { color: #8a8a92; margin: 0; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 10px; color: #a8a8b0; }
    h2 span { color: #5f5f68; }
    .grid { display: grid; grid-template-columns: repeat(${COLS}, ${CELL_W}px); gap: ${GAP}px ${GAP}px; }
    .cell { width: ${CELL_W}px; padding: ${PAD}px; background: #17171a; border-radius: 14px; display: flex;
            flex-wrap: wrap; gap: ${GAP}px; align-content: flex-start; }
    .tile { display: flex; align-items: center; justify-content: center; border-radius: 10px; overflow: hidden; }
    .tile.dark { background: ${THEMES.dark.tile}; }
    .tile.light { background: ${THEMES.light.tile}; }
    .tile svg { width: 100%; height: 100%; display: block; }
    .label { width: 100%; text-align: center; height: ${LABEL_H}px; line-height: ${LABEL_H}px; color: #b8b8c0; }
  `;
  return {
    width,
    height,
    html: `<!doctype html>
<html><head><meta charset="utf-8" /><title>LIFT icon sheet</title><style>${css}</style></head>
<body>
  <h1>LIFT icon contact sheet</h1>
  <p class="sub">96 px tiles on #1c1c1e and #f2f2f7, then 48 px. Generated by scripts/render-icons.mjs — do not edit.</p>
  <section>${muscle.html}</section>
  <section>${equipment.html}</section>
</body></html>
`,
  };
}

const records = readGenerated();
// `--only=muscle|equipment` renders one half of the sheet — handy while
// redrawing a single set, because the full sheet is too tall to see at once.
const onlyArg = process.argv.slice(2).find((a) => a.startsWith('--only='))?.slice('--only='.length);
if (onlyArg && !['muscle', 'equipment'].includes(onlyArg)) {
  console.error(`render-icons: --only must be "muscle" or "equipment", got "${onlyArg}"`);
  process.exit(2);
}
const shown = onlyArg
  ? { MUSCLE_ART: onlyArg === 'muscle' ? records.MUSCLE_ART : {}, EQUIPMENT_ART: onlyArg === 'equipment' ? records.EQUIPMENT_ART : {} }
  : records;
const { width, height, html } = buildHtml(shown);
const outArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const out = outArg ? resolve(ROOT, outArg) : DEFAULT_OUT;
mkdirSync(dirname(out), { recursive: true });
const htmlFile = join(dirname(out), 'sheet.html');
writeFileSync(htmlFile, html);

const args = [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--hide-scrollbars',
  `--window-size=${width},${height}`,
  `--screenshot=${out}`,
  `file://${htmlFile}`,
];
console.log(`render-icons: ${width}x${height} -> ${out}`);
const chrome = spawn(CHROME, args, { stdio: 'inherit' });
chrome.on('error', (err) => {
  console.error(`render-icons: could not run ${CHROME}: ${err.message}`);
  process.exit(1);
});
chrome.on('exit', (code) => {
  if (code !== 0) {
    console.error(`render-icons: chrome exited ${code}`);
    process.exit(code ?? 1);
  }
  if (!existsSync(out)) {
    console.error(`render-icons: ${out} was not written`);
    process.exit(1);
  }
  console.log(`render-icons: wrote ${out} (html: ${htmlFile})`);
});