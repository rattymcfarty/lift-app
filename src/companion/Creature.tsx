/**
 * Companion skin — a small, friendly blob creature drawn with
 * react-native-svg (no extra dependencies). The alternative to the mouse
 * picture (`ImageSkin`), chosen in Settings → Companion → Style.
 *
 * The body, ears, arms, cheeks and mouth are SVG; the eyes are two tiny
 * animated views layered on top so blinking is a native-driver `scaleY`
 * (SVG attributes can't run on the native driver). Theme colors only:
 * `accent` (purple) body, `highlight` (blue) accents, `accentText` eyes so
 * they stay readable on the purple body in both light and dark modes.
 *
 * Motion by mood (all transform/opacity → useNativeDriver):
 * - idle     gentle up/down float
 * - happy    small hop
 * - excited  faster bounce with squash
 * - sleepy   slow breathing, half-closed eyes
 * - focused  steady, narrowed eyes
 * Loops are skipped entirely under reduce-motion.
 */
import { useEffect, useRef, type JSX } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { useTheme } from '../theme';
import type { CompanionSkinProps } from './skin';

export function Creature({ mood, size, reduceMotion = false }: CompanionSkinProps): JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;

  const float = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;

  // Mood motion.
  useEffect(() => {
    float.setValue(0);
    hop.setValue(0);
    breathe.setValue(0);
    if (reduceMotion) return undefined;

    const anims: Animated.CompositeAnimation[] = [];
    if (mood === 'happy') {
      anims.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(hop, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(hop, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            Animated.delay(900),
          ]),
        ),
      );
    } else if (mood === 'excited') {
      anims.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(hop, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(hop, { toValue: 0, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          ]),
        ),
      );
    } else if (mood === 'sleepy') {
      anims.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(breathe, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(breathe, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
        ),
      );
    } else {
      // idle / focused: a calm float.
      anims.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(float, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(float, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
        ),
      );
    }
    for (const a of anims) a.start();
    return () => {
      for (const a of anims) a.stop();
    };
  }, [mood, reduceMotion, float, hop, breathe]);

  // Blink every few seconds (paused under reduce-motion).
  useEffect(() => {
    if (reduceMotion) {
      blink.setValue(1);
      return undefined;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = (): void => {
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.1, duration: 90, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished && !cancelled) timer = setTimeout(loop, 2200 + Math.random() * 2600);
      });
    };
    timer = setTimeout(loop, 1400 + Math.random() * 1800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [blink, reduceMotion]);

  const floatY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [size * 0.02, -size * 0.03],
  });
  const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.13] });
  const squashX = hop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const squashY = hop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] });
  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });

  const eyeW = size * 0.13;
  const eyeHeightFactor = mood === 'focused' ? 0.5 : mood === 'sleepy' ? 0.42 : 1;
  const eyeH = size * 0.15 * eyeHeightFactor;
  const eyeTop = (52 / 100) * size - eyeH / 2;
  const eyeLeftA = (40 / 100) * size - eyeW / 2;
  const eyeLeftB = (60 / 100) * size - eyeW / 2;

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ translateY: floatY }] }}>
      <Animated.View style={{ width: size, height: size, transform: [{ translateY: hopY }] }}>
        <Animated.View style={{ width: size, height: size, transform: [{ scaleX: squashX }, { scaleY: squashY }] }}>
          <Animated.View style={{ width: size, height: size, transform: [{ scale: breatheScale }] }}>
            <Svg width={size} height={size} viewBox="0 0 100 100">
              {/* ears */}
              <Ellipse cx={37} cy={24} rx={9} ry={11} fill={c.accent} />
              <Ellipse cx={63} cy={24} rx={9} ry={11} fill={c.accent} />
              {/* arms */}
              <Ellipse cx={18} cy={60} rx={8} ry={13} fill={c.accent} />
              <Ellipse cx={82} cy={60} rx={8} ry={13} fill={c.accent} />
              {/* body blob */}
              <Ellipse cx={50} cy={56} rx={32} ry={30} fill={c.accent} />
              {/* soft belly highlight */}
              <Ellipse cx={50} cy={65} rx={20} ry={15} fill={c.highlight} opacity={0.16} />
              {/* cheeks */}
              <Ellipse cx={33} cy={63} rx={7} ry={4.5} fill={c.highlight} opacity={0.4} />
              <Ellipse cx={67} cy={63} rx={7} ry={4.5} fill={c.highlight} opacity={0.4} />
              {/* mouth */}
              {mood === 'focused' ? (
                <Path d="M44 70 L56 70" stroke={c.accentText} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.7} />
              ) : (
                <Path d="M43 68 Q50 74 57 68" stroke={c.accentText} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.75} />
              )}
            </Svg>
            {/* eyes (animated separately so they can blink) */}
            <Animated.View
              style={{
                position: 'absolute',
                left: eyeLeftA,
                top: eyeTop,
                width: eyeW,
                height: eyeH,
                borderRadius: eyeW / 2,
                backgroundColor: c.accentText,
                transform: [{ scaleY: blink }],
              }}
            />
            <Animated.View
              style={{
                position: 'absolute',
                left: eyeLeftB,
                top: eyeTop,
                width: eyeW,
                height: eyeH,
                borderRadius: eyeW / 2,
                backgroundColor: c.accentText,
                transform: [{ scaleY: blink }],
              }}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}
