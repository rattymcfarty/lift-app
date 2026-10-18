/**
 * TabOrderList — the left panel's "Tabs" section.
 *
 * The four sections are listed in their current bar order and can be reordered
 * by LONG-PRESSING a row and dragging it. The gesture maths lives in the pure
 * `src/chrome/panelsModel.ts` (unit tested); this file only turns it into
 * touches. Reordering is committed on release through `src/nav/tabOrder.ts`,
 * which persists it and realigns the floating bar.
 *
 * No swipe: a plain tap jumps to the section; a long-press arms the drag.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';
import { ActionIcon } from '../icons';
import { TabIcon, type TabIconName } from '../nav/TabIcons';
import { tabByKey } from '../../nav/tabs';
import { moveTab, setTabOrder, type TabKey } from '../../nav/tabOrder';
import { dragTargetIndex, shiftForIndex } from '../../chrome/panelsModel';

/** Fixed row height — the drag maths counts whole rows. */
export const TAB_ROW_HEIGHT = 54;

interface DragState {
  from: number;
  dy: number;
  to: number;
}

export interface TabOrderListProps {
  /** Current tab order from the store. */
  order: ReadonlyArray<TabKey>;
  /** The section on screen now, highlighted. */
  activeKey?: TabKey;
  /** Tapped a row (not dragged): jump to that section. */
  onSelect: (key: TabKey) => void;
  /**
   * Fired when a drag starts (true) and ends (false). The host turns scrolling
   * off while it is true, so the enclosing ScrollView cannot steal the gesture.
   */
  onDragChange?: (dragging: boolean) => void;
}

export function TabOrderList({ order, activeKey, onSelect, onDragChange }: TabOrderListProps): JSX.Element {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  const begin = (from: number): void => {
    setDrag({ from, dy: 0, to: from });
    onDragChange?.(true);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const move = (dy: number): void => {
    setDrag((current) =>
      current ? { ...current, dy, to: dragTargetIndex(current.from, dy, TAB_ROW_HEIGHT, order.length) } : current,
    );
  };

  const end = (): void => {
    const state = dragRef.current;
    setDrag(null);
    onDragChange?.(false);
    if (!state) return;
    const key = order[state.from];
    if (!key || state.to === state.from) return;
    // Persist on release; the store notifies the floating bar and this list.
    void setTabOrder(moveTab(order, key, state.to)).then(() => Haptics.selectionAsync().catch(() => undefined));
  };

  return (
    <View>
      {order.map((key, index) => {
        const tab = tabByKey(key);
        if (!tab) return null;
        const dragging = drag?.from === index;
        const offset = drag ? (dragging ? drag.dy : shiftForIndex(index, drag.from, drag.to) * TAB_ROW_HEIGHT) : 0;
        return (
          <TabRow
            key={key}
            tabKey={key}
            label={tab.title}
            icon={tab.icon}
            active={activeKey === key}
            dragging={dragging}
            offset={offset}
            onArm={() => begin(index)}
            onMove={move}
            onEnd={end}
            onSelect={() => onSelect(key)}
          />
        );
      })}
    </View>
  );
}

interface TabRowProps {
  tabKey: TabKey;
  label: string;
  icon: TabIconName;
  active: boolean;
  dragging: boolean;
  /** Vertical offset in dp while a drag is in progress. */
  offset: number;
  onArm: () => void;
  onMove: (dy: number) => void;
  onEnd: () => void;
  onSelect: () => void;
}

function TabRow({
  tabKey,
  label,
  icon,
  active,
  dragging,
  offset,
  onArm,
  onMove,
  onEnd,
  onSelect,
}: TabRowProps): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;

  // Set by the long-press; read by the responder, which only takes over once
  // the row is armed, so a plain drag still scrolls the panel.
  const armed = useRef(false);
  useEffect(() => {
    armed.current = dragging;
  }, [dragging]);

  // True from the moment the responder takes the gesture until it is released.
  // It lets `onPressOut` tell "long-press then drag" from "long-press then let
  // go" (which must cancel the arming, or the panel scroll would stay frozen).
  const grabbed = useRef(false);

  // Latest callbacks without recreating the responder mid-gesture.
  const handlers = useRef({ onMove, onEnd });
  handlers.current = { onMove, onEnd };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: () => {
        if (!armed.current) return false;
        // Claimed before the Pressable is terminated, so its onPressOut below
        // sees the gesture as a drag and does not cancel it.
        grabbed.current = true;
        return true;
      },
      onPanResponderMove: (_event, gesture) => handlers.current.onMove(gesture.dy),
      onPanResponderRelease: () => {
        armed.current = false;
        grabbed.current = false;
        handlers.current.onEnd();
      },
      onPanResponderTerminate: () => {
        armed.current = false;
        grabbed.current = false;
        handlers.current.onEnd();
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  return (
    <View
      {...responder.panHandlers}
      style={{
        height: TAB_ROW_HEIGHT,
        zIndex: dragging ? 20 : 1,
        transform: [{ translateY: offset }, { scale: dragging ? 1.02 : 1 }],
      }}
    >
      <Pressable
        testID={`panel-tab-${tabKey}`}
        onPress={onSelect}
        onLongPress={onArm}
        onPressOut={() => {
          // Released while armed but before any move: cancel the drag so the
          // panel does not stay frozen mid-air.
          if (!grabbed.current) onEnd();
        }}
        delayLongPress={220}
        accessibilityRole="button"
        accessibilityLabel={`${label}${active ? ', current section' : ''}`}
        accessibilityHint="Tap to open. Long-press and drag to reorder."
        style={({ pressed }) => ({
          flex: 1,
          marginVertical: 3,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.md,
          borderWidth: dragging ? 1 : 0,
          borderColor: dragging ? c.highlight : 'transparent',
          backgroundColor: dragging ? c.surfaceMuted : 'transparent',
          opacity: pressed && !dragging ? 0.6 : 1,
        })}
      >
        <TabIcon name={icon} color={active ? c.accent : c.muted} size={22} />
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            color: active ? c.accent : c.text,
            fontSize: t.size.body,
            fontWeight: active ? t.weight.semibold : t.weight.medium,
          }}
        >
          {label}
        </Text>
        <ActionIcon name="grip" color={c.faint} size={18} />
      </Pressable>
    </View>
  );
}
