/**
 * ExerciseDemo — the movement clip at the top of an exercise guide.
 *
 * One square tile, 120 pt by default (the size the clips are authored for).
 * With a bundled clip it is a muted, silent 3 s loop: no controls, no audio,
 * no fullscreen, cover-cropped, clipped to the tile's radius. Without one it is
 * the primary-muscle icon plus a quiet "coming soon" line, so every exercise
 * has the same media slot from day one.
 *
 * Platform notes:
 * - iOS autoplay requires `muted`; the player is muted before `play()`.
 * - Android uses `textureView` so the video obeys the tile's rounded corners
 *   (a SurfaceView draws above the clipped parent on some devices).
 * - The loop pauses when the screen loses focus and when the app backgrounds,
 *   and resumes only if the guide is still the focused screen.
 * - Reduce Motion (iOS / Android "remove animations") falls back to the still
 *   muscle icon instead of starting the loop.
 */
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useTheme, type Theme } from '../../theme';
import { TaxonomyIcon } from '../icons';
import { resolveExerciseDemo } from '../../kb/exerciseDemo';

export interface ExerciseDemoProps {
  /** The exercise's permanent KB id (seeded rows use it as the row id too). */
  exerciseId?: string | null;
  /** Used for the screen-reader label only. */
  exerciseName: string;
  /** Primary muscle — the still fallback when there is no clip. */
  primaryMuscle?: string;
  /** Tile edge in pt. Defaults to the authored 120. */
  size?: number;
}

const DEFAULT_SIZE = 120;

export function ExerciseDemo({
  exerciseId,
  exerciseName,
  primaryMuscle = 'Other',
  size = DEFAULT_SIZE,
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
    <View style={[styles.tile, { width: size, height: size }]}>
      <TaxonomyIcon kind="muscle" id={primaryMuscle} size={Math.round(size * 0.8)} tiled={false} />
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

  return <VideoDemo source={source} exerciseName={exerciseName} size={size} />;
}

function VideoDemo({
  source,
  exerciseName,
  size,
}: {
  source: number;
  exerciseName: string;
  size: number;
}): JSX.Element {
  const { theme } = useTheme();
  const styles = getStyles(theme);
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
      if (state === 'active' && focused.current) player.play();
      else player.pause();
    });
    return () => sub.remove();
  }, [player]);

  return (
    <View style={styles.wrap} testID="exercise-demo">
      <View style={[styles.tile, { width: size, height: size }]}>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls={false}
          contentFit="cover"
          fullscreenOptions={{ enable: false }}
          allowsPictureInPicture={false}
          surfaceType="textureView"
          testID="exercise-demo-video"
          accessibilityRole="image"
          accessibilityLabel={`${exerciseName} movement demo`}
        />
      </View>
      <Text style={styles.caption}>Movement demo · 3 s loop</Text>
    </View>
  );
}

function getStyles(theme: Theme) {
  return StyleSheet.create({
    wrap: {
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
    video: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderRadius: theme.radius.md,
    },
    caption: {
      marginTop: theme.spacing.sm,
      fontSize: theme.typography.size.caption,
      color: theme.colors.muted,
    },
  });
}
