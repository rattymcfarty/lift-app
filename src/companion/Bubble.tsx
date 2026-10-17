/**
 * Companion speech bubble. Themed with surface / border / text tokens so it
 * reads in light and dark; fades and scales in on each new message. Up to two
 * lines at the app-wide capped text scale. `pointerEvents="none"` — the bubble
 * never steals touches from the screen underneath.
 */
import { useEffect, useRef, type JSX } from 'react';
import { Animated, Easing, Text, View, type LayoutChangeEvent } from 'react-native';
import { useTheme } from '../theme';

export interface BubbleProps {
  text: string;
  /** Which side of the creature the bubble sits on. */
  side: 'above' | 'below';
  /** Fixed box width in dp (the caller clamps it to the window). */
  width: number;
  reduceMotion?: boolean;
  /** Reports the measured height so the caller can place it above the creature. */
  onHeight?: (height: number) => void;
}

export function Bubble({ text, side, width, reduceMotion = false, onHeight }: BubbleProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    appear.setValue(0);
    Animated.timing(appear, {
      toValue: 1,
      duration: reduceMotion ? 140 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [text, appear, reduceMotion]);

  const tailSize = 12;
  const tailUp = side === 'below';
  const tailPosition = tailUp ? { top: -tailSize / 2 } : { bottom: -tailSize / 2 };

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={(e: LayoutChangeEvent) => onHeight?.(e.nativeEvent.layout.height)}
      style={{
        width,
        opacity: appear,
        // Reduce-motion: fade only, no scale.
        transform: reduceMotion ? undefined : [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: theme.radius.lg,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
      }}
    >
      {/* tail: a rotated, half-bordered square that reads as a little triangle */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          ...tailPosition,
          left: width / 2 - tailSize / 2,
          width: tailSize,
          height: tailSize,
          backgroundColor: theme.colors.surface,
          borderLeftWidth: tailUp ? 1 : 0,
          borderTopWidth: tailUp ? 1 : 0,
          borderRightWidth: tailUp ? 0 : 1,
          borderBottomWidth: tailUp ? 0 : 1,
          borderColor: theme.colors.border,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <Text
        numberOfLines={2}
        maxFontSizeMultiplier={1.15}
        style={{
          color: theme.colors.text,
          fontSize: t.size.body,
          fontWeight: t.weight.medium,
        }}
      >
        {text}
      </Text>
    </Animated.View>
  );
}
