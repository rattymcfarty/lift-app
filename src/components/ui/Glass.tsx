/**
 * Glass primitives — platform-aware glass containers and buttons.
 *
 * - On iOS with Liquid Glass support (expo-glass-effect): GlassView with platform glass.
 * - On iOS without Liquid Glass: BlurView from expo-blur using a system material tint
 *   chosen from the app theme (dark/light).
 * - On Android: translucent surface (theme surface color at ~85% alpha) with a 1px
 *   hairline border from the border token.
 *
 * Content never depends on the blur for contrast: text/icons stay legible on the fallback.
 */
import type { JSX, ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, useColorScheme } from 'react-native';
import { useTheme } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

/** Shape of the glass container. */
export type GlassShape = 'pill' | 'circle' | number;

/** Glass container props. */
export interface GlassProps {
  /** Corner radius: 'pill' (fully rounded), 'circle' (square → circle), or a number (dp). */
  shape?: GlassShape;
  children: ReactNode;
  /** Additional style. */
  style?: JSX.Element['props']['style'];
  /** If true, the container becomes a Pressable (no default press visual). */
  interactive?: boolean;
  /** Optional onPress when interactive. */
  onPress?: () => void;
  /** Glass visual strength hint (platform-specific). */
  strength?: 'light' | 'regular' | 'heavy';
}

/** Glass button props. */
export interface GlassButtonProps {
  /** Icon element to display (e.g. from src/components/icons). */
  icon: ReactNode;
  /** Accessibility label. */
  accessibilityLabel: string;
  /** Press handler. */
  onPress: () => void;
  /** Additional style. */
  style?: JSX.Element['props']['style'];
  /** Test ID for Maestro. */
  testID?: string;
  /** Whether the button is disabled. */
  disabled?: boolean;
}

/**
 * Platform-aware glass surface.
 *
 * iOS (Liquid Glass available): <GlassView> from expo-glass-effect.
 * iOS (no Liquid Glass): <BlurView> from expo-blur with theme-appropriate tint.
 * Android: themed translucent surface + hairline border.
 */
export function Glass({
  shape = 'pill',
  children,
  style,
  interactive = false,
  onPress,
  strength = 'regular',
}: GlassProps): JSX.Element {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();

  // Resolve border radius from shape
  let borderRadius: number;
  if (shape === 'pill') borderRadius = theme.radius.pill;
  else if (shape === 'circle') borderRadius = theme.radius.pill; // square aspect enforced by size
  else borderRadius = shape;

  // Platform-specific glass implementation
  if (Platform.OS === 'ios') {
    // Dynamic import to avoid bundling GlassView on Android
    const { GlassView, isLiquidGlassAvailable } = require('expo-glass-effect');
    if (isLiquidGlassAvailable()) {
      return (
        <GlassView
          style={[
            styles.glassBase,
            { borderRadius },
            style,
          ]}
          cornerRadius={borderRadius}
          intensity={strength === 'heavy' ? 1 : strength === 'light' ? 0.3 : 0.6}
        >
          {children}
        </GlassView>
      );
    }
    // Fallback: BlurView with theme-appropriate material
    const { BlurView } = require('expo-blur');
    const tint = colorScheme === 'dark' ? 'dark' : 'light';
    return (
      <BlurView
        intensity={strength === 'heavy' ? 100 : strength === 'light' ? 20 : 50}
        tint={tint}
        style={[
          styles.glassBase,
          { borderRadius },
          style,
        ]}
      >
        {children}
      </BlurView>
    );
  }

  // Android: translucent surface + hairline border.
  //
  // The alpha follows `strength`: "heavy" is used by every overlay that sits ON
  // content the user must read through it (the bottom sheets, the side panels,
  // the text prompt). At 85% the workout behind a wheel drum stayed legible and
  // the numbers fought it (seen on the device 2026-10-25, when the wheel became
  // the default way to enter a weight). 96% keeps a hint of glass and a readable
  // sheet; light stays translucent for floating chrome.
  const surfaceColor = theme.colors.surface;
  const borderColor = theme.colors.border;
  const alpha = strength === 'heavy' ? 'F5' : strength === 'light' ? 'CC' : 'D9';
  const backgroundColor = `${surfaceColor}${alpha}`;

  const content = (
    <View
      style={[
        styles.glassBase,
        { borderRadius, backgroundColor, borderWidth: 1, borderColor },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (interactive && onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [
          content.props.style,
          pressed && { opacity: 0.7 },
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return content;
}

/**
 * 44dp circular glass button with centered icon, haptic selection on press,
 * and pressed-state scale.
 */
export function GlassButton({
  icon,
  accessibilityLabel,
  onPress,
  style,
  testID,
  disabled = false,
}: GlassButtonProps): JSX.Element {
  const { theme } = useTheme();

  const handlePress = () => {
    if (!disabled) {
      Haptics.selectionAsync();
      onPress();
    }
  };

  return (
    <Glass
      shape="circle"
      style={[
        styles.button,
        { width: 44, height: 44 },
        style,
      ]}
      interactive
      onPress={handlePress}
    >
      <Pressable
        testID={testID}
        onPress={handlePress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        hitSlop={8}
        style={({ pressed }) => [
          styles.buttonContent,
          pressed && !disabled && { transform: [{ scale: 0.92 }] },
          disabled && { opacity: 0.5 },
        ]}
      >
        <View style={{ alignItems: 'center', justifyContent: 'center', width: 44, height: 44 }}>
          {icon}
        </View>
      </Pressable>
    </Glass>
  );
}

const styles = StyleSheet.create({
  glassBase: {
    // Base styles shared by all platforms
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    // Pressable content
  },
});