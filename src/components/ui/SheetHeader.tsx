/**
 * SheetHeader — the grabber, title/subtitle and close button that every sheet
 * renders, so no two sheets drift apart. Presentation only: whoever wants a
 * draggable header passes `panHandlers` (see `useSheetDrag`).
 */
import type { JSX } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderHandlers,
} from 'react-native';
import { useTheme } from '../../theme';
import { ActionIcon } from '../icons';

export interface SheetHeaderProps {
  /** Sheet title; omitted for a bare grabber + close. */
  title?: string;
  subtitle?: string;
  onClose: () => void;
  /** testID of the close button (see `sheetIds`). */
  closeTestID: string;
  /** Drag handlers for the pull-down dismiss (header only). */
  panHandlers?: GestureResponderHandlers;
}

export function SheetHeader({
  title,
  subtitle,
  onClose,
  closeTestID,
  panHandlers,
}: SheetHeaderProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <View {...panHandlers}>
      <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />
      <View style={[styles.row, { paddingHorizontal: theme.spacing.md }]}>
        <View style={styles.text}>
          {title ? (
            <Text
              style={{ color: theme.colors.text, fontSize: t.size.card, fontWeight: t.weight.bold }}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={{ color: theme.colors.muted, fontSize: t.size.caption }} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Pressable
          testID={closeTestID}
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: theme.spacing.xs })}
        >
          <ActionIcon name="close" color={theme.colors.muted} size={t.size.icon} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  text: { flex: 1, minWidth: 0 },
});
