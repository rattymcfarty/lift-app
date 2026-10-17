/**
 * Floating companion overlay — mounted ONCE in `app/_layout.tsx`, above the
 * Stack and tabs. It renders the current queue message in a speech bubble and
 * the character itself (whichever skin Settings has chosen — the mouse picture
 * by default, the SVG creature as an alternative), which the user can drag
 * anywhere and tap for a reaction.
 *
 * Layout & touches
 * - The root is `absoluteFill` with `pointerEvents="box-none"`, so it never
 *   blocks the screen underneath; only the creature (the drag/tap target) and
 *   the bubble's own measured box are interactive.
 * - Safe-area aware. Default position: top-centre, just below the status bar.
 * - Dragging snaps to the nearest edge/corner; the corner is remembered in
 *   AsyncStorage under a plain local key (deliberately NOT in the backup
 *   whitelist in `src/data/appData.ts` — a UI position is not user data).
 * - Tap = a jump + a wiggle, and dismiss the visible message.
 *
 * Accessibility: the creature is a button with a label; new messages are
 * announced; all looping motion is skipped under reduce-motion (a tap then only
 * dismisses the bubble).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COMPANION_NAME } from './messages';
import { companionQueue } from './queue';
import { useCompanionMessage } from './useCompanion';
import { loadCompanionEnabled, useCompanionEnabled } from './enabled';
import { loadCompanionStyle, useCompanionStyle } from './style';
import { Creature } from './Creature';
import { ImageSkin, MOUSE_HOP_OVERSHOOT } from './ImageSkin';
import { Bubble } from './Bubble';

/** On-screen size of the creature (dp) — shared by every skin, and the box the
 *  speech bubble is placed around. The mouse picture is drawn this wide. */
const SIZE = 80;
/** Plain local key — intentionally outside the backup whitelist. */
const POS_KEY = 'lift:companion-pos';
const EDGE_MARGIN = 12;
/** Rough bottom-tab-bar height, so a snapped creature never covers the tabs. */
const TAB_BAR_CLEARANCE = 56;
const BUBBLE_MAX_WIDTH = 260;
const BUBBLE_GAP = 8;

type Corner = 'tc' | 'tl' | 'tr' | 'bl' | 'br';
const CORNERS: readonly Corner[] = ['tc', 'tl', 'tr', 'bl', 'br'];

interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

function cornerPosition(corner: Corner, b: Bounds): { x: number; y: number } {
  const centerX = (b.left + b.right) / 2;
  switch (corner) {
    case 'tl':
      return { x: b.left, y: b.top };
    case 'tr':
      return { x: b.right, y: b.top };
    case 'bl':
      return { x: b.left, y: b.bottom };
    case 'br':
      return { x: b.right, y: b.bottom };
    case 'tc':
    default:
      return { x: centerX, y: b.top };
  }
}

function nearestCorner(x: number, y: number, b: Bounds): Corner {
  const targets: Array<[Corner, { x: number; y: number }]> = CORNERS.map((c) => [c, cornerPosition(c, b)]);
  let best: Corner = 'tc';
  let bestDist = Number.POSITIVE_INFINITY;
  for (const [corner, pos] of targets) {
    const d = (pos.x - x) ** 2 + (pos.y - y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = corner;
    }
  }
  return best;
}

export function Companion(): JSX.Element | null {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const enabled = useCompanionEnabled();
  const skinStyle = useCompanionStyle();

  const [corner, setCorner] = useState<Corner>('tc');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [bubbleHeight, setBubbleHeight] = useState(56);
  const [storedLoaded, setStoredLoaded] = useState(false);

  const message = useCompanionMessage();
  const mood = message?.mood ?? 'idle';

  const pan = useRef(new Animated.ValueXY()).current;
  const react = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const draggedRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, y: 0 });
  const boundsRef = useRef<Bounds>({ left: 0, right: 0, top: 0, bottom: 0 });
  const reduceMotionRef = useRef(false);
  const onTapRef = useRef<() => void>(() => undefined);

  /** The mouse skin draws outside its box as it hops, so its top bound needs
   *  headroom; the SVG creature stays inside. */
  const topOvershoot = skinStyle === 'mouse' ? SIZE * MOUSE_HOP_OVERSHOOT : 0;

  const bounds = useMemo<Bounds>(() => {
    const left = EDGE_MARGIN;
    const right = Math.max(left, width - SIZE - EDGE_MARGIN);
    const top = insets.top + 8 + topOvershoot;
    const bottom = Math.max(top, height - SIZE - (insets.bottom + TAB_BAR_CLEARANCE) - EDGE_MARGIN);
    return { left, right, top, bottom };
  }, [width, height, insets.top, insets.bottom, topOvershoot]);
  boundsRef.current = bounds;

  const pos = useMemo(() => cornerPosition(corner, bounds), [corner, bounds]);

  const handleTap = useCallback((): void => {
    companionQueue.dismiss();
    if (reduceMotionRef.current) return;
    // A quick jump + a wiggle, on top of whatever the skin is already doing.
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
  onTapRef.current = handleTap;

  // Create the responder once; all mutable inputs are read through refs.
  const responderRef = useRef<ReturnType<typeof PanResponder.create> | null>(null);
  if (responderRef.current == null) {
    responderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
      onPanResponderGrant: () => {
        draggedRef.current = false;
        startRef.current = posRef.current;
      },
      onPanResponderMove: (_e, g) => {
        if (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4) draggedRef.current = true;
        const b = boundsRef.current;
        pan.setValue({
          x: clamp(startRef.current.x + g.dx, b.left, b.right),
          y: clamp(startRef.current.y + g.dy, b.top, b.bottom),
        });
      },
      onPanResponderRelease: (_e, g) => {
        if (!draggedRef.current) {
          onTapRef.current();
          return;
        }
        const b = boundsRef.current;
        const x = clamp(startRef.current.x + g.dx, b.left, b.right);
        const y = clamp(startRef.current.y + g.dy, b.top, b.bottom);
        const nextCorner = nearestCorner(x, y, b);
        const target = cornerPosition(nextCorner, b);
        setCorner(nextCorner);
        const persist = (): void => {
          void AsyncStorage.setItem(POS_KEY, JSON.stringify({ corner: nextCorner })).catch(() => undefined);
        };
        if (reduceMotionRef.current) {
          pan.setValue(target);
          persist();
          return;
        }
        Animated.spring(pan, { toValue: target, useNativeDriver: true, friction: 7, tension: 60 }).start(persist);
      },
    });
  }
  const responder = responderRef.current;

  // Keep the animated position in step with the derived one.
  useEffect(() => {
    posRef.current = pos;
    pan.setValue(pos);
  }, [pos, pan]);

  // Load the persisted corner, the on/off setting and the chosen skin once.
  useEffect(() => {
    void loadCompanionEnabled();
    void loadCompanionStyle();
    let cancelled = false;
    void AsyncStorage.getItem(POS_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          const parsed = JSON.parse(raw) as { corner?: Corner };
          if (parsed.corner && CORNERS.includes(parsed.corner)) setCorner(parsed.corner);
        } catch {
          // Corrupt value — keep the default position.
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setStoredLoaded(true);
      });
    return () => {
      cancelled = true;
    };
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

  const bubbleWidth = Math.min(BUBBLE_MAX_WIDTH, Math.max(160, width - EDGE_MARGIN * 2));
  const bubbleLeft = clamp(pos.x + SIZE / 2 - bubbleWidth / 2, EDGE_MARGIN, Math.max(EDGE_MARGIN, width - bubbleWidth - EDGE_MARGIN));
  const bubbleBelow = pos.y < (bounds.top + bounds.bottom) / 2;
  const bubbleTop = bubbleBelow ? pos.y + SIZE + BUBBLE_GAP : pos.y - BUBBLE_GAP - bubbleHeight;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {message ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: bubbleLeft, top: bubbleTop, width: bubbleWidth }}
        >
          <Bubble
            text={message.text}
            side={bubbleBelow ? 'below' : 'above'}
            width={bubbleWidth}
            reduceMotion={reduceMotion}
            onHeight={setBubbleHeight}
          />
        </View>
      ) : null}

      <Animated.View
        {...responder.panHandlers}
        testID="companion"
        accessible
        accessibilityRole="button"
        accessibilityLabel={COMPANION_NAME}
        accessibilityHint="Tap for a reaction. Drag to move."
        onAccessibilityTap={handleTap}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: SIZE,
          height: SIZE,
          // Hide until the stored corner has been read, so it doesn't jump.
          opacity: storedLoaded ? 1 : 0,
          transform: pan.getTranslateTransform(),
        }}
      >
        <Animated.View
          style={{
            width: SIZE,
            height: SIZE,
            transform: [
              { translateY: react.interpolate({ inputRange: [0, 1], outputRange: [0, -SIZE * 0.13] }) },
              { rotate: wiggle.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-6deg', '0deg', '6deg'] }) },
              { scale: react.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
            ],
          }}
        >
          {skinStyle === 'mouse' ? (
            <ImageSkin mood={mood} size={SIZE} reduceMotion={reduceMotion} />
          ) : (
            <Creature mood={mood} size={SIZE} reduceMotion={reduceMotion} />
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}
