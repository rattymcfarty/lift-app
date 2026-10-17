/**
 * Tiny, dependency-free Markdown parser for the exercise Guide prose.
 *
 * The Guide renders knowledge-base text that mixes real Markdown with a legacy
 * shape: older overview strings run several numbered steps together on one
 * line ("1. Hold the bar... 2. Brace..."). parseMarkdown() detects that
 * pattern and splits it into ordered-list items so the UI shows a real list.
 *
 * Pure and IO-free: no imports, no network. It runs identically under Hermes
 * and in the node unit tests (scripts/test-markdown.mjs). A link is only ever
 * a styled span here — nothing is opened or fetched.
 *
 * Supported syntax: headings (#..####), paragraphs, bullet lists (-, *, + and
 * the KB's legacy •), numbered lists (1. / 1)), one level of nesting,
 * blockquotes (>), horizontal rules (---), fenced code (```/~~~), simple
 * tables, and the inline spans **bold**, *italic* / _italic_, `code`,
 * ~~strike~~ and [text](url).
 */

/** A styled run inside a block. Literal kinds carry `text`; styled kinds nest. */
export type InlineSpan =
  | { kind: 'text'; text: string }
  | { kind: 'break' }
  | { kind: 'code'; text: string }
  | { kind: 'bold'; spans: InlineSpan[] }
  | { kind: 'italic'; spans: InlineSpan[] }
  | { kind: 'strike'; spans: InlineSpan[] }
  | { kind: 'link'; href: string; spans: InlineSpan[] };

/** A list entry. `sublist` holds exactly one level of nesting. */
export interface ListItem {
  spans: InlineSpan[];
  sublist?: { ordered: boolean; items: ListItem[] };
}

/** A rendered block of Markdown. */
export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4; spans: InlineSpan[] }
  | { kind: 'paragraph'; spans: InlineSpan[] }
  | { kind: 'list'; ordered: boolean; items: ListItem[] }
  | { kind: 'blockquote'; spans: InlineSpan[] }
  | { kind: 'code'; language?: string; code: string }
  | { kind: 'rule' }
  | { kind: 'table'; header: InlineSpan[][]; rows: InlineSpan[][][] };

const BLANK = /^\s*$/;
const HR = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s{0,3}(```|~~~)\s*(\S*)\s*$/;
const BLOCKQUOTE = /^\s{0,3}>\s?(.*)$/;
const BULLET = /^(\s*)([-*+•])\s+(.*)$/;
const ORDERED = /^(\s*)(\d+)[.)]\s+(.*)$/;
/** A table separator row: only pipes, dashes, colons and spaces, with a dash. */
const TABLE_SEP = /^[\s|:-]+$/;
const WORD = /[A-Za-z0-9]/;

function indentOf(line: string): number {
  const m = line.match(/^\s*/);
  return m ? m[0].length : 0;
}

function isBlank(line: string): boolean {
  return BLANK.test(line);
}

/**
 * Split a legacy single-line numbered run ("1. ... 2. ... 3. ...") into its
 * steps. Returns null unless the line starts with "1." and the following
 * markers are 2, 3, ... in order — so ordinary prose that merely mentions
 * numbers ("do 2 sets, then 3 reps") is left alone.
 */
export function legacySplitSteps(text: string): string[] | null {
  const re = /(\d+)\.\s+/g;
  const marks: Array<{ num: number; start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    marks.push({ num: Number(m[1]), start: m.index, end: m.index + m[0].length });
  }
  if (marks.length < 2) return null;
  if (marks[0].num !== 1) return null;
  if (!BLANK.test(text.slice(0, marks[0].start))) return null;
  for (let k = 0; k < marks.length; k++) {
    if (marks[k].num !== k + 1) return null;
  }
  const items: string[] = [];
  for (let k = 0; k < marks.length; k++) {
    const from = marks[k].end;
    const to = k + 1 < marks.length ? marks[k + 1].start : text.length;
    items.push(text.slice(from, to).trim());
  }
  return items;
}

/** A single/double emphasis marker is ignored when it sits inside a word. */
function isIntraWord(src: string, i: number): boolean {
  const before = src[i - 1];
  const after = src[i + 1];
  return before !== undefined && WORD.test(before) && after !== undefined && WORD.test(after);
}

/** Index of the closing marker for emphasis opened at `from`, or -1. */
function findItalicEnd(src: string, from: number, marker: string): number {
  for (let j = from; j < src.length; j++) {
    if (src[j] !== marker) continue;
    if (j === from) continue; // empty emphasis
    if (src[j - 1] === marker) continue; // belongs to a double marker
    if (src[j + 1] === marker) {
      j += 1;
      continue;
    }
    const after = src[j + 1];
    if (after !== undefined && WORD.test(after)) continue;
    return j;
  }
  return -1;
}

function matchLink(
  src: string,
  start: number,
): { text: string; href: string; end: number } | null {
  const close = src.indexOf(']', start + 1);
  if (close === -1 || src[close + 1] !== '(') return null;
  const paren = src.indexOf(')', close + 2);
  if (paren === -1) return null;
  const label = src.slice(start + 1, close);
  if (label.length === 0) return null;
  return { text: label, href: src.slice(close + 2, paren).trim(), end: paren + 1 };
}

/** Parse a chunk of inline Markdown into spans (newlines become break spans). */
export function parseInline(src: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let text = '';
  const flush = (): void => {
    if (text.length > 0) {
      spans.push({ kind: 'text', text });
      text = '';
    }
  };
  const n = src.length;
  let i = 0;
  while (i < n) {
    const ch = src[i];
    if (ch === '\n') {
      flush();
      spans.push({ kind: 'break' });
      i += 1;
      continue;
    }
    if (ch === '\\' && i + 1 < n) {
      text += src[i + 1];
      i += 2;
      continue;
    }
    if (ch === '`') {
      const end = src.indexOf('`', i + 1);
      if (end > i + 1) {
        flush();
        spans.push({ kind: 'code', text: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (ch === '[') {
      const label = matchLink(src, i);
      if (label) {
        flush();
        spans.push({ kind: 'link', href: label.href, spans: parseInline(label.text) });
        i = label.end;
        continue;
      }
    }
    if ((ch === '*' || ch === '_') && src[i + 1] === ch && !isIntraWord(src, i)) {
      const end = src.indexOf(ch + ch, i + 2);
      if (end > -1) {
        flush();
        spans.push({ kind: 'bold', spans: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (ch === '~' && src[i + 1] === '~') {
      const end = src.indexOf('~~', i + 2);
      if (end > -1) {
        flush();
        spans.push({ kind: 'strike', spans: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if ((ch === '*' || ch === '_') && !isIntraWord(src, i)) {
      const end = findItalicEnd(src, i + 1, ch);
      if (end > -1) {
        flush();
        spans.push({ kind: 'italic', spans: parseInline(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    text += ch;
    i += 1;
  }
  flush();
  return spans;
}

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((cell) => cell.trim());
}

function isTableStart(lines: string[], i: number): boolean {
  if (i + 1 >= lines.length) return false;
  if (!lines[i].includes('|')) return false;
  const sep = lines[i + 1].trim();
  if (sep.length === 0 || !TABLE_SEP.test(sep) || !sep.includes('-')) return false;
  return true;
}

/** True when a line begins a new block (used to end a paragraph). */
function startsBlock(lines: string[], i: number): boolean {
  const line = lines[i];
  if (isBlank(line)) return true;
  if (FENCE.test(line)) return true;
  if (HR.test(line)) return true;
  if (HEADING.test(line)) return true;
  if (BLOCKQUOTE.test(line)) return true;
  if (BULLET.test(line) || ORDERED.test(line)) return true;
  if (isTableStart(lines, i)) return true;
  return false;
}

function parseList(lines: string[], start: number): { block: Block; next: number } {
  const baseIndent = indentOf(lines[start]);
  const ordered = ORDERED.test(lines[start]);
  const items: ListItem[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line) || indentOf(line) < baseIndent) break;
    const m = line.match(ORDERED) ?? line.match(BULLET);
    if (!m) break;
    const content = m[3];
    if (indentOf(line) > baseIndent && items.length > 0) {
      const last = items[items.length - 1];
      if (!last.sublist) last.sublist = { ordered: ORDERED.test(line), items: [] };
      last.sublist.items.push({ spans: parseInline(content) });
      i += 1;
      continue;
    }
    // A run-together numbered line becomes several items.
    const legacy = ORDERED.test(line) ? legacySplitSteps(line) : null;
    if (legacy) {
      for (const step of legacy) items.push({ spans: parseInline(step) });
    } else {
      items.push({ spans: parseInline(content) });
    }
    i += 1;
  }
  return { block: { kind: 'list', ordered, items }, next: i };
}

/** Parse a Markdown string into a flat list of renderable blocks. */
export function parseMarkdown(input: string): Block[] {
  const src = String(input ?? '').replace(/\r\n?/g, '\n');
  const lines = src.split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i += 1;
      continue;
    }

    const fence = line.match(FENCE);
    if (fence) {
      const marker = fence[1];
      const language = fence[2] || undefined;
      const body: string[] = [];
      i += 1;
      const closing = new RegExp('^\\s{0,3}' + marker);
      while (i < lines.length && !closing.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1; // consume the closing fence
      blocks.push({ kind: 'code', language, code: body.join('\n') });
      continue;
    }

    if (HR.test(line)) {
      blocks.push({ kind: 'rule' });
      i += 1;
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      const level = Math.min(heading[1].length, 4) as 1 | 2 | 3 | 4;
      blocks.push({ kind: 'heading', level, spans: parseInline(heading[2].trim()) });
      i += 1;
      continue;
    }

    if (BLOCKQUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && BLOCKQUOTE.test(lines[i])) {
        quoted.push((lines[i].match(BLOCKQUOTE) as RegExpMatchArray)[1]);
        i += 1;
      }
      blocks.push({ kind: 'blockquote', spans: parseInline(quoted.join('\n')) });
      continue;
    }

    if (isTableStart(lines, i)) {
      const header = splitRow(lines[i]).map((cell) => parseInline(cell));
      const rows: InlineSpan[][][] = [];
      i += 2; // header + separator
      while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) {
        rows.push(splitRow(lines[i]).map((cell) => parseInline(cell)));
        i += 1;
      }
      blocks.push({ kind: 'table', header, rows });
      continue;
    }

    const legacy = legacySplitSteps(line);
    if (legacy) {
      blocks.push({
        kind: 'list',
        ordered: true,
        items: legacy.map((step) => ({ spans: parseInline(step) })),
      });
      i += 1;
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const parsed = parseList(lines, i);
      blocks.push(parsed.block);
      i = parsed.next;
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && !startsBlock(lines, i)) {
      para.push(lines[i]);
      i += 1;
    }
    if (para.length > 0) {
      blocks.push({ kind: 'paragraph', spans: parseInline(para.join('\n')) });
    } else {
      // Defensive: an unhandled line must never stall the loop.
      blocks.push({ kind: 'paragraph', spans: parseInline(line) });
      i += 1;
    }
  }
  return blocks;
}
