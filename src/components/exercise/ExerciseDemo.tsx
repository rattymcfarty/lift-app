/**
 * ExerciseDemo — the movement clip at the top of an exercise guide.
 *
 * One square tile that fills the guide's content width (capped at 420 pt so it
 * does not become a wall on a tablet). With a bundled clip it is a muted,
 * silent 3 s loop: no controls, no audio, no inline fullscreen, cover-cropped,
 * clipped to the tile's radius. Tapping it opens the same loop in a black
 * full-screen viewer. Without a clip it is the primary-muscle icon plus a quiet
 * "coming soon" line, so every exercise has the same media slot from day one.
 *
 * Platform notes:
 * - iOS autoplay requires `muted`; the player is muted before `play()`.
 * - Android uses `textureView` so the video obeys the tile's rounded corners
 *   (a SurfaceView draws above the clipped parent on some devices).
 * - The loop pauses when the screen loses focus, when the app backgrounds, and
 *   while the full-screen viewer is open; it resumes only if the guide is still
 *   the focused screen.
 * - Reduce Motion (iOS / Android "remove animations") falls back to the still
 *   muscle icon instead of starting the loop.
 */
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useTheme, type Theme } from '../../theme';
import { ActionIcon, TaxonomyIcon } from '../icons';
import { resolveExerciseDemo } from '../../kb/exerciseDemo';

export interface ExerciseDemoProps {
  /** The exercise's permanent KB id (seeded rows use it as the row id too). */
  exerciseId?: string | null;
  /** Used for the screen-reader label and the full-screen title. */
  exerciseName: string;
  /** Primary muscle — the still fallback when there is no clip. */
  primaryMuscle?: string;
  /** Cap for the square tile in pt. It fills the parent width below this. */
  maxSize?: number;
}

/** The tile is the guide width; past this it stops growing (tablets). */
const DEFAULT_MAX_SIZE = 420;
/** The still icon does not scale linearly with the tile — it would dwarf it. */
const STILL_ICON_RATIO = 0.32;

export function ExerciseDemo({
  exerciseId,
  exerciseName,
  primaryMuscle = 'Other',
  maxSize = DEFAULT_MAX_SIZE,
}: ExerciseDemoProps): JSX.Element {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const source = resolveExerciseDemo(exerciseId);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (alive) setReduceMotion(on);
      })
      .catch(() => {
        // Older platforms may not answer; treat it as off.
      });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const still = (
    <View style={[styles.tile, styles.square, { maxWidth: maxSize }]}>
      <TaxonomyIcon
        kind="muscle"
        id={primaryMuscle}
        size={Math.round(maxSize * STILL_ICON_RATIO)}
        tiled={false}
      />
    </View>
  );

  if (!source) {
    return (
      <View style={styles.wrap} testID="exercise-demo-placeholder">
        {still}
        <Text style={styles.caption}>Movement demo coming soon</Text>
      </View>
    );
  }

  if (reduceMotion) {
    return (
      <View style={styles.wrap} testID="exercise-demo-reduced-motion">
        {still}
        <Text style={styles.caption}>Movement demo (Reduce Motion is on)</Text>
      </View>
    );
  }

  return <VideoDemo source={source} exerciseName={exerciseName} maxSize={maxSize} />;
}

function VideoDemo({
  source,
  exerciseName,
  maxSize,
}: {
  source: number;
  exerciseName: string;
  maxSize: number;
}): JSX.Element {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [viewerOpen, setViewerOpen] = useState(false);
  const focused = useRef(false);
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      player.play();
      return () => {
        focused.current = false;
        player.pause();
      };
    }, [player]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && focused.current && !viewerOpen) player.play();
      else player.pause();
    });
    return () => sub.remove();
  }, [player, viewerOpen]);

  // The full-screen viewer has its own player; keep the tile's loop quiet
  // underneath it, and resume only when the guide is still in front.
  useEffect(() => {
    if (viewerOpen) player.pause();
    else if (focused.current && AppState.currentState === 'active') player.play();
  }, [player, viewerOpen]);

  return (
    <View style={styles.wrap} testID="exercise-demo">
      <View style={[styles.tile, styles.square, { maxWidth: maxSize }]}>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls={false}
          contentFit="cover"
          fullscreenOptions={{ enable: false }}
          allowsPictureInPicture={false}
          surfaceType="textureView"
          pointerEvents="none"
          testID="exercise-demo-video"
          accessibilityRole="image"
          accessibilityLabel={`${exerciseName} movement demo`}
        />
        <Pressable
          onPress={() => setViewerOpen(true)}
          testID="exercise-demo-expand"
          accessibilityRole="button"
          accessibilityLabel={`Open the ${exerciseName} movement demo full screen`}
          style={({ pressed }) => [styles.expandPress, { opacity: pressed ? 0.8 : 1 }]}
        >
          <View style={styles.expandBadge}>
            <ActionIcon name="expand" color="#ffffff" size={16} />
          </View>
        </Pressable>
      </View>
      <Text style={styles.caption}>Movement demo · 3 s loop · tap to expand</Text>
      {viewerOpen ? (
        <DemoViewer
          source={source}
          exerciseName={exerciseName}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </View>
  );
}

/**
 * Full-screen viewer. Black in both themes so the footage is the only thing
 * that glows; the header keeps the exercise name and a close button. The
 * square clip is letterboxed with `contain`, which fills the width on a phone
 * (the app is portrait-locked).
 */
function DemoViewer({
  source,
  exerciseName,
  onClose,
}: {
  source: number;
  exerciseName: string;
  onClose: () => void;
}): JSX.Element {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') player.play();
      else player.pause();
    });
    return () => sub.remove();
  }, [player]);

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.viewer} testID="exercise-demo-fullscreen">
        <StatusBar style="light" />
        <View style={[styles.viewerHeader, { paddingTop: insets.top + theme.spacing.sm }]}>
          <Text style={styles.viewerTitle} numberOfLines={2}>
            {exerciseName}
          </Text>
          <Pressable
            onPress={onClose}
            testID="exercise-demo-close"
            accessibilityRole="button"
            accessibilityLabel="Close movement demo"
            hitSlop={12}
            style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.6 : 1 }]}
          >
            <ActionIcon name="close" color="#ffffff" size={22} />
          </Pressable>
        </View>
        <View style={styles.viewerBody}>
          <VideoView
            player={player}
            style={styles.viewerVideo}
            nativeControls={false}
            contentFit="contain"
            fullscreenOptions={{ enable: false }}
            allowsPictureInPicture={false}
            surfaceType="textureView"
            testID="exercise-demo-fullscreen-video"
            accessibilityRole="image"
            accessibilityLabel={`${exerciseName} movement demo, full screen`}
          />
        </View>
        <Text
          style={[
            styles.viewerCaption,
            { paddingBottom: insets.bottom + theme.spacing.md },
          ]}
        >
          Movement demo · 3 s loop · silent
        </Text>
      </View>
    </Modal>
  );
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },
    tile: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    square: {
      width: '100%',
      aspectRatio: 1,
    },
    video: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderRadius: theme.radius.md,
    },
    expandPress: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'flex-end',
      justifyContent: 'flex-end',
      padding: theme.spacing.sm,
    },
    expandBadge: {
      width: 30,
      height: 30,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.35)',
    },
    caption: {
      marginTop: theme.spacing.sm,
      fontSize: theme.typography.size.caption,
      color: theme.colors.muted,
      textAlign: 'center',
    },
    // The viewer is a black cinema surface in both themes, so its text and
    // controls are fixed light-on-dark rather than theme tokens.
    viewer: {
      flex: 1,
      backgroundColor: '#000000',
    },
    viewerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    viewerTitle: {
      flex: 1,
      color: '#ffffff',
      fontSize: theme.typography.size.card,
      fontWeight: theme.typography.weight.semibold,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    viewerBody: {
      flex: 1,
    },
    viewerVideo: {
      flex: 1,
      width: '100%',
    },
    viewerCaption: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: theme.typography.size.caption,
      textAlign: 'center',
      paddingTop: theme.spacing.sm,
    },
  });
}
