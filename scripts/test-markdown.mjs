/**
 * Unit tests for src/lib/markdown.ts — zero new dependencies.
 * Compiles the TS source with the project's own tsc into a temp dir (same
 * pattern as test-calculators.mjs), then asserts on the emitted JS.
 *
 * Usage: npm run test:markdown
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'md-test-'));
try {
  execFileSync('npx', ['tsc', '-p', 'scripts/tsconfig.markdown.json', '--outDir', dir], {
    stdio: 'pipe',
  });
  const md = await import(join(dir, 'markdown.js'));

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

  /* ---- empty / degenerate input ---- */
  eq('empty string -> no blocks', md.parseMarkdown(''), []);
  eq('whitespace only -> no blocks', md.parseMarkdown('  \n\t\n'), []);

  /* ---- headings ---- */
  const heads = md.parseMarkdown('# A\n## B\n### C\n#### D');
  eq(
    'h1..h4 levels',
    heads.map((b) => [b.kind, b.level]),
    [['heading', 1], ['heading', 2], ['heading', 3], ['heading', 4]],
  );
  check('##### clamps to level 4', md.parseMarkdown('##### E')[0].level === 4);
  eq('heading inline bold', heads[1].spans, [{ kind: 'text', text: 'B' }]);
  eq(
    'heading with inline span',
    md.parseMarkdown('## **Big** deal')[0].spans,
    [
      { kind: 'bold', spans: [{ kind: 'text', text: 'Big' }] },
      { kind: 'text', text: ' deal' },
    ],
  );

  /* ---- paragraphs + line breaks ---- */
  const p = md.parseMarkdown('First line\nsecond line');
  check('two lines -> one paragraph', p.length === 1 && p[0].kind === 'paragraph');
  eq('newline becomes a break span', md.parseInline('a\nb'), [
    { kind: 'text', text: 'a' },
    { kind: 'break' },
    { kind: 'text', text: 'b' },
  ]);
  check(
    'paragraph keeps the break span',
    p[0].spans.some((s) => s.kind === 'break'),
  );

  /* ---- inline: bold / italic / code / strike / link ---- */
  eq('bold', md.parseInline('a **b** c'), [
    { kind: 'text', text: 'a ' },
    { kind: 'bold', spans: [{ kind: 'text', text: 'b' }] },
    { kind: 'text', text: ' c' },
  ]);
  eq('italic with *', md.parseInline('*x*'), [
    { kind: 'italic', spans: [{ kind: 'text', text: 'x' }] },
  ]);
  eq('italic with _', md.parseInline('_y_'), [
    { kind: 'italic', spans: [{ kind: 'text', text: 'y' }] },
  ]);
  eq('intra-word underscore is not italic', md.parseInline('snake_case'), [
    { kind: 'text', text: 'snake_case' },
  ]);
  eq('inline code is literal', md.parseInline('`a*b`'), [{ kind: 'code', text: 'a*b' }]);
  eq('strike', md.parseInline('~~old~~'), [
    { kind: 'strike', spans: [{ kind: 'text', text: 'old' }] },
  ]);
  eq('link keeps label + href', md.parseInline('[docs](https://example.com)'), [
    { kind: 'link', href: 'https://example.com', spans: [{ kind: 'text', text: 'docs' }] },
  ]);
  eq('bold containing italic', md.parseInline('**a *b* c**'), [
    {
      kind: 'bold',
      spans: [
        { kind: 'text', text: 'a ' },
        { kind: 'italic', spans: [{ kind: 'text', text: 'b' }] },
        { kind: 'text', text: ' c' },
      ],
    },
  ]);

  /* ---- lists ---- */
  const bullets = md.parseMarkdown('- one\n* two')[0];
  check('bullet list', bullets.kind === 'list' && bullets.ordered === false);
  check('two bullet items', bullets.items.length === 2);
  eq('bullet item text', bullets.items[0].spans, [{ kind: 'text', text: 'one' }]);

  const legacyBullets = md.parseMarkdown('• cue one\n• cue two')[0];
  check(
    'legacy • bullets parse as a list',
    legacyBullets.kind === 'list' && legacyBullets.ordered === false && legacyBullets.items.length === 2,
  );

  const ordered = md.parseMarkdown('1. one\n2. two\n3) three')[0];
  check('ordered list', ordered.kind === 'list' && ordered.ordered === true);
  check('three ordered items', ordered.items.length === 3);

  const nested = md.parseMarkdown('- a\n  - a1\n  - a2\n- b')[0];
  check('nested list keeps two parents', nested.kind === 'list' && nested.items.length === 2);
  check('first parent has a sublist', !!nested.items[0].sublist);
  check('sublist has two items', nested.items[0].sublist.items.length === 2);
  check('second parent has no sublist', nested.items[1].sublist === undefined);
  eq('nested item text', nested.items[0].sublist.items[1].spans, [
    { kind: 'text', text: 'a2' },
  ]);

  /* ---- blockquote / rule / code ---- */
  const q = md.parseMarkdown('> be careful')[0];
  check('blockquote block', q.kind === 'blockquote');
  eq('blockquote spans', q.spans, [{ kind: 'text', text: 'be careful' }]);
  check('multi-line blockquote joins with a break', md.parseMarkdown('> a\n> b')[0].spans.some((s) => s.kind === 'break'));

  check('horizontal rule', md.parseMarkdown('---')[0].kind === 'rule');

  const code = md.parseMarkdown('```js\nconst x = 1;\n```')[0];
  check('fenced code block', code.kind === 'code' && code.language === 'js');
  check('fenced code body', code.code === 'const x = 1;');

  /* ---- tables ---- */
  const table = md.parseMarkdown('| A | B |\n| --- | --- |\n| 1 | 2 |')[0];
  check('table block', table.kind === 'table');
  check('table header cells', table.header.length === 2);
  check('table has one row', table.rows.length === 1);
  eq('table header cell', table.header[0], [{ kind: 'text', text: 'A' }]);
  eq('table body cell', table.rows[0][1], [{ kind: 'text', text: '2' }]);

  /* ---- legacy: numbered steps run together on one line ---- */
  const legacy =
    '1. While holding a dumbbell, bend forward until your torso is near parallel to the bench.2. Position the palms on the bench.3. Drive back up.';
  check(
    'legacy run becomes an ordered list',
    md.legacySplitSteps(legacy) !== null && md.legacySplitSteps(legacy).length === 3,
  );
  const legacyBlock = md.parseMarkdown(legacy)[0];
  check(
    'legacy paragraph becomes list',
    legacyBlock.kind === 'list' && legacyBlock.ordered === true && legacyBlock.items.length === 3,
  );
  eq('legacy first item', legacyBlock.items[0].spans, [
    {
      kind: 'text',
      text: 'While holding a dumbbell, bend forward until your torso is near parallel to the bench.',
    },
  ]);
  eq('legacy second item', legacyBlock.items[1].spans, [
    { kind: 'text', text: 'Position the palms on the bench.' },
  ]);
  eq('legacy third item', legacyBlock.items[2].spans, [{ kind: 'text', text: 'Drive back up.' }]);

  /* ---- legacy false positives are left alone ---- */
  check('prose with numbers is not split', md.legacySplitSteps('Do 2 sets then 3 reps') === null);
  check('a single numbered line is not legacy', md.legacySplitSteps('1. just one') === null);
  check(
    'a lone numbered step stays a list',
    md.parseMarkdown('1. just one')[0].kind === 'list' &&
      md.parseMarkdown('1. just one')[0].items.length === 1,
  );
  check(
    'sentence containing step numbers is not split',
    md.parseMarkdown('See step 1. Then do 2.')[0].kind === 'paragraph',
  );

  /* ---- CRLF handling ---- */
  const crlf = md.parseMarkdown('# Title\r\n\r\nBody');
  eq('CRLF parses like LF', crlf.map((b) => b.kind), ['heading', 'paragraph']);

  console.log(`test:markdown — ${passed} assertions passed`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
