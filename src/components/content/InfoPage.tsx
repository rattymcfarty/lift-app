/**
 * InfoPageView — renders one explainer page (`src/content/infoPages.ts`).
 *
 * One renderer for every block kind, so a new page is content only: no layout
 * decisions per page, and every explainer in the app looks the same. Blocks are
 * deliberately few (heading, paragraph, bullets, two-sided pair, titled example,
 * accent callout, quiet note) — that is enough for the questions the app raises
 * without becoming a wiki engine.
 */
import type { JSX } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { withAlpha } from '../../theme/color';
import { FONT_WEIGHT } from '../../theme/tokens';
import { ActionIcon } from '../icons';
import { useTabBarSpace } from '../nav/TabBar';
import { ScreenHeader } from '../workout/ui';
import type { InfoBlock, InfoPage } from '../../content/infoPages';

export interface InfoPageViewProps {
  page: InfoPage;
  onBack: () => void;
}

export function InfoPageView({ page, onBack }: InfoPageViewProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  const tabBarSpace = useTabBarSpace();

  const sentence = (text: string, color: string, muted = false): JSX.Element => (
    <Text style={{ color, fontSize: t.size.body, fontWeight: muted ? t.weight.medium : t.weight.regular }}>
      {text}
    </Text>
  );

  const card = (children: JSX.Element, extra?: object): JSX.Element => (
    <View
      style={[
        styles.card,
        { backgroundColor: c.surfaceMuted, borderColor: c.border, borderRadius: theme.radius.md, padding: theme.spacing.md, gap: theme.spacing.sm },
        extra,
      ]}
    >
      {children}
    </View>
  );

  const block = (b: InfoBlock, index: number): JSX.Element => {
    switch (b.kind) {
      case 'heading':
        return (
          <Text
            key={`h${index}`}
            style={{
              color: c.muted,
              fontSize: t.size.caption,
              fontWeight: FONT_WEIGHT.semibold,
              letterSpacing: 0.7,
              textTransform: 'uppercase',
              marginTop: theme.spacing.sm,
            }}
          >
            {b.text}
          </Text>
        );
      case 'paragraph':
        return <View key={`p${index}`}>{sentence(b.text, c.text)}</View>;
      case 'bullets':
        return (
          <View key={`b${index}`} style={{ gap: theme.spacing.sm }}>
            {b.items.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <View style={[styles.dot, { backgroundColor: c.accent }]} />
                <Text style={{ flex: 1, color: c.text, fontSize: t.size.body }}>{item}</Text>
              </View>
            ))}
          </View>
        );
      case 'pair':
        return (
          <View key={`pair${index}`} style={{ gap: theme.spacing.sm }}>
            {([b.left, b.right] as const).map((side) => (
              <View
                key={side.label}
                style={[
                  styles.card,
                  {
                    backgroundColor: c.surface,
                    borderColor: c.border,
                    borderRadius: theme.radius.md,
                    padding: theme.spacing.md,
                    gap: theme.spacing.xs,
                  },
                ]}
              >
                <Text style={{ color: c.accent, fontSize: t.size.row, fontWeight: FONT_WEIGHT.bold }}>
                  {side.label}
                </Text>
                <Text style={{ color: c.text, fontSize: t.size.meta }}>{side.text}</Text>
              </View>
            ))}
          </View>
        );
      case 'example':
        return (
          <View key={`ex${index}`}>
            {card(
              <View style={{ gap: theme.spacing.sm }}>
                <Text
                  style={{
                    color: c.muted,
                    fontSize: t.size.caption,
                    fontWeight: FONT_WEIGHT.semibold,
                    letterSpacing: 0.7,
                    textTransform: 'uppercase',
                  }}
                >
                  {b.title}
                </Text>
                {b.items.map((item) => (
                  <Text key={item} style={{ color: c.text, fontSize: t.size.body }}>
                    {item}
                  </Text>
                ))}
              </View>,
            )}
          </View>
        );
      case 'callout':
        return (
          <View key={`call${index}`}>
            {card(
              <View style={styles.calloutRow}>
                <ActionIcon name="info" color={c.accent} size={18} />
                <Text style={{ flex: 1, color: c.text, fontSize: t.size.body, fontWeight: t.weight.medium }}>
                  {b.text}
                </Text>
              </View>,
              { backgroundColor: withAlpha(c.accent, 0.1), borderColor: withAlpha(c.accent, 0.3) },
            )}
          </View>
        );
      case 'note':
        return <View key={`n${index}`}>{card(sentence(b.text, c.muted, true))}</View>;
    }
  };

  return (
    // SafeAreaView, like every other screen: the header reserves the top-bar band
    // itself, and without the safe-area inset the title and back arrow sat ON the
    // floating buttons (seen on the device).
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScreenHeader title={page.title} subtitle={page.subtitle} onBack={onBack} />
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.md,
          paddingBottom: theme.spacing.xl + tabBarSpace,
          gap: theme.spacing.md,
        }}
      >
        {page.blocks.map(block)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 8,
  },
  calloutRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
});
