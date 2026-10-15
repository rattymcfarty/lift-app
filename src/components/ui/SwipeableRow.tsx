/**
 * SwipeableRow — swipe LEFT to remove, swipe RIGHT to add.
 *
 * Pure React Native (Animated + PanResponder), so it needs no native module
 * and works in Expo Go. The row follows the finger over a red "Delete"
 * backdrop; releasing past ~35% of the width (or with a fast flick) commits
 * the delete, anything less springs back. Swiping RIGHT runs `onSwipeRight`
 * (an "add" — new set, new exercise, duplicate) over a gold backdrop and the
 * row springs back. A direction with no handler resists like a rubber band.
 * With `confirm` the destructive step asks first (and the row springs back if
 * cancelled).
 *
 * Gesture arbitration: a horizontal-dominant drag claims the touch, vertical
 * drags still scroll the list. Interactive children (buttons, inputs) keep
 * working because the pan only claims after real horizontal movement.
 */
import { useCallback, useMemo, useRef, useState, type JSX, type ReactNode } from 'react';
import { Alert, Animated, PanResponder, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';

export interface SwipeableRowProps {
  children: ReactNode;
  /** Swipe LEFT. Omit to make the row non-deletable. */
  onDelete?: () => void | Promise<void>;
  /** Swipe RIGHT: an "add" action (the row stays in place). */
  onSwipeRight?: () => void;
  /** Backdrop text for the add action, e.g. "+ Add set". */
  rightLabel?: string;
  /** Ask before deleting. Cancelling springs the row back. */
  confirm?: { title: string; message?: string; confirmLabel?: string };
  /** Opaque background of the row so the red backdrop only shows while dragging. */
  backgroundColor?: string;
  borderRadius?: number;
  enabled?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const COMMIT_FRACTION = 0.35;

export function SwipeableRow({
  children,
  onDelete,
  confirm,
  backgroundColor,
  borderRadius = 0,
  enabled = true,
  label = 'Delete',
  rightLabel = '+ Add',
  onSwipeRight,
  style,
  testID,
}: SwipeableRowProps): JSX.Element {
  const { theme } = useTheme();
  const x = useRef(new Animated.Value(0)).current;
  const widthRef = useRef(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const busyRef = useRef(false);

  const springBack = useCallback(() => {
    Animated.spring(x, { toValue: 0, useNativeDriver: true, friction: 8, tension: 120 }).start();
  }, [x]);

  const commit = useCallback(
    (sign: 1 | -1) => {
      if (busyRef.current) return;
      if (sign === 1) {
        // "Add": confirm with a haptic, run it, and settle the row back.
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        springBack();
        onSwipeRight?.();
        return;
      }
      if (!onDelete) {
        springBack();
        return;
      }
      const finish = (): void => {
        busyRef.current = true;
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
        Animated.timing(x, {
          toValue: sign * (widthRef.current + 40),
          duration: 180,
          useNativeDriver: true,
        }).start(async () => {
          try {
            await onDelete();
          } finally {
            // If the list keeps this row mounted (delete failed / filtered),
            // bring it back rather than leaving an invisible row.
            busyRef.current = false;
            x.setValue(0);
          }
        });
      };
      if (confirm) {
        Alert.alert(confirm.title, confirm.message, [
          { text: 'Cancel', style: 'cancel', onPress: springBack },
          { text: confirm.confirmLabel ?? 'Delete', style: 'destructive', onPress: finish },
        ], { onDismiss: springBack });
      } else {
        finish();
      }
    },
    [confirm, onDelete, onSwipeRight, springBack, x],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          enabled && Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          x.stopAnimation();
        },
        onPanResponderMove: (_, g) => {
          const sign = g.dx >= 0 ? 1 : -1;
          setDir(sign);
          const allowed = sign === 1 ? !!onSwipeRight : !!onDelete;
          // No action in that direction: resist instead of following.
          x.setValue(allowed ? g.dx : g.dx * 0.18);
        },
        onPanResponderRelease: (_, g) => {
          const sign = g.dx >= 0 ? 1 : -1;
          const allowed = sign === 1 ? !!onSwipeRight : !!onDelete;
          const far = Math.abs(g.dx) > widthRef.current * COMMIT_FRACTION;
          const flick = Math.abs(g.vx) > 0.9 && Math.abs(g.dx) > 48;
          if (allowed && (far || flick)) commit(sign);
          else springBack();
        },
        onPanResponderTerminate: springBack,
      }),
    [commit, enabled, onDelete, onSwipeRight, springBack, x],
  );

  const onLayout = (e: LayoutChangeEvent): void => {
    widthRef.current = e.nativeEvent.layout.width;
  };

  const revealed = x.interpolate({ inputRange: [-120, -12, 0, 12, 120], outputRange: [1, 0.2, 0, 0.2, 1], extrapolate: 'clamp' });

  return (
    <View
      testID={testID}
      onLayout={onLayout}
      style={[{ overflow: 'hidden', borderRadius }, style]}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: dir === 1 ? theme.colors.accent : theme.colors.danger,
          opacity: revealed,
          justifyContent: 'center',
          alignItems: dir === 1 ? 'flex-start' : 'flex-end',
          paddingHorizontal: theme.spacing.md,
        }}
      >
        <Text
          style={{
            color: dir === 1 ? theme.colors.accentText : '#ffffff',
            fontSize: theme.typography.size.meta + 1,
            fontWeight: theme.typography.weight.bold,
          }}
          maxFontSizeMultiplier={1.1}
        >
          {dir === 1 ? rightLabel : label}
        </Text>
      </Animated.View>
      <Animated.View
        {...pan.panHandlers}
        style={{
          transform: [{ translateX: x }],
          backgroundColor: backgroundColor ?? theme.colors.background,
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}
