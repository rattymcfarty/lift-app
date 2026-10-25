/**
 * ExerciseInfoSheet — "about this exercise", mid-workout, without leaving it.
 *
 * The exercise title in a workout card opens this (owner request 2026-10-24). It
 * answers the three things that actually matter between sets, in this order:
 *
 *   1. what the movement trains (muscles, equipment);
 *   2. the key cues — a reminder, capped at four;
 *   3. when to stop (the KB safety line) — the one piece that should never be
 *      more than a tap away;
 *   4. your plan's target and what you lifted last time.
 *
 * Anything the KB entry does not carry is simply absent (see `exerciseInfo.ts`),
 * and the whole guide is one button away for the long version. When the companion
 * is on it says the one-liner, exactly like the RPE sheet; with it off the sheet
 * opens on the muscles line instead.
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
import { Button } from './ui';
import type { ExerciseInfo } from './exerciseInfo';

export interface ExerciseInfoSheetProps {
  visible: boolean;
  onClose: () => void;
  info: ExerciseInfo;
  /** Opens the full guide (the existing `/exercises/<id>` screen). */
  onOpenGuide: () => void;
  testID?: string;
}

const AVATAR = 48;
const RING = 48;

export function ExerciseInfoSheet({
  visible,
  onClose,
  info,
  onOpenGuide,
  testID = 'exercise-info-sheet',
}: ExerciseInfoSheetProps): JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  const t = theme.typography;
  const companionOn = useCompanionEnabled();
  const skinStyle = useCompanionStyle();
  const k = AVATAR / RING;
  const frame =
    skinStyle === 'mouse'
      ? { size: 64 * k, left: -7 * k, top: -2 * k }
      : { size: AVATAR, left: 0, top: 0 };

  const line = (label: string, value: string): JSX.Element => (
    <View style={{ gap: 2 }}>
      <Text style={{ color: c.muted, fontSize: t.size.caption, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 0.6, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text style={{ color: c.text, fontSize: t.size.body }}>{value}</Text>
    </View>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title={info.name} subtitle="About this exercise" testID={testID} maxHeightRatio={0.85}>
      {/* Fixed height content: no ScrollView around it would be right here anyway
          (the sheet caps at 0.85 and the sections are short), but it does scroll
          for a long safety note on a small screen. */}
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
        {companionOn ? (
          <View style={styles.introRow}>
            <View
              accessible
              accessibilityLabel={`${COMPANION_NAME}, your companion`}
              style={[styles.avatar, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}
            >
              <View style={{ position: 'absolute', width: frame.size, height: frame.size, left: frame.left, top: frame.top }}>
                {skinStyle === 'mouse' ? (
                  <ImageSkin mood="idle" size={frame.size} />
                ) : (
                  <Creature mood="idle" size={frame.size} />
                )}
              </View>
            </View>
            <Text style={{ flex: 1, color: c.text, fontSize: t.size.body, fontWeight: t.weight.medium }}>
              {info.cues.length > 0
                ? `Keep it simple: ${info.cues.length === 1 ? 'one cue' : `${info.cues.length} cues`}${info.safety ? ', and you stop if it hurts' : ''}.`
                : 'Here is what matters between sets.'}
            </Text>
          </View>
        ) : null}

        {info.meta.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {info.meta.map((m) => (
              <View
                key={m}
                style={[styles.chip, { backgroundColor: c.surfaceMuted, borderColor: c.border, borderRadius: theme.radius.pill }]}
              >
                <Text style={{ color: c.text, fontSize: t.size.meta }}>{m}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {info.cues.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text style={{ color: c.muted, fontSize: t.size.caption, fontWeight: FONT_WEIGHT.semibold, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Key cues
            </Text>
            {info.cues.map((cue, i) => (
              <View key={cue} style={styles.cueRow}>
                <Text style={{ color: c.accent, fontSize: t.size.body, fontWeight: FONT_WEIGHT.bold }}>{i + 1}</Text>
                <Text style={{ flex: 1, color: c.text, fontSize: t.size.body }}>{cue}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {info.mistakes.length > 0 ? line('Watch out for', info.mistakes.join(' · ')) : null}

        {info.safety ? (
          <View
            style={[
              styles.safety,
              {
                backgroundColor: withAlpha(c.warning, 0.12),
                borderColor: withAlpha(c.warning, 0.35),
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <ActionIcon name="info" color={c.warning} size={18} />
            <Text style={{ flex: 1, color: c.text, fontSize: t.size.meta }}>{info.safety}</Text>
          </View>
        ) : null}

        {info.target ? line('Your plan', info.target) : null}
        {info.lastTime ? line('Last time', info.lastTime) : null}
        {info.why ? line('Why it matters', info.why) : null}

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              title="Open full guide"
              variant="secondary"
              testID={`${testID}-guide`}
              onPress={() => {
                onClose();
                onOpenGuide();
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Done" testID={`${testID}-done`} onPress={onClose} />
          </View>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  introRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  cueRow: {
    flexDirection: 'row',
    gap: 10,
  },
  safety: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderWidth: 1,
  },
});
