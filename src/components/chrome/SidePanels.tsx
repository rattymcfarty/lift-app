/**
 * SidePanels — hosts both side panels over the whole app.
 *
 * Mounted once in `app/_layout.tsx`, after the TopBar, so an open panel covers
 * the bar, the tabs and the screen behind them. It reads the open side from
 * `PanelsProvider`, slides the matching panel in from its edge, and puts a
 * tappable scrim over everything else.
 *
 * Closing is TAP ONLY: scrim, the panel's close button, any item tap (the
 * panels close themselves before navigating) or Android back. There is no
 * swipe or drag-to-close. The panel body is glass; the scrim is a plain dim.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Glass } from '../ui/Glass';
import { usePanels } from '../../chrome/panels';
import type { OpenPanelSide } from '../../chrome/panelsModel';
import { LeftPanel } from './LeftPanel';
import { RightPanel } from './RightPanel';

/** Widest a panel may get on a phone; a fraction of the window below that. */
const PANEL_MAX_WIDTH = 360;
const PANEL_WIDTH_RATIO = 0.86;

const OPEN_MS = 240;
const CLOSE_MS = 180;

export function SidePanels(): JSX.Element | null {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { current, closePanel } = usePanels();
  const { width } = useWindowDimensions();

  // `side` stays set through the closing animation, then clears so the panel
  // unmounts (and stops taking touches) once it is off screen.
  const [side, setSide] = useState<OpenPanelSide | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (current) {
      setSide(current);
      Animated.timing(progress, {
        toValue: 1,
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: CLOSE_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setSide(null);
    });
  }, [current, progress]);

  // Android back closes the panel instead of leaving the screen.
  useEffect(() => {
    if (!current) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closePanel();
      return true;
    });
    return () => sub.remove();
  }, [current, closePanel]);

  if (!side) return null;

  const leftSide = side === 'left';
  const panelWidth = Math.min(Math.round(width * PANEL_WIDTH_RATIO), PANEL_MAX_WIDTH);
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [leftSide ? -panelWidth : panelWidth, 0],
  });
  const scrimOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] });

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim, { opacity: scrimOpacity }]} />
      <Pressable
        testID="panel-scrim"
        accessibilityRole="button"
        accessibilityLabel="Close panel"
        onPress={current ? closePanel : undefined}
        pointerEvents={current ? 'auto' : 'none'}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[
          styles.panel,
          leftSide ? styles.left : styles.right,
          {
            width: panelWidth,
            transform: [{ translateX }],
            // Opaque base under the glass, like every sheet: the Android glass is
            // translucent and the page behind was legible through the menu.
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <Glass
          shape={theme.radius.lg}
          strength="heavy"
          style={[
            styles.glass,
            leftSide
              ? { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }
              : { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
          ]}
        >
          <View style={{ flex: 1, paddingTop: insets.top }}>{leftSide ? <LeftPanel /> : <RightPanel />}</View>
        </Glass>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 300,
  },
  scrim: {
    backgroundColor: '#000',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    // Depth so the panel reads as floating above the dimmed screen.
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
  },
  left: {
    left: 0,
  },
  right: {
    right: 0,
  },
  glass: {
    flex: 1,
  },
});
