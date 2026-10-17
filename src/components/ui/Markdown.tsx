/**
 * Markdown — renders exercise Guide prose (overview, longevity notes, safety,
 * instructions, cues, common mistakes) as real blocks instead of raw text.
 *
 * Uses only theme tokens (src/theme/tokens.ts): accent for headings, links and
 * list markers; highlight for the blockquote bar and inline emphasis; muted /
 * faint for secondary prose; border for rules; surfaceMuted for code and
 * blockquote backgrounds. Every reading Text is `selectable` so a long-press
 * can copy it. Links are styled text only — nothing is opened or fetched.
 *
 * The 1.15x dynamic-type cap comes from the app-wide Text default in
 * app/_layout.tsx; this component adds no font sizes or families of its own.
 */
import { useMemo, type JSX, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { parseMarkdown, type Block, type InlineSpan, type ListItem } from '../../lib/markdown';

export function Markdown({ text }: { text: string | null | undefined }): JSX.Element | null {
  const { theme } = useTheme();
  const source = text ?? '';
  const blocks = useMemo(() => parseMarkdown(source), [source]);

  if (blocks.length === 0) return null;

  const c = theme.colors;
  const t = theme.typography;
  const sp = theme.spacing;

  const renderInline = (spans: InlineSpan[], keyPrefix: string): ReactNode[] =>
    spans.map((span, index) => {
      const key = `${keyPrefix}.${index}`;
      switch (span.kind) {
        case 'text':
          return <Text key={key}>{span.text}</Text>;
        case 'break':
          return <Text key={key}>{'\n'}</Text>;
        case 'code':
          return (
            <Text
              key={key}
              style={{
                backgroundColor: c.surfaceMuted,
                color: c.text,
                paddingHorizontal: sp.xs,
                borderRadius: theme.radius.sm,
              }}
            >
              {span.text}
            </Text>
          );
        case 'bold':
          return (
            <Text key={key} style={{ color: c.highlight, fontWeight: t.weight.bold }}>
              {renderInline(span.spans, key)}
            </Text>
          );
        case 'italic':
          return (
            <Text key={key} style={{ color: c.highlight, fontStyle: 'italic' }}>
              {renderInline(span.spans, key)}
            </Text>
          );
        case 'strike':
          return (
            <Text key={key} style={{ color: c.muted, textDecorationLine: 'line-through' }}>
              {renderInline(span.spans, key)}
            </Text>
          );
        case 'link':
          return (
            <Text key={key} style={{ color: c.accent, textDecorationLine: 'underline' }}>
              {renderInline(span.spans, key)}
            </Text>
          );
        default:
          return null;
      }
    });

  const headingSize = (level: 1 | 2 | 3 | 4): number =>
    level === 1
      ? t.size.section
      : level === 2
        ? t.size.card
        : level === 3
          ? t.size.row
          : t.size.body;

  const renderList = (ordered: boolean, items: ListItem[], keyPrefix: string): ReactNode => (
    <View style={{ gap: sp.xs }}>
      {items.map((item, index) => {
        const key = `${keyPrefix}.${index}`;
        return (
          <View key={key} style={[styles.listRow, { gap: sp.sm }]}>
            <Text
              style={{
                color: c.accent,
                fontSize: t.size.body,
                fontWeight: t.weight.semibold,
                minWidth: t.size.body,
              }}
            >
              {ordered ? `${index + 1}.` : '•'}
            </Text>
            <View style={{ flex: 1, minWidth: 0, gap: sp.xs }}>
              <Text selectable style={{ color: c.text, fontSize: t.size.body }}>
                {renderInline(item.spans, key)}
              </Text>
              {item.sublist ? renderList(item.sublist.ordered, item.sublist.items, `${key}.sub`) : null}
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderBlock = (block: Block, index: number): ReactNode => {
    const key = `block.${index}`;
    switch (block.kind) {
      case 'heading':
        return (
          <Text
            key={key}
            selectable
            style={{
              color: c.accent,
              fontSize: headingSize(block.level),
              fontWeight: block.level <= 2 ? t.weight.bold : t.weight.semibold,
              marginTop: index === 0 ? 0 : sp.sm,
            }}
          >
            {renderInline(block.spans, key)}
          </Text>
        );
      case 'paragraph':
        return (
          <Text key={key} selectable style={{ color: c.text, fontSize: t.size.body }}>
            {renderInline(block.spans, key)}
          </Text>
        );
      case 'list':
        return <View key={key}>{renderList(block.ordered, block.items, key)}</View>;
      case 'blockquote':
        return (
          <View
            key={key}
            style={[styles.blockquote, { backgroundColor: c.surfaceMuted, borderRadius: theme.radius.md }]}
          >
            <View style={{ width: sp.xs, backgroundColor: c.highlight }} />
            <Text
              selectable
              style={{
                flex: 1,
                color: c.muted,
                fontStyle: 'italic',
                fontSize: t.size.body,
                padding: sp.sm,
              }}
            >
              {renderInline(block.spans, key)}
            </Text>
          </View>
        );
      case 'code':
        return (
          <View key={key} style={{ backgroundColor: c.surfaceMuted, borderRadius: theme.radius.md, padding: sp.sm }}>
            <Text selectable style={{ color: c.text, fontSize: t.size.meta }}>
              {block.code}
            </Text>
          </View>
        );
      case 'rule':
        return <View key={key} style={{ height: 1, backgroundColor: c.border, marginVertical: sp.sm }} />;
      case 'table':
        return (
          <View
            key={key}
            style={{ borderWidth: 1, borderColor: c.border, borderRadius: theme.radius.md, overflow: 'hidden' }}
          >
            <View style={[styles.tableRow, { backgroundColor: c.surfaceMuted, padding: sp.sm, gap: sp.sm }]}>
              {block.header.map((cell, ci) => (
                <Text
                  key={`${key}.h${ci}`}
                  style={{ flex: 1, color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.semibold }}
                >
                  {renderInline(cell, `${key}.h${ci}`)}
                </Text>
              ))}
            </View>
            {block.rows.map((row, ri) => (
              <View
                key={`${key}.r${ri}`}
                style={[styles.tableRow, { padding: sp.sm, gap: sp.sm, borderTopWidth: 1, borderTopColor: c.border }]}
              >
                {row.map((cell, ci) => (
                  <Text
                    key={`${key}.r${ri}c${ci}`}
                    selectable
                    style={{ flex: 1, color: c.text, fontSize: t.size.body }}
                  >
                    {renderInline(cell, `${key}.r${ri}c${ci}`)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        );
      default:
        return null;
    }
  };

  return <View style={{ gap: sp.sm }}>{blocks.map(renderBlock)}</View>;
}

const styles = StyleSheet.create({
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  blockquote: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
  },
});
