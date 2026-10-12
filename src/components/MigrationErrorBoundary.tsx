import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { deleteDatabaseSync } from 'expo-sqlite';
import { getRawDb } from '../db/client';
import { useTheme } from '../theme';

/**
 * Catches startup crashes from the migration gate in app/_layout.tsx and
 * shows a themed recovery screen instead of a red screen / hard crash.
 *
 * Two recovery paths, in order of destructiveness:
 *  1. "Try again" — remounts the app shell; useMigrations re-runs. Safe:
 *     already-applied migrations are skipped via the journal.
 *  2. "Erase local data" — drops every table (including the drizzle
 *     __drizzle_migrations journal) and remounts, so migrations run clean
 *     on an empty database. Destructive: requires explicit confirmation,
 *     and the confirmation copy states plainly that nothing can be
 *     recovered. If even the SQL-level erase fails (e.g. corrupt file),
 *     falls back to deleting the database file and asking for an app
 *     restart.
 *
 * Never touches src/db/client.ts: it works through the exported getRawDb()
 * handle and expo-sqlite's own deleteDatabaseSync, so the module singleton
 * and drizzle wrapper stay valid across a remount.
 */

type RecoveryPhase =
  | 'error'
  | 'confirmErase'
  | 'erasing'
  | 'eraseFailed'
  | 'restartNeeded';

interface RecoveryScreenProps {
  error: unknown;
  onRetry: () => void;
}

/** Drops all user tables (and the migration journal) from the open database. */
async function eraseAllTables(): Promise<void> {
  const raw = getRawDb();
  // A half-applied migration can leave dangling references; drop with FK
  // enforcement off so the erase itself can't trip on them.
  raw.execSync('PRAGMA foreign_keys = OFF');
  try {
    const tables = raw.getAllSync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    );
    for (const { name } of tables) {
      raw.execSync(`DROP TABLE IF EXISTS "${name.replace(/"/g, '""')}"`);
    }
    raw.execSync('VACUUM');
  } finally {
    raw.execSync('PRAGMA foreign_keys = ON');
  }
}

/**
 * Nuclear fallback: close the connection, delete the database file, and
 * report that the app must be restarted (the module-level connection in
 * src/db/client.ts can't be swapped without a reload).
 */
async function eraseDatabaseFile(): Promise<void> {
  const raw = getRawDb();
  try {
    raw.closeSync();
  } catch {
    // Already closed or never fully opened — proceed to deletion anyway.
  }
  try {
    deleteDatabaseSync('lift.db');
  } catch (e) {
    // Missing file is fine: the goal (no database file) is already met.
    if (!(e instanceof Error && /not found/i.test(e.message))) {
      throw e;
    }
  }
}

function RecoveryScreen({ error, onRetry }: RecoveryScreenProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography, radius } = theme;

  const [phase, setPhase] = useState<RecoveryPhase>('error');
  const [eraseError, setEraseError] = useState<string | null>(null);

  const handleErase = async () => {
    setPhase('erasing');
    setEraseError(null);
    try {
      await eraseAllTables();
      onRetry();
    } catch (e) {
      // SQL-level erase failed (e.g. corrupt file) — try file deletion.
      try {
        await eraseDatabaseFile();
        setPhase('restartNeeded');
      } catch (e2) {
        setEraseError(String(e2 instanceof Error ? e2.message : e2));
        setPhase('eraseFailed');
      }
    }
  };

  const button = (
    label: string,
    onPress: () => void,
    kind: 'primary' | 'danger' | 'quiet',
  ) => {
    const backgroundColor =
      kind === 'primary'
        ? colors.accent
        : kind === 'danger'
          ? colors.danger
          : 'transparent';
    const textColor =
      kind === 'quiet'
        ? colors.text
        : kind === 'primary'
          ? colors.accentText
          : '#ffffff';
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={{
          backgroundColor,
          borderRadius: radius.md,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          marginTop: spacing.sm,
          ...(kind === 'quiet'
            ? { borderWidth: 1, borderColor: colors.border }
            : null),
        }}
      >
        <Text
          style={{
            color: textColor,
            fontSize: typography.size.body,
            fontWeight: typography.weight.medium,
            textAlign: 'center',
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        padding: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      {phase === 'restartNeeded' ? (
        <>
          <Text
            style={{
              color: colors.text,
              fontSize: typography.size.title,
              fontWeight: typography.weight.bold,
              marginBottom: spacing.sm,
            }}
          >
            Database erased
          </Text>
          <Text
            style={{
              color: colors.muted,
              fontSize: typography.size.body,
              marginBottom: spacing.md,
            }}
          >
            The local database file was deleted. Close and reopen LIFT to
            start fresh — migrations will run on an empty database.
          </Text>
        </>
      ) : (
        <>
          <Text
            style={{
              color: colors.text,
              fontSize: typography.size.title,
              fontWeight: typography.weight.bold,
              marginBottom: spacing.sm,
            }}
          >
            {phase === 'confirmErase'
              ? 'Erase all local data?'
              : "Couldn't start LIFT"}
          </Text>
          <Text
            style={{
              color: colors.muted,
              fontSize: typography.size.body,
              marginBottom: spacing.sm,
            }}
          >
            {phase === 'confirmErase'
              ? 'This permanently deletes every workout, routine, and measurement stored on this device. There is no backup and this cannot be undone.'
              : 'The local database failed to migrate. Your data is still on the device — nothing has been deleted.'}
          </Text>
          {phase === 'error' || phase === 'eraseFailed' ? (
            <Text
              style={{
                color: colors.faint,
                fontSize: typography.size.caption,
                marginBottom: spacing.md,
              }}
            >
              {String(
                phase === 'eraseFailed' && eraseError
                  ? eraseError
                  : error instanceof Error
                    ? error.message
                    : error,
              )}
            </Text>
          ) : null}
          {phase === 'erasing' ? (
            <ActivityIndicator color={colors.muted} />
          ) : phase === 'confirmErase' ? (
            <>
              {button('Erase everything', handleErase, 'danger')}
              {button('Keep my data', () => setPhase('error'), 'quiet')}
            </>
          ) : (
            <>
              {button('Try again', onRetry, 'primary')}
              {button('Erase local data…', () => setPhase('confirmErase'), 'quiet')}
              {phase === 'eraseFailed' ? (
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: typography.size.caption,
                    marginTop: spacing.md,
                  }}
                >
                  If this keeps failing, deleting and reinstalling the app
                  also clears local data.
                </Text>
              ) : null}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

interface BoundaryProps {
  children: ReactNode;
}

interface BoundaryState {
  error: unknown;
  /** True if the recovery screen itself threw — render static UI. */
  nested: boolean;
}

export class MigrationErrorBoundary extends Component<
  BoundaryProps,
  BoundaryState
> {
  state: BoundaryState = { error: null, nested: false };

  /**
   * True once this boundary has caught an error. An instance field rather
   * than state: getDerivedStateFromError() sets state.error during the
   * render phase, before componentDidCatch() runs in the commit phase, so
   * reading this.state.error in componentDidCatch cannot distinguish a
   * first error from a nested one.
   */
  private caughtOnce = false;

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[lift] migration boundary caught:', error, info.componentStack);
    if (this.caughtOnce) {
      // The recovery screen threw too — stop recursing and show UI that
      // cannot throw (no theme hooks, no callbacks, hard-coded colors).
      this.setState({ nested: true });
    } else {
      this.caughtOnce = true;
    }
  }

  private retry = () => {
    // A later unrelated error after a successful retry must not be
    // misclassified as a nested error, so reset the flag here too.
    this.caughtOnce = false;
    this.setState({ error: null, nested: false });
  };

  render() {
    if (this.state.nested) {
      return (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000000',
            padding: 24,
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: 18, textAlign: 'center' }}>
            LIFT couldn't start. Try reopening the app; if it persists,
            reinstalling clears local data.
          </Text>
        </View>
      );
    }
    if (this.state.error) {
      return (
        <RecoveryScreen error={this.state.error} onRetry={this.retry} />
      );
    }
    return this.props.children;
  }
}
