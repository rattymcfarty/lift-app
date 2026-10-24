/**
 * RpeSheet — "What is RPE?", opened from the RPE column header in a set table.
 *
 * RPE is the only number in the logging flow a beginner cannot infer from its
 * label, and it is optional in every plan, so the app explains it where it is
 * asked for instead of hiding it in a settings page.
 *
 * Two voices, one body:
 *  - companion on  → Pip sits at the top and says the one-line summary in its
 *    own voice, then the same scale/example copy follows.
 *  - companion off → a neutral "1–10 effort" badge and a plain summary, so the
 *    sheet never depends on the companion being enabled.
 *
 * The scale runs 6–10: 1–5 never applies to a working set.
 */
import type { JSX } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  COMPANION_NAME,
  Creature,
  ImageSkin,
  useCompanionEnabled,
  useCompanionStyle,
} from '../../companion';
import { useTheme } from '../../theme';
import { withAlpha } from '../../theme/color';
import { FONT_WEIGHT } from '../../theme/tokens';
import { ActionIcon } from '../icons';
import { BottomSheet } from '../ui/BottomSheet';
import {
  RPE_EXAMPLE,
  RPE_INTRO_COMPANION,
  RPE_INTRO_SOLO,
  RPE_LEFT_LABEL,
  RPE_LEVELS,
  RPE_TARGET,
  RPE_TITLE,
  RPE_WHY,
} from './rpeGuide';

export interface RpeSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** Avatar diameter in the sheet. */
const AVATAR = 64;
/** Diameter of the top-bar ring the companion art is framed for. */
const RING = 48;

export function RpeSheet({ visible, onClose }: RpeSheetProps): JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  const t = theme.typography;
  const companionOn = useCompanionEnabled();
  const skinStyle = useCompanionStyle();

  // Same composition as the top-bar ring (Companion.tsx): the mouse art is
  // drawn larger than the circle and shifted so the face fills it. Scaled to
  // the avatar here, the head and shoulders read at 64 dp.
  const k = AVATAR / RING;
  const frame =
    skinStyle === 'mouse'
      ? { size: 64 * k, left: -7 * k, top: -2 * k }
      : { size: AVATAR, left: 0, top: 0 };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="RPE"
      subtitle={RPE_TITLE}
      testID="rpe-sheet"
      maxHeightRatio={0.9}
    >
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.content}>
        {/* Intro: Pip, or a plain scale badge when the companion is off. */}
        <View style={styles.introRow}>
          {companionOn ? (
            <View
              accessible
              accessibilityLabel={`${COMPANION_NAME}, your companion`}
              style={[styles.avatar, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}
            >
              <View
                style={{
                  position: 'absolute',
                  width: frame.size,
                  height: frame.size,
                  left: frame.left,
                  top: frame.top,
                }}
              >
                {skinStyle === 'mouse' ? (
                  <ImageSkin mood="idle" size={frame.size} />
                ) : (
                  <Creature mood="idle" size={frame.size} />
                )}
              </View>
            </View>
          ) : (
            <View
              accessible
              accessibilityLabel="RPE runs from 1 to 10"
              style={[
                styles.avatar,
                styles.badge,
                {
                  backgroundColor: withAlpha(c.accent, 0.14),
                  borderColor: withAlpha(c.accent, 0.32),
                },
              ]}
            >
              <Text style={{ color: c.accent, fontSize: t.size.section, fontWeight: t.weight.bold }}>
                1–10
              </Text>
              <Text style={{ color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>
                effort
              </Text>
            </View>
          )}

          <View
            style={[styles.quote, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}
          >
            <Text
              style={{
                color: c.muted,
                fontSize: t.size.caption,
                fontWeight: t.weight.semibold,
                letterSpacing: 0.7,
              }}
            >
              {companionOn ? `${COMPANION_NAME.toUpperCase()} SAYS` : 'IN SHORT'}
            </Text>
            <Text style={{ color: c.text, fontSize: t.size.body, fontWeight: t.weight.medium }}>
              {companionOn ? RPE_INTRO_COMPANION : RPE_INTRO_SOLO}
            </Text>
          </View>
        </View>

        {/* The scale */}
        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ gap: 2 }}>
            <Text style={[styles.sectionLabel, { color: c.muted, fontSize: t.size.caption }]}>
              What the numbers mean
            </Text>
            <Text style={{ color: c.muted, fontSize: t.size.meta }}>
              {RPE_LEFT_LABEL} you could still do with good form.
            </Text>
          </View>

          <View
            style={[
              styles.scale,
              { backgroundColor: c.surface, borderColor: c.border, borderRadius: theme.radius.md },
            ]}
          >
            {RPE_LEVELS.map((row, index) => (
              <View
                key={row.level}
                testID={`rpe-level-${row.level}`}
                style={[
                  styles.levelRow,
                  {
                    borderTopColor: c.border,
                    borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                    // RPE 8 is the worked example below; tint it so the link is
                    // visible without another label.
                    backgroundColor:
                      row.level === 8 ? withAlpha(c.accent, 0.08) : 'transparent',
                  },
                ]}
              >
                <Text
                  style={{
                    width: 24,
                    color: c.accent,
                    fontSize: t.size.row,
                    fontWeight: t.weight.bold,
                  }}
                >
                  {row.level}
                </Text>
                <Text style={{ flex: 1, color: c.text, fontSize: t.size.body }} numberOfLines={1}>
                  {row.feel}
                </Text>
                <Text style={{ color: c.muted, fontSize: t.size.meta }} numberOfLines={1}>
                  {row.left}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Worked example */}
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={[styles.sectionLabel, { color: c.muted, fontSize: t.size.caption }]}>
            Example
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: c.surfaceMuted, borderColor: c.border, borderRadius: theme.radius.md },
            ]}
          >
            <Text style={{ color: c.text, fontSize: t.size.body, fontWeight: t.weight.semibold }}>
              {RPE_EXAMPLE.lift}
            </Text>
            <Text style={{ color: c.accent, fontSize: t.size.meta, fontWeight: t.weight.medium }}>
              {RPE_EXAMPLE.prescription}
            </Text>
            <Text style={{ color: c.text, fontSize: t.size.meta }}>{RPE_EXAMPLE.body}</Text>
            <Text style={{ color: c.muted, fontSize: t.size.caption }}>{RPE_EXAMPLE.note}</Text>
          </View>
        </View>

        {/* Why it earns a field */}
        <View style={{ gap: theme.spacing.sm }}>
          <Text style={[styles.sectionLabel, { color: c.muted, fontSize: t.size.caption }]}>
            Why it helps
          </Text>
          {RPE_WHY.map((line) => (
            <View key={line} style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: c.accent,
                  marginTop: 8,
                }}
              />
              <Text style={{ flex: 1, color: c.text, fontSize: t.size.meta }}>{line}</Text>
            </View>
          ))}
        </View>

        {/* The practical target */}
        <View
          style={[
            styles.card,
            styles.target,
            {
              backgroundColor: withAlpha(c.accent, 0.1),
              borderColor: withAlpha(c.accent, 0.3),
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <ActionIcon name="info" color={c.accent} size={18} />
          <Text style={{ flex: 1, color: c.text, fontSize: t.size.meta }}>{RPE_TARGET}</Text>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  introRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    gap: 1,
  },
  quote: {
    flex: 1,
    gap: 4,
    padding: 12,
    borderWidth: 1,
    borderRadius: 16,
  },
  sectionLabel: {
    fontWeight: FONT_WEIGHT.semibold,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  scale: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  card: {
    gap: 4,
    padding: 12,
    borderWidth: 1,
  },
  target: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
});
