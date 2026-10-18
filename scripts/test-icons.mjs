/**
 * Icon pipeline tests — zero new dependencies.
 *
 * 1. The generated art registry is up to date (assets/icons-src -> TS).
 * 2. The style-guide rules in docs/design/ICON_STYLE.md are enforced.
 * 3. The pure color helpers in src/lib/iconColors.ts behave.
 *
 * Compiles the TS source with the project's own tsc into a temp dir (same
 * pattern as test-calculators.mjs), then asserts on the emitted JS.
 *
 * Usage: node scripts/test-icons.mjs   (npm run test:icons)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Run the validator against a source dir; returns { code, stderr }. */
function validate(srcDir) {
  try {
    execFileSync('node', ['scripts/build-icon-art.mjs', '--validate'], {
      encoding: 'utf8',
      env: { ...process.env, ICON_ART_SRC: srcDir },
      stdio: 'pipe',
    });
    return { code: 0, stderr: '' };
  } catch (err) {
    return { code: err.status ?? 1, stderr: String(err.stderr ?? '') };
  }
}

let passed = 0;
function check(name, cond) {
  if (!cond) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
  } else {
    passed++;
  }
}
function eq(name, actual, expected) {
  check(name, JSON.stringify(actual) === JSON.stringify(expected));
}

/* ---- 1. the generated registry matches the SVG sources ---- */
const build = execFileSync('node', ['scripts/build-icon-art.mjs', '--check'], { encoding: 'utf8' });
check(`build-icon-art --check is clean (${build.trim()})`, build.includes('up to date'));

/* ---- 2. the style-guide rules actually bite ---- */
const fixtures = mkdtempSync(join(tmpdir(), 'icon-src-'));
try {
  mkdirSync(join(fixtures, 'muscle'));
  const good = readFileSync(join('assets/icons-src/muscle/Chest.svg'), 'utf8');
  writeFileSync(join(fixtures, 'muscle/Chest.svg'), good);
  eq('a clean file validates', validate(fixtures).code, 0);

  const cases = [
    ['BadColor', good.replace('#808080', '#123456'), '#123456'],
    ['BadElement', good.replace('<path', '<text>x</text><path'), 'element is not allowed'],
    ['BadBox', good.replace('viewBox="11 11 26 26"', 'viewBox="11 11 26 20"'), 'square crop'],
    ['BadBoxOutside', good.replace('viewBox="11 11 26 26"', 'viewBox="11 11 40 40"'), 'leaves the 48x48 grid'],
    ['NoBox', good.replace(' viewBox="11 11 26 26"', ''), 'needs a viewBox'],
    ['BadAttr', good.replace('fill="#808080"', 'fill="#808080" class="peck"'), 'attribute "class" is not allowed'],
    ['NamedColor', good.replace('#bfbfbf', 'white'), 'must be none or one of'],
    ['RgbColor', good.replace('#bfbfbf', 'rgb(191,191,191)'), 'rgb()/hsl()'],
    ['BadPath', good.replace('M22.2 11.6', 'M22.2 $11.6'), 'unsupported characters'],
  ];
  for (const [id, svg, expected] of cases) {
    writeFileSync(join(fixtures, `muscle/${id}.svg`), svg);
    const res = validate(fixtures);
    check(`${id} exits 1`, res.code === 1);
    check(`${id} names the file and the problem`, res.stderr.includes(`${id}.svg: `) && res.stderr.includes(expected));
    rmSync(join(fixtures, `muscle/${id}.svg`));
  }
} finally {
  rmSync(fixtures, { recursive: true, force: true });
}

/* ---- 3. color helpers ---- */
const dir = mkdtempSync(join(tmpdir(), 'icon-test-'));
try {
  execFileSync('npx', ['tsc', '-p', 'scripts/tsconfig.icons.json', '--outDir', dir], {
    stdio: 'pipe',
  });
  const ic = await import(join(dir, 'iconColors.js'));

  /* ---- parseHexColor ---- */
  eq('parse #808080', ic.parseHexColor('#808080'), { r: 128, g: 128, b: 128 });
  eq('parse uppercase + spaces', ic.parseHexColor(' #4A4A50 '), { r: 74, g: 74, b: 80 });
  eq('parse #fff shorthand', ic.parseHexColor('#fff'), { r: 255, g: 255, b: 255 });
  check('parse rejects rgb()', ic.parseHexColor('rgb(1,2,3)') === undefined);
  check('parse rejects 8-digit', ic.parseHexColor('#80808080') === undefined);
  check('parse rejects garbage', ic.parseHexColor('tomato') === undefined);

  /* ---- lighten / darken ---- */
  eq('lighten black 35%', ic.lightenTowardWhite('#000000', 0.35), '#595959');
  eq('lighten white is a no-op', ic.lightenTowardWhite('#ffffff', 0.35), '#ffffff');
  eq('lighten amount 0 is a no-op', ic.lightenTowardWhite('#123456', 0), '#123456');
  eq('lighten amount clamps at 1', ic.lightenTowardWhite('#123456', 5), '#ffffff');
  eq('lighten negative clamps at 0', ic.lightenTowardWhite('#123456', -2), '#123456');
  eq('darken white 35%', ic.darken('#ffffff', 0.35), '#a6a6a6');
  eq('darken #ff7a1a 35%', ic.darken('#ff7a1a', 0.35), '#a64f11');
  eq('darken amount clamps at 1', ic.darken('#123456', 1), '#000000');
  eq('darken amount clamps at 0', ic.darken('#123456', -1), '#123456');
  eq('unparseable color passes through', ic.lightenTowardWhite('hsl(0 0% 0%)'), 'hsl(0 0% 0%)');
  eq('channels round half up', ic.darken('#010203', 0.5), '#010102');

  /* ---- the palette the app actually uses ---- */
  eq(
    'dark theme palette',
    ic.themeIconPalette('#4a4a50', '#ff7a1a'),
    { body: '#4a4a50', line: '#89898d', hi: '#ff7a1a', hiLine: '#a64f11' },
  );
  eq(
    'light theme palette',
    ic.themeIconPalette('#9a9aa3', '#ff7a1a'),
    { body: '#9a9aa3', line: '#bdbdc3', hi: '#ff7a1a', hiLine: '#a64f11' },
  );

  /* ---- substitution ---- */
  const art = '<path fill="#808080" stroke="#bfbfbf" /><path fill="#ff7a1a" stroke="#b34700" />';
  eq(
    'all four authoring colors are swapped',
    ic.applyIconPalette(art, { body: '#4a4a50', line: '#89898d', hi: '#ff7a1a', hiLine: '#a64f11' }),
    '<path fill="#4a4a50" stroke="#89898d" /><path fill="#ff7a1a" stroke="#a64f11" />',
  );
  eq(
    'uppercase hex is matched too',
    ic.applyIconPalette('<path stroke="#B34700" />', ic.themeIconPalette('#4a4a50', '#ff7a1a')),
    '<path stroke="#a64f11" />',
  );
  eq(
    'one pass: a substituted value is never re-substituted',
    ic.applyIconPalette('<path fill="#808080" />', {
      body: '#ff7a1a',
      line: '#89898d',
      hi: '#b34700',
      hiLine: '#b34700',
    }),
    '<path fill="#ff7a1a" />',
  );
  eq(
    'a longer hex starting with a token is left alone',
    ic.applyIconPalette('<path fill="#808080ff" />', ic.themeIconPalette('#4a4a50', '#ff7a1a')),
    '<path fill="#808080ff" />',
  );
  eq(
    'markup without authoring colors is untouched',
    ic.applyIconPalette('<path fill="none" d="M1 2 L3 4" />', ic.themeIconPalette('#4a4a50', '#ff7a1a')),
    '<path fill="none" d="M1 2 L3 4" />',
  );

  /* ---- themedIconArt ---- */
  const table = { Chest: '<svg><path fill="#808080" /><path fill="#ff7a1a" /></svg>' };
  eq(
    'known id returns themed markup',
    ic.themedIconArt(table, 'Chest', '#4a4a50', '#ff7a1a'),
    '<svg><path fill="#4a4a50" /><path fill="#ff7a1a" /></svg>',
  );
  eq('unknown id returns undefined', ic.themedIconArt(table, 'Lats', '#4a4a50', '#ff7a1a'), undefined);
  eq('empty table returns undefined', ic.themedIconArt({}, 'Chest', '#4a4a50', '#ff7a1a'), undefined);
  check(
    'repeat call is memoized to the same string',
    ic.themedIconArt(table, 'Chest', '#4a4a50', '#ff7a1a') ===
      ic.themedIconArt(table, 'Chest', '#4a4a50', '#ff7a1a'),
  );
  eq(
    'a different theme re-themes the art',
    ic.themedIconArt(table, 'Chest', '#9a9aa3', '#ff7a1a'),
    '<svg><path fill="#9a9aa3" /><path fill="#ff7a1a" /></svg>',
  );
  eq(
    'the first theme is still memoized after that',
    ic.themedIconArt(table, 'Chest', '#4a4a50', '#ff7a1a'),
    '<svg><path fill="#4a4a50" /><path fill="#ff7a1a" /></svg>',
  );

  console.log(`test:icons — ${passed} assertions passed`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}