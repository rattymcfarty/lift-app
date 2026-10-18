/**
 * BottomSheet — the one shared sheet for the in-workout exercise menu, its
 * sub-sheets (actions, reorder, superset picker, warm-up, finish, muscles,
 * rest timer, plate calculator) and the app's option pickers.
 *
 * Liquid glass surface (`Glass`, heavy) with rounded top corners and square
 * bottom corners, a dimmed backdrop, a smooth slide-up spring, safe-area
 * padding, and the shared `SheetHeader` (grabber, title, close). Closing is
 * tap-the-backdrop, the header close, a pull down on the header, or Android
 * back. Styling lives here so every sheet looks and behaves the same. Content
 * scrolls; only the header claims the vertical drag.
 */
import { useEffect, useRef, type JSX, type ReactNode } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Glass } from './Glass';
import { SheetHeader } from './SheetHeader';
import { sheetCorners, sheetIds } from './sheetModel';
import { sheetSpring, useSheetDrag } from './useSheetDrag';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Sheet title; omit for a bare grabber + close. */
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** testID on the sheet surface, for Maestro (the close is `<testID>-close`). */
  testID?: string;
  /** Cap the sheet height as a fraction of the screen (default 0.85). */
  maxHeightRatio?: number;
}

const OFFSCREEN = 900;

export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  testID,
  maxHeightRatio = 0.85,
}: BottomSheetProps): JSX.Element {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(OFFSCREEN)).current;
  const ids = sheetIds(testID);

  useEffect(() => {
    if (visible) {
      translateY.setValue(OFFSCREEN);
      sheetSpring(translateY, 0);
    }
  }, [visible, translateY]);

  const panHandlers = useSheetDrag(translateY, onClose);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu" />
        <Animated.View
          testID={ids.surface}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              maxHeight: `${Math.round(maxHeightRatio * 100)}%`,
              transform: [{ translateY }],
            },
          ]}
        >
          <Glass
            shape={theme.radius.lg}
            strength="heavy"
            style={[
              styles.glass,
              sheetCorners(theme.radius.lg),
              { paddingBottom: insets.bottom + theme.spacing.md },
            ]}
          >
            <SheetHeader
              title={title}
              subtitle={subtitle}
              onClose={onClose}
              closeTestID={ids.close}
              grabberTestID={ids.grabber}
              panHandlers={panHandlers}
            />
            {children}
          </Glass>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  // The cap lives here (a child of `fill`, which has a definite height) — a
  // percentage maxHeight on a nested auto-height box resolves unpredictably and
  // collapses the lists inside.
  sheet: {
    overflow: 'hidden',
    // Depth so the glass sheet reads as floating above the dimmed screen.
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
  },
  // Shrinks to the cap above so the ScrollView inside a sheet can scroll.
  glass: { overflow: 'hidden', flexShrink: 1 },
});
