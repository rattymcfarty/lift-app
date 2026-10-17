/**
 * Image skin — the owner's cartoon mouse artwork ("Pip") as a single flat
 * 512×492 PNG with a transparent background. Because a still picture cannot be
 * redrawn per frame, every motion here is a transform (or an opacity) on the
 * built-in `Animated` API with `useNativeDriver`: the animations run on the UI
 * thread, with no new dependency and no cost while nothing is moving.
 *
 * Motion by mood
 * - idle     gentle float + slow breathing (scaleY 1.00→1.03, opposite scaleX)
 * - happy    a small hop that squashes on landing
 * - excited  a faster double bounce plus a ±6° wiggle
 * - sleepy   slower, deeper breathing, a slight droop, opacity 0.9 and a small
 *            "z" glyph drifting up in the muted text colour
 * - focused  steady, a slight forward lean
 * Every mood blinks now and then (a very quick squash + tiny head tilt) and a
 * cheer/PR mood emits 3–5 sparkle stars that float up and fade.
 *
 * Origin tricks: scaling is anchored at the feet by translating by
 * `height × (1 − scale) / 2` in a layer *outside* the scale, and rotation is
 * anchored at the feet by nesting `translateY(+h/2) → rotate → translateY(−h/2)`.
 * A soft theme-aware ground shadow sits under the feet; it shrinks while the
 * character is airborne.
 *
 * Reduce-motion: no loops and no hops — the mood's static pose (dim, lean or
 * droop) and fade-only sparkles remain.
 */
import { useEffect, useRef, type JSX, type ReactElement } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { COMPANION_NAME } from './messages';
import type { CompanionMood } from './queue';
import type { CompanionSkinProps } from './skin';

const MOUSE = require('../../assets/companion/mouse.png');

/** Artwork aspect ratio (492 / 512) — the drawn width is `size`. */
const IMAGE_ASPECT = 492 / 512;
/**
 * Room the hop and float need above the box, as a fraction of `size`. The
 * character is drawn overflowing upwards, so the overlay adds this to the
 * top drag bound to keep it clear of the screen edge.
 */
export const MOUSE_HOP_OVERSHOOT = 0.18;

/** Ground shadow size, as a fraction of `size`. */
const SHADOW_HEIGHT = 0.08;
const SHADOW_WIDTH = 0.8;
/** How far the feet sit above the bottom of the box, as a fraction of `size`. */
const GROUND_LIFT = 0.02;
/** One sparkle, as a fraction of `size`. */
const SPARKLE_SIZE = 0.16;
const MAX_SPARKLES = 5;

/** How many sparkles a mood emits (0 = none). cheer → 3, PR → 5. */
const SPARKLE_COUNT: Record<CompanionMood, number> = {
  idle: 0,
  focused: 0,
  happy: 3,
  excited: 5,
  sleepy: 0,
};

/** Sparkle spots, as fractions of `size` from the top-left of the box. */
const SPARKLE_SPOTS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0.64, y: 0.12 },
  { x: 0.1, y: 0.32 },
  { x: 0.88, y: 0.42 },
  { x: 0.34, y: 0.02 },
  { x: 0.0, y: 0.64 },
];

/** Four-point sparkle, in a 24×24 viewBox. */
const SPARKLE_PATH = 'M12 0.5 L14.4 9.6 L23.5 12 L14.4 14.4 L12 23.5 L9.6 14.4 L0.5 12 L9.6 9.6 Z';

/** Breathing half-period per mood (ms). */
const BREATHE_MS: Record<CompanionMood, number> = {
  idle: 2400,
  focused: 2800,
  happy: 1900,
  excited: 1500,
  sleepy: 3400,
};

/** Static mood pose (degrees): a slight forward lean, or a droop. */
const MOOD_TILT: Record<CompanionMood, number> = {
  idle: 0,
  focused: 3,
  happy: 0,
  excited: 0,
  sleepy: -6,
};

/** One Animated.View per layer (outermost first), so no two transforms share a
 *  view and their order can never surprise us. */
function nest(layers: ReadonlyArray<StyleProp<ViewStyle>>, child: ReactElement): ReactElement {
  return layers.reduceRight(
    (acc, style) => <Animated.View style={[styles.layer, style]}>{acc}</Animated.View>,
    child,
  );
}

const styles = StyleSheet.create({
  layer: { width: '100%', height: '100%' },
});

export function ImageSkin({ mood, size, reduceMotion = false }: CompanionSkinProps): JSX.Element {
  const { theme } = useTheme();
  const c = theme.colors;
  const t = theme.typography;

  const float = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const land = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const z = useRef(new Animated.Value(0)).current;
  const sparkleRef = useRef<Animated.Value[] | null>(null);
  if (sparkleRef.current === null) {
    sparkleRef.current = Array.from({ length: MAX_SPARKLES }, () => new Animated.Value(0));
  }
  const sparkles = sparkleRef.current;

  const imageH = size * IMAGE_ASPECT;
  const shadowH = size * SHADOW_HEIGHT;
  const shadowW = size * SHADOW_WIDTH;
  /** Rotation pivot: the bottom-centre of the box, the character's feet. */
  const pivot = imageH / 2;

  // Mood motion. Breathing always runs; the vertical motion depends on mood.
  useEffect(() => {
    float.setValue(0);
    hop.setValue(0);
    land.setValue(0);
    breathe.setValue(0);
    wiggle.setValue(0);
    if (reduceMotion) return undefined;

    const anims: Animated.CompositeAnimation[] = [];
    const loop = (a: Animated.CompositeAnimation): void => {
      anims.push(Animated.loop(a));
    };
    const sway = (value: Animated.Value, duration: number): Animated.CompositeAnimation =>
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]);

    loop(sway(breathe, BREATHE_MS[mood]));

    if (mood === 'happy') {
      // A small hop, then a quick squash as it lands.
      loop(
        Animated.sequence([
          Animated.timing(hop, { toValue: 1, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(hop, { toValue: 0, duration: 290, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(land, { toValue: 1, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(land, { toValue: 0, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.delay(750),
        ]),
      );
    } else if (mood === 'excited') {
      // Double bounce + wiggle: the PR celebration.
      loop(
        Animated.sequence([
          Animated.timing(hop, { toValue: 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(hop, { toValue: 0, duration: 170, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(hop, { toValue: 1, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(hop, { toValue: 0, duration: 150, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(land, { toValue: 1, duration: 70, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(land, { toValue: 0, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.delay(280),
        ]),
      );
      loop(
        Animated.sequence([
          Animated.timing(wiggle, { toValue: 1, duration: 220, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(wiggle, { toValue: -1, duration: 440, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(wiggle, { toValue: 0, duration: 220, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
    } else {
      // idle / focused / sleepy: a calm float (sleepy's is slower and deeper).
      loop(sway(float, mood === 'sleepy' ? 3400 : 2200));
    }

    for (const a of anims) a.start();
    return () => {
      for (const a of anims) a.stop();
    };
  }, [mood, reduceMotion, float, hop, land, breathe, wiggle]);

  // Blink every few seconds: a very quick squash + a tiny head tilt.
  useEffect(() => {
    if (reduceMotion) {
      blink.setValue(0);
      return undefined;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = (): void => {
      Animated.sequence([
        Animated.timing(blink, { toValue: 1, duration: 70, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(blink, { toValue: 0, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished && !cancelled) timer = setTimeout(loop, 3000 + Math.random() * 3000);
      });
    };
    timer = setTimeout(loop, 2200 + Math.random() * 2200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [blink, reduceMotion]);

  // Sparkles: one burst per cheer/PR mood (excited gets a slow second wind).
  useEffect(() => {
    for (const v of sparkles) v.setValue(0);
    const count = reduceMotion ? Math.min(SPARKLE_COUNT[mood], 3) : SPARKLE_COUNT[mood];
    if (count === 0) return undefined;
    const anims: Animated.CompositeAnimation[] = [];
    for (let i = 0; i < count; i += 1) {
      const burst = Animated.sequence([
        Animated.delay(i * 130),
        Animated.timing(sparkles[i], {
          toValue: 1,
          duration: reduceMotion ? 700 : 950,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
      anims.push(reduceMotion ? burst : Animated.loop(Animated.sequence([burst, Animated.delay(1600)])));
    }
    for (const a of anims) a.start();
    return () => {
      for (const a of anims) a.stop();
    };
  }, [mood, reduceMotion, sparkles]);

  // Sleepy: a small "z" drifts up and fades, again and again.
  useEffect(() => {
    z.setValue(0);
    if (reduceMotion || mood !== 'sleepy') return undefined;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(z, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(600),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [mood, reduceMotion, z]);

  // Feet-anchored scaling: translate by height × (1 − scale) / 2 outside the
  // scale, so the character grows and squashes from the ground up.
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.035] });
  const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -size * (mood === 'excited' ? 0.16 : 0.13)] });
  const landY = land.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] });
  const landX = land.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const landAnchor = land.interpolate({ inputRange: [0, 1], outputRange: [0, imageH * 0.035] });
  const breatheTop = mood === 'sleepy' ? 1.045 : 1.03;
  const breatheSide = mood === 'sleepy' ? 0.975 : 0.985;
  const breatheY = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, breatheTop] });
  const breatheX = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, breatheSide] });
  const breatheAnchor = breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -(imageH * (breatheTop - 1)) / 2] });
  const blinkY = blink.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] });
  const blinkAnchor = blink.interpolate({ inputRange: [0, 1], outputRange: [0, imageH * 0.03] });
  const blinkDeg = blink.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-2.5deg'] });
  const wiggleDeg = wiggle.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-6deg', '0deg', '6deg'] });
  const leanDeg = `${MOOD_TILT[mood]}deg`;

  // The shadow shrinks and fades while the character is off the ground.
  const shadowScaleX = hop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] });
  const shadowOpacity = hop.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });
  const zOpacity = z.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.9, 0.9, 0] });
  const zY = z.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.3] });

  const character = nest(
    [
      { transform: [{ translateY: floatY }] },
      { transform: [{ translateY: hopY }] },
      { transform: [{ translateY: landAnchor }] },
      { transform: [{ scaleX: landX }, { scaleY: landY }] },
      { transform: [{ translateY: breatheAnchor }] },
      { transform: [{ scaleX: breatheX }, { scaleY: breatheY }] },
      { transform: [{ translateY: blinkAnchor }] },
      { transform: [{ scaleY: blinkY }] },
      // Rotate about the feet: +pivot, the rotations, then −pivot.
      { transform: [{ translateY: pivot }] },
      { transform: [{ rotate: leanDeg }, { rotate: blinkDeg }, { rotate: wiggleDeg }] },
      { transform: [{ translateY: -pivot }] },
    ],
    // The overlay wrapper owns the accessible name (it is the button the user
    // taps and drags), so the picture itself is not a second focus stop.
    <Image
      source={MOUSE}
      resizeMode="contain"
      accessible={false}
      accessibilityLabel={COMPANION_NAME}
      style={styles.layer}
    />,
  );

  const sparkleCount = SPARKLE_COUNT[mood];

  return (
    <View style={{ width: size, height: size }}>
      {/* Soft ground shadow — stays on the ground while the character hops. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: (size - shadowW) / 2,
          bottom: 0,
          width: shadowW,
          height: shadowH,
          opacity: shadowOpacity,
          transform: [{ scaleX: shadowScaleX }],
        }}
      >
        <Svg width={shadowW} height={shadowH} viewBox={`0 0 ${shadowW} ${shadowH}`}>
          <Ellipse cx={shadowW / 2} cy={shadowH / 2} rx={shadowW / 2} ry={shadowH / 2} fill={c.text} opacity={0.18} />
        </Svg>
      </Animated.View>

      {/* The character, feet on the ground line, overflowing upwards as it moves. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          bottom: size * GROUND_LIFT,
          width: size,
          height: imageH,
          opacity: mood === 'sleepy' ? 0.9 : 1,
        }}
      >
        {character}
      </View>

      {/* Sleepy: a drifting "z". */}
      {mood === 'sleepy' ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: size * 0.68,
            top: size * 0.04,
            opacity: reduceMotion ? 0.55 : zOpacity,
            transform: reduceMotion ? undefined : [{ translateY: zY }],
          }}
        >
          <Text
            maxFontSizeMultiplier={1.15}
            style={{ color: c.muted, fontSize: t.size.caption, fontWeight: t.weight.bold }}
          >
            z
          </Text>
        </Animated.View>
      ) : null}

      {/* Cheer / PR sparkles. */}
      {sparkleCount > 0
        ? SPARKLE_SPOTS.slice(0, sparkleCount).map((spot, i) => (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: spot.x * size,
                top: spot.y * size,
                width: size * SPARKLE_SIZE,
                height: size * SPARKLE_SIZE,
                opacity: sparkles[i].interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 0] }),
                transform: [
                  { translateY: sparkles[i].interpolate({ inputRange: [0, 1], outputRange: [0, reduceMotion ? 0 : -size * 0.4] }) },
                  { scale: sparkles[i].interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
                ],
              }}
            >
              <Svg width={size * SPARKLE_SIZE} height={size * SPARKLE_SIZE} viewBox="0 0 24 24">
                <Path d={SPARKLE_PATH} fill={i % 2 === 0 ? c.accent : c.highlight} />
              </Svg>
            </Animated.View>
          ))
        : null}
    </View>
  );
}
