/**
 * useSheetDrag — the pull-down-to-close gesture every sheet shares.
 *
 * The handlers go on the sheet header only, so lists inside the sheet keep
 * scrolling normally. The maths (when to claim the gesture, when a release
 * dismisses) lives in `sheetModel.ts` and is unit-tested.
 */
import { useMemo } from 'react';
import { Animated, PanResponder, type GestureResponderHandlers } from 'react-native';
import { dragDismisses, shouldStartDrag } from './sheetModel';

/** Spring a sheet's translateY back to rest (or to its open position). */
export function sheetSpring(translateY: Animated.Value, toValue: number): void {
  Animated.spring(translateY, {
    toValue,
    useNativeDriver: true,
    friction: 9,
    tension: 65,
  }).start();
}

export function useSheetDrag(
  translateY: Animated.Value,
  onClose: () => void,
): GestureResponderHandlers {
  return useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => shouldStartDrag(g.dx, g.dy),
        onPanResponderMove: (_e, g) => {
          if (g.dy > 0) translateY.setValue(g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          if (dragDismisses(g.dy)) onClose();
          else sheetSpring(translateY, 0);
        },
      }).panHandlers,
    [onClose, translateY],
  );
}
