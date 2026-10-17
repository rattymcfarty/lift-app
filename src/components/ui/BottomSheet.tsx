/**
 * BottomSheet — the one shared sheet for the in-workout exercise menu and its
 * sub-sheets (actions, reorder, superset picker). Dimmed backdrop, smooth
 * slide-up spring, tap the backdrop or swipe the header down to dismiss,
 * safe-area padding, and a themed title (left) + close (right) header.
 *
 * Styling lives here so every exercise sheet looks and behaves the same.
 * Content scrolls; only the header claims the vertical drag, so lists inside
 * still scroll normally.
 */
import { useEffect, useMemo, useRef, type JSX, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { ActionIcon } from '../icons';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** testID on the sheet surface, for Maestro. */
  testID?: string;
  /** Cap the sheet height as a fraction of the screen (default 0.85). */
  maxHeightRatio?: number;
}

const OFFSCREEN = 900;

export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  testID,
  maxHeightRatio = 0.85,
}: BottomSheetProps): JSX.Element {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(OFFSCREEN)).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(OFFSCREEN);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 9,
        tension: 65,
      }).start();
    }
  }, [visible, translateY]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 8 && g.dy > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => {
          if (g.dy > 0) translateY.setValue(g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 90) {
            onClose();
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              friction: 9,
              tension: 65,
            }).start();
          }
        },
      }),
    [onClose, translateY],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu" />
        <Animated.View
          testID={testID}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderTopLeftRadius: theme.radius.lg,
              borderTopRightRadius: theme.radius.lg,
              paddingBottom: insets.bottom + theme.spacing.md,
              maxHeight: `${Math.round(maxHeightRatio * 100)}%`,
              transform: [{ translateY }],
            },
          ]}
        >
          <View {...pan.panHandlers}>
            <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />
            <View style={[styles.header, { paddingHorizontal: theme.spacing.md }]}>
              <View style={styles.headerText}>
                <Text
                  style={{ color: theme.colors.text, fontSize: theme.typography.size.card, fontWeight: theme.typography.weight.bold }}
                  numberOfLines={1}
                >
                  {title}
                </Text>
                {subtitle ? (
                  <Text
                    style={{ color: theme.colors.muted, fontSize: theme.typography.size.caption }}
                    numberOfLines={1}
                  >
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <Pressable
                testID={`${testID ?? 'sheet'}-close`}
                onPress={onClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: theme.spacing.xs })}
              >
                <ActionIcon name="close" color={theme.colors.muted} size={theme.typography.size.icon} />
              </Pressable>
            </View>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { borderTopWidth: 1, overflow: 'hidden' },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  headerText: { flex: 1, minWidth: 0 },
});
