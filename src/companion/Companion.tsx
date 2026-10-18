/**
 * Companion — Pip, the app's little companion.
 *
 * Since stage A2 of the layout redesign the creature is no longer a
 * free-floating, draggable overlay: it sits FIXED in the centre of the TopBar,
 * inside a ~48 dp circular glass ring (`src/components/ui/Glass.tsx`). The
 * artwork is drawn larger than the ring and clipped to the circle
 * (`overflow: hidden` + `borderRadius`), framed so the face and upper body fill
 * it. The skin still floats / breathes / blinks / hops / sparkles, and every
 * motion is clipped inside the ring.
 *
 * The speech bubble is centred BELOW the ring (just below the top bar) with a
 * small tail pointing up at the creature; it is at most ~80 % of the window
 * wide. Tapping the circle plays the jump + wiggle reaction and dismisses the
 * visible message — the bubble itself stays `pointerEvents="none"` so it never
 * steals touches from the screen underneath.
 *
 * The TopBar renders this inside its centre slot; the root layout no longer
 * mounts it separately. It is never drawn on the onboarding wizard or the
 * PAR-Q+ questionnaire (the TopBar checks `isCompanionHiddenRoute`). Settings
 * still chooses the skin (Mouse / Blob) and can hide Pip entirely.
 *
 * Accessibility: the ring is a button with a label; new messages are
 * announced; all looping motion is skipped under reduce-motion (a tap then
 * only dismisses the bubble).
 */
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { COMPANION_NAME } from './messages';
import { companionQueue } from './queue';
import { useCompanionMessage } from './useCompanion';
import { loadCompanionEnabled, useCompanionEnabled } from './enabled';
import { loadCompanionStyle, useCompanionStyle } from './style';
import { Creature } from './Creature';
import { ImageSkin } from './ImageSkin';
import { Bubble } from './Bubble';
import { Glass } from '../components/ui/Glass';

/** Diameter of the glass ring the creature lives in (dp). */
const CIRCLE = 48;
/** Gap between the bottom of the ring and the top of the speech bubble. */
const BUBBLE_GAP = 6;
/** The bubble spans at most this fraction of the window width. */
const BUBBLE_W_FRACTION = 0.8;
/** Upper / lower bounds for the bubble width on very wide or very narrow screens. */
const BUBBLE_MAX_WIDTH = 340;
const BUBBLE_MIN_WIDTH = 160;

/** How a skin is drawn inside the ring. */
interface SkinFrame {
  /** Box the skin is laid out in (dp). */
  size: number;
  /** Horizontal offset of that box inside the ring. */
  left: number;
  /** Vertical offset of that box inside the ring. */
  top: number;
}

/**
 * Mouse: draw the 512×492 PNG at 64 dp and shift it up and slightly left so the
 * face (which sits in the upper half of the art) and the upper body fill the
 * ring; the rest is clipped by the circle.
 */
const MOUSE_FRAME: SkinFrame = { size: 64, left: -7, top: -2 };
/** Blob: the SVG creature is already centred in its box, so it fits as drawn. */
const BLOB_FRAME: SkinFrame = { size: CIRCLE, left: 0, top: 0 };

export function Companion(): JSX.Element | null {
  const { width } = useWindowDimensions();
  const enabled = useCompanionEnabled();
  const skinStyle = useCompanionStyle();
  const [reduceMotion, setReduceMotion] = useState(false);

  const message = useCompanionMessage();
  const mood = message?.mood ?? 'idle';

  const react = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const reduceMotionRef = useRef(false);

  const handleTap = useCallback((): void => {
    companionQueue.dismiss();
    if (reduceMotionRef.current) return;
    // A quick jump + a wiggle, clipped inside the ring.
    react.setValue(0);
    wiggle.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(react, { toValue: 1, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(react, { toValue: 0, duration: 190, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(wiggle, { toValue: 1, duration: 90, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: -1, duration: 180, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 0, duration: 120, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ]).start();
  }, [react, wiggle]);

  // Load the on/off setting and the chosen skin once.
  useEffect(() => {
    void loadCompanionEnabled();
    void loadCompanionStyle();
  }, []);

  // Reduce-motion preference (reacts to the OS setting).
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (!alive) return;
        setReduceMotion(value);
        reduceMotionRef.current = value;
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      setReduceMotion(value);
      reduceMotionRef.current = value;
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // Expire the visible message while the app is running.
  const messageId = message?.id ?? null;
  useEffect(() => {
    if (!messageId) return undefined;
    const timer = setInterval(() => companionQueue.tick(), 400);
    return () => clearInterval(timer);
  }, [messageId]);

  // Announce new messages to screen readers.
  const announcedId = useRef<string | null>(null);
  useEffect(() => {
    if (!message || announcedId.current === message.id) return;
    announcedId.current = message.id;
    AccessibilityInfo.announceForAccessibility(message.text);
  }, [message]);

  if (!enabled) return null;

  const frame = skinStyle === 'mouse' ? MOUSE_FRAME : BLOB_FRAME;
  const bubbleWidth = Math.max(
    BUBBLE_MIN_WIDTH,
    Math.min(BUBBLE_MAX_WIDTH, width * BUBBLE_W_FRACTION),
  );
  // The ring is centred in the window, so centring the bubble on the ring
  // centres it on the window.
  const bubbleLeft = (CIRCLE - bubbleWidth) / 2;

  const reactY = react.interpolate({ inputRange: [0, 1], outputRange: [0, -CIRCLE * 0.16] });
  const wiggleDeg = wiggle.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-6deg', '0deg', '6deg'] });
  const reactScale = react.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

  return (
    <View style={styles.root}>
      <Glass shape="circle" style={styles.ring}>
        <Pressable
          testID="companion"
          onPress={handleTap}
          accessibilityRole="button"
          accessibilityLabel={COMPANION_NAME}
          accessibilityHint="Tap for a reaction."
          hitSlop={8}
          style={styles.press}
        >
          {/* The clip: everything the skin draws is cut to the circle. */}
          <View style={styles.clip}>
            <Animated.View
              style={[
                styles.skin,
                {
                  width: frame.size,
                  height: frame.size,
                  left: frame.left,
                  top: frame.top,
                  transform: [{ translateY: reactY }, { rotate: wiggleDeg }, { scale: reactScale }],
                },
              ]}
            >
              {skinStyle === 'mouse' ? (
                <ImageSkin mood={mood} size={frame.size} reduceMotion={reduceMotion} />
              ) : (
                <Creature mood={mood} size={frame.size} reduceMotion={reduceMotion} />
              )}
            </Animated.View>
          </View>
        </Pressable>
      </Glass>

      {message ? (
        <View
          pointerEvents="none"
          style={[styles.bubble, { left: bubbleLeft, width: bubbleWidth }]}
        >
          <Bubble text={message.text} side="below" width={bubbleWidth} reduceMotion={reduceMotion} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: CIRCLE,
    height: CIRCLE,
  },
  ring: {
    width: CIRCLE,
    height: CIRCLE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  press: {
    width: CIRCLE,
    height: CIRCLE,
  },
  clip: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    overflow: 'hidden',
  },
  skin: {
    position: 'absolute',
  },
  bubble: {
    position: 'absolute',
    top: CIRCLE + BUBBLE_GAP,
  },
});
