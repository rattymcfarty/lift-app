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
        // Claim the touch at touch-down, not on the first move.
        //
        // On Android the move-phase negotiation never reaches a view inside a
        // Modal: measured on the emulator, the header receives the raw touches
        // and the down-phase negotiation, but `onMoveShouldSetResponder` and
        // its capture variant are never dispatched, which leaves a move-only
        // pull-down dead. Claiming at down makes the header the responder, so
        // the drag arrives as `onResponderMove`. Touches a child handles stay
        // with the child (the responder system offers a touch to the deepest
        // view first), so the header close button keeps working.
        onStartShouldSetPanResponder: () => true,
        // Still needed: with the header already the responder this only runs
        // when a child claimed the touch and handed the move back.
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
