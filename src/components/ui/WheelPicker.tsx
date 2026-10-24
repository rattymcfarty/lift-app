/**
 * WheelPicker — the iOS-style scroll drum, in plain React Native.
 *
 * The owner's ask: enter weights, reps and RPE by flicking a wheel — the value
 * sits in a highlighted band with its unit beside it — instead of the numeric
 * keyboard covering half the screen mid-workout.
 *
 * Why hand-rolled and not a library:
 * - No new dependency. The only picker package RN offers needs a native module,
 *   which would cost the Expo Go story (see `docs/ops/ENVIRONMENT.md`) and buy
 *   nothing here: snapping is `snapToInterval`, the fading rows are one
 *   `Animated` value shared by every row, and the highlight is a `View`.
 * - The pure maths (rows, snapping, looping, nearest-value) lives in
 *   `wheelModel.ts` and is unit-tested; this file is only the rendering.
 *
 * Looping: the drum is three copies of the rows and silently recentres on the
 * middle copy after every settle (`loopIndex`), so a user can keep flicking
 * forever and never hit an end — the "infinite" part of infinity scrolling.
 * The recentre is invisible: the row under the band is the same row.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import {
  Animated,
  FlatList,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { FONT_WEIGHT } from '../../theme/tokens';
import { LOOP_COPIES, itemAt, loopIndex, snapIndex, type WheelItem } from './wheelModel';

export interface WheelPickerProps {
  items: readonly WheelItem[];
  /** Selected row (0-based). */
  index: number;
  onChange: (index: number, item: WheelItem) => void;
  /** Unit shown in the band beside the value ("kg", "reps", "RPE"). */
  unit?: string;
  /** Row height in dp. */
  itemHeight?: number;
  /** Odd number of rows visible; the middle one is the selection. */
  visibleRows?: number;
  /** Endless drum. Default true. */
  loop?: boolean;
  testID?: string;
}

export function WheelPicker({
  items,
  index,
  onChange,
  unit,
  itemHeight = 40,
  visibleRows = 5,
  loop = true,
  testID,
}: WheelPickerProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const it = itemHeight;
  const height = it * visibleRows;
  const pad = (height - it) / 2;
  const count = items.length;
  const copies = loop ? LOOP_COPIES : 1;

  const data = useMemo(() => Array.from({ length: count * copies }, (_, i) => i), [count, copies]);
  const startIndex = loop ? loopIndex(index, count) : Math.min(Math.max(index, 0), Math.max(count - 1, 0));
  const listRef = useRef<FlatList<number>>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const offsetRef = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The logical (0..count-1) row under the band. */
  const [selected, setSelected] = useState(() => (count > 0 ? ((index % count) + count) % count : 0));
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // Keep the drum in step if the caller changes the value from outside (a typed
  // value, a swapped exercise's carry-over).
  useEffect(() => {
    if (count === 0) return;
    const logical = ((index % count) + count) % count;
    if (logical === selectedRef.current) return;
    setSelected(logical);
    const target = loop ? loopIndex(logical, count) : logical;
    listRef.current?.scrollToOffset({ offset: target * it, animated: false });
  }, [index, count, it, loop]);

  const settle = useCallback(
    (offsetY: number) => {
      if (count === 0) return;
      const landed = snapIndex(offsetY, it);
      let physical = landed;
      if (loop) {
        const target = loopIndex(landed, count);
        if (target !== landed) {
          physical = target;
          listRef.current?.scrollToOffset({ offset: target * it, animated: false });
        }
      }
      const logical = ((physical % count) + count) % count;
      if (logical === selectedRef.current) return;
      setSelected(logical);
      onChange(logical, items[logical]);
      void Haptics.selectionAsync().catch(() => undefined);
    },
    [count, it, loop, onChange, items],
  );

  // Live band value while the drum is still moving (cheap: a state write only
  // when the centred row actually changes).
  const trackBand = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      offsetRef.current = y;
      // JS-driven on purpose: `Animated.event` with useNativeDriver on a plain
      // FlatList throws ("components based on VirtualizedList must be wrapped
      // with Animated.createAnimatedComponent") and took the workout screen down
      // on device. A five-row drum does not need the UI thread.
      scrollY.setValue(y);
      if (count === 0) return;
      const logical = ((snapIndex(y, it) % count) + count) % count;
      if (logical !== selectedRef.current) {
        setSelected(logical);
        selectedRef.current = logical;
      }
    },
    [count, it, scrollY],
  );

  /**
   * A flick must keep its momentum: settling on `onScrollEndDrag` would call
   * `scrollToOffset` mid-fling and stop the drum dead. So the drag end only
   * arms a fallback timer (a slow release that never produces momentum still has
   * to commit its row), and `onMomentumScrollBegin` cancels it.
   */
  const armSettle = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => settle(offsetRef.current), 260);
  }, [settle]);
  const cancelSettle = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
  }, []);
  useEffect(() => cancelSettle, [cancelSettle]);

  const renderItem = useCallback(
    ({ item: physical }: { item: number }) => {
      const item = itemAt(items, physical);
      // Rows fade and shrink away from the band, driven on the UI thread.
      const inputRange = [(physical - 1) * it, physical * it, (physical + 1) * it];
      const opacity = scrollY.interpolate({
        inputRange,
        outputRange: [0.35, 1, 0.35],
        extrapolate: 'clamp',
      });
      const scale = scrollY.interpolate({
        inputRange,
        outputRange: [0.78, 1, 0.78],
        extrapolate: 'clamp',
      });
      return (
        <Animated.View
          style={[styles.row, { height: it, opacity, transform: [{ scale }] }]}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontSize: t.size.section,
              fontWeight: FONT_WEIGHT.semibold,
              fontVariant: ['tabular-nums'],
            }}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        </Animated.View>
      );
    },
    [items, it, scrollY, theme.colors.text, t.size.section],
  );

  return (
    <View style={{ height }} testID={testID}>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(n) => String(n)}
        renderItem={renderItem}
        getItemLayout={(_, i) => ({ length: it, offset: it * i, index: i })}
        initialScrollIndex={startIndex}
        contentContainerStyle={{ paddingTop: pad, paddingBottom: pad }}
        onScroll={trackBand}
        scrollEventThrottle={16}
        onMomentumScrollBegin={cancelSettle}
        onMomentumScrollEnd={(e) => {
          cancelSettle();
          settle(e.nativeEvent.contentOffset.y);
        }}
        onScrollEndDrag={armSettle}
        snapToInterval={it}
        snapToAlignment="start"
        decelerationRate="fast"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        bounces={false}
        initialNumToRender={visibleRows + 2}
        windowSize={5}
        style={{ flex: 1 }}
      />

      {/* The band paints OVER the drum (opaque), so the centred value and its
          unit read as one line — the iOS timer look. Touches pass through to the
          list below it. */}
      <View
        pointerEvents="none"
        style={[
          styles.band,
          {
            top: pad,
            height: it,
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
          },
        ]}
      >
        <Text
          testID={testID ? `${testID}-value` : undefined}
          style={{
            color: theme.colors.text,
            fontSize: t.size.section,
            fontWeight: FONT_WEIGHT.bold,
            fontVariant: ['tabular-nums'],
          }}
        >
          {count > 0 ? items[selected].label : ''}
        </Text>
        {unit ? (
          <Text
            testID={testID ? `${testID}-unit` : undefined}
            style={{ color: theme.colors.muted, fontSize: t.size.meta, fontWeight: FONT_WEIGHT.medium }}
          >
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
  },
});
