/**
 * SettingsBody — every Settings control, as a reusable block.
 *
 * Shared by the full Settings screen (`app/settings.tsx`) and the right side
 * panel (`src/components/chrome/RightPanel.tsx`), so the two can never drift.
 * It renders only the scroll content: the host supplies its own header and
 * ScrollView.
 *
 * Appearance: Light / Dark, default Dark on first launch. Weight unit: kg / lb
 * display unit for the whole app. Everything is persisted on this device.
 */
import { useEffect, useState, type JSX } from 'react';
import { Alert, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme, type ThemePreference } from '../../theme';
import { getSettings, setIdleThresholds, setWeightUnit, type WeightUnit } from '../../data/settings';
import { Button, Card } from '../workout/ui';
import { deleteBackupFile, exportBackup, shareBackup } from '../../data/export';
import { applyReminders, getReminders, type ReminderSettings } from '../../notifications/workoutReminders';
import { notificationsAvailable } from '../../notifications/native';
import { getProfile, type Profile } from '../../data/profile';
import { GOAL_LABEL } from '../../data/generatedPlan';
import { dryRunImport, importBackup, pickBackupFile } from '../../data/import';
import { setCompanionEnabled, useCompanionEnabled } from '../../companion/enabled';
import { setCompanionStyle, useCompanionStyle } from '../../companion/style';
import { COMPANION_STYLES, COMPANION_STYLE_LABEL } from '../../companion/skin';

export interface SettingsBodyProps {
  /**
   * Called just before the block navigates to another screen. The right panel
   * passes its `closePanel` so the panel does not sit on top of the new route.
   */
  onLeave?: () => void;
}

function SegmentedOption<T extends string>({
  label,
  narrowLabel,
  selected,
  onPress,
  testID,
}: {
  label: string;
  /** Short label used on narrow windows (Display Zoom) so text never wraps. */
  narrowLabel?: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const { width } = useWindowDimensions();
  const shownLabel = width < 360 && narrowLabel ? narrowLabel : label;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.md,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? theme.colors.highlight : theme.colors.border,
        backgroundColor: selected ? theme.colors.surfaceMuted : theme.colors.surface,
        paddingHorizontal: theme.spacing.sm,
      }}
    >
      <Text
        style={{
          color: selected ? theme.colors.text : theme.colors.muted,
          fontSize: t.size.body,
          fontWeight: selected ? t.weight.bold : t.weight.medium,
          flexShrink: 1,
          textAlign: 'center',
        }}
        numberOfLines={1}
      >
        {shownLabel}
      </Text>
    </Pressable>
  );
}

export function SettingsBody({ onLeave }: SettingsBodyProps): JSX.Element {
  const { theme, preference, setPreference } = useTheme();
  const t = theme.typography;
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>('kg');
  const [idleMin, setIdleMin] = useState({ prompt: 45, auto: 180 });
  const [dataBusy, setDataBusy] = useState<'export' | 'import' | null>(null);
  const [reminders, setReminders] = useState<ReminderSettings | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const companionOn = useCompanionEnabled();
  const companionStyle = useCompanionStyle();

  useEffect(() => {
    let cancelled = false;
    void getSettings().then((s) => {
      if (!cancelled) {
        setWeightUnitState(s.weightUnit);
        setIdleMin({ prompt: s.idlePromptMinutes, auto: s.autoFinishMinutes });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getReminders(), getProfile()]).then(([r, p]) => {
      if (!cancelled) {
        setReminders(r);
        setProfile(p);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const changeReminders = (patch: Partial<ReminderSettings>): void => {
    if (!reminders) return;
    const next = { ...reminders, ...patch };
    setReminders(next);
    void applyReminders(next).then((ok) => {
      if (!ok) {
        Alert.alert(
          'Notifications are off',
          // Expo Go builds are frozen at publish time; one that predates the
          // notifications module cannot schedule anything, whatever the OS
          // permission says. Say so instead of blaming the phone settings.
          notificationsAvailable()
            ? 'Allow notifications for LIFT in your phone settings to get workout reminders.'
            : 'This Expo Go build cannot schedule notifications. Install the LIFT app build to use workout reminders.',
        );
        setReminders({ ...next, enabled: false });
        void applyReminders({ ...next, enabled: false });
      }
    });
  };

  const handleAppearance = (next: ThemePreference): void => {
    setPreference(next);
  };

  const handleWeightUnit = (unit: WeightUnit): void => {
    setWeightUnitState(unit);
    void setWeightUnit(unit).catch(() => {
      // Settings write failed — the toggle still shows the choice for
      // this session; it just won't survive a restart.
    });
  };

  const handleExport = async (): Promise<void> => {
    setDataBusy('export');
    try {
      const out = await exportBackup();
      try {
        // The share sheet is the only way data leaves the app; on iPhone it
        // includes "Save to Files", on Android "Save" / Drive / email.
        await shareBackup(out.uri);
      } finally {
        try {
          deleteBackupFile(out.uri);
        } catch {
          // Cache cleanup is best-effort.
        }
      }
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Could not create the backup.');
    } finally {
      setDataBusy(null);
    }
  };

  const handleImport = async (): Promise<void> => {
    setDataBusy('import');
    try {
      const uri = await pickBackupFile();
      if (!uri) return;
      const dry = await dryRunImport(uri);
      if (!dry.ok) {
        Alert.alert('Not a valid LIFT backup', dry.errors.slice(0, 3).join('\n'));
        return;
      }
      await new Promise<void>((resolve) => {
        Alert.alert('Import this backup?', `${dry.summaryText}\n\nYour existing data is kept; matching items are merged.`, [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
          {
            text: 'Import',
            onPress: () => {
              void importBackup(uri)
                .then(async () => {
                  // Re-apply restored reminders and refresh what this screen shows.
                  const [r, p] = await Promise.all([getReminders(), getProfile()]);
                  setReminders(r);
                  setProfile(p);
                  await applyReminders(r).catch(() => false);
                  Alert.alert('Import complete', 'Your data has been restored.');
                })
                .catch((e: unknown) => Alert.alert('Import failed', e instanceof Error ? e.message : 'Try again.'))
                .finally(() => resolve());
            },
          },
        ]);
      });
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Could not read that file.');
    } finally {
      setDataBusy(null);
    }
  };

  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.md,
        paddingTop: theme.spacing.sm,
        gap: theme.spacing.md,
      }}
    >
      <Card>
        <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>
          PROFILE &amp; PLAN
        </Text>
        <Text style={{ color: theme.colors.text, fontSize: t.size.body }}>
          {profile?.onboarded
            ? `${profile.experience[0].toUpperCase()}${profile.experience.slice(1)} · ${GOAL_LABEL[profile.goal]} · ${profile.daysPerWeek} days a week · ${profile.minutes} min`
            : 'Tell LIFT about you and get a plan built for your body, level and week.'}
        </Text>
        <Button
          title={profile?.onboarded ? 'Edit profile & rebuild plan' : 'Set up my plan'}
          testID="settings-profile"
          variant="secondary"
          onPress={() => {
            onLeave?.();
            router.push('/onboarding?edit=1');
          }}
        />
      </Card>

      <Card>
        <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>
          WORKOUT CHECK-INS
        </Text>
        <Text style={{ color: theme.colors.text, fontSize: t.size.body }}>
          If a workout goes quiet, LIFT asks &quot;still training?&quot; — and finishes it for you at your last set if
          you don&apos;t answer.
        </Text>
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>ASK AFTER</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {[30, 45, 60, 90].map((m) => {
            const on = idleMin.prompt === m;
            return (
              <Pressable
                key={m}
                testID={`settings-idle-prompt-${m}`}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  const auto = idleMin.auto === 0 ? 0 : Math.max(idleMin.auto, m + 15);
                  setIdleMin({ prompt: m, auto });
                  void setIdleThresholds(m, auto).catch(() => undefined);
                }}
                style={{
                  paddingVertical: theme.spacing.xs + 2,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.pill,
                  borderWidth: 1,
                  borderColor: on ? theme.colors.accent : theme.colors.border,
                  backgroundColor: on ? theme.colors.surfaceMuted : 'transparent',
                }}
              >
                <Text style={{ color: on ? theme.colors.text : theme.colors.muted, fontSize: t.size.meta + 1 }}>{m} min</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>FINISH AUTOMATICALLY AFTER</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {[[120, '2 h'], [180, '3 h'], [240, '4 h'], [0, 'Never']].map(([m, label]) => {
            const on = idleMin.auto === m;
            const disabled = m !== 0 && (m as number) < idleMin.prompt + 15;
            return (
              <Pressable
                key={String(label)}
                testID={`settings-idle-auto-${m}`}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled }}
                disabled={disabled}
                onPress={() => {
                  setIdleMin({ prompt: idleMin.prompt, auto: m as number });
                  void setIdleThresholds(idleMin.prompt, m as number).catch(() => undefined);
                }}
                style={{
                  paddingVertical: theme.spacing.xs + 2,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.pill,
                  borderWidth: 1,
                  borderColor: on ? theme.colors.accent : theme.colors.border,
                  backgroundColor: on ? theme.colors.surfaceMuted : 'transparent',
                  opacity: disabled ? 0.4 : 1,
                }}
              >
                <Text style={{ color: on ? theme.colors.text : theme.colors.muted, fontSize: t.size.meta + 1 }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
          Closing happens when you next open LIFT, recorded at your last real activity — never at the moment you came
          back. Empty workouts are simply discarded.
        </Text>
      </Card>

      <Card>
        <Text style={{ color: theme.colors.muted, fontSize: t.size.caption, fontWeight: t.weight.medium }}>
          WORKOUT REMINDERS
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <SegmentedOption
            label="Off"
            selected={!reminders?.enabled}
            onPress={() => changeReminders({ enabled: false })}
            testID="settings-reminders-off"
          />
          <SegmentedOption
            label="On"
            selected={!!reminders?.enabled}
            onPress={() => changeReminders({ enabled: true })}
            testID="settings-reminders-on"
          />
        </View>
        {reminders?.enabled ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => {
                const on = reminders.days.includes(i);
                return (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]}
                    onPress={() =>
                      changeReminders({
                        days: on ? reminders.days.filter((x) => x !== i) : [...reminders.days, i].sort(),
                      })
                    }
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: on ? theme.colors.accent : 'transparent',
                      borderWidth: on ? 0 : 1,
                      borderColor: theme.colors.border,
                    }}
                  >
                    <Text style={{ color: on ? theme.colors.accentText : theme.colors.muted, fontSize: t.size.meta + 1, fontWeight: t.weight.semibold }}>
                      {d}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {[[6, 30], [7, 0], [12, 0], [17, 30], [18, 0], [19, 30]].map(([h, m]) => {
                const on = reminders.hour === h && reminders.minute === m;
                return (
                  <Pressable
                    key={`${h}:${m}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => changeReminders({ hour: h, minute: m })}
                    style={{
                      paddingVertical: theme.spacing.xs + 2,
                      paddingHorizontal: theme.spacing.md,
                      borderRadius: theme.radius.pill,
                      borderWidth: 1,
                      borderColor: on ? theme.colors.accent : theme.colors.border,
                      backgroundColor: on ? theme.colors.surfaceMuted : 'transparent',
                    }}
                  >
                    <Text style={{ color: on ? theme.colors.text : theme.colors.muted, fontSize: t.size.meta + 1 }}>
                      {`${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
          Reminders are scheduled on this device only — no account, no server.
        </Text>
      </Card>

      <Card>
        <Text
          style={{
            color: theme.colors.muted,
            fontSize: t.size.caption,
            fontWeight: t.weight.medium,
          }}
        >
          COMPANION
        </Text>
        <Text style={{ color: theme.colors.text, fontSize: t.size.body }}>
          Pip is a small character that floats over every screen and passes on
          the odd tip, cheer or reminder. It runs entirely on this device.
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <SegmentedOption
            label="Off"
            selected={!companionOn}
            onPress={() => void setCompanionEnabled(false)}
            testID="settings-companion-off"
          />
          <SegmentedOption
            label="On"
            selected={companionOn}
            onPress={() => void setCompanionEnabled(true)}
            testID="settings-companion-on"
          />
        </View>
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
          Hiding Pip stops every companion message too. Nothing is ever sent
          anywhere.
        </Text>
        <Text
          style={{
            color: theme.colors.muted,
            fontSize: t.size.caption,
            fontWeight: t.weight.medium,
          }}
        >
          STYLE
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {COMPANION_STYLES.map((style) => (
            <SegmentedOption
              key={style}
              label={COMPANION_STYLE_LABEL[style]}
              selected={companionStyle === style}
              onPress={() => void setCompanionStyle(style)}
              testID={`settings-companion-style-${style}`}
            />
          ))}
        </View>
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
          Mouse is the illustrated Pip (default); Blob is the drawn SVG
          character.
        </Text>
      </Card>

      <Card>
        <Text
          style={{
            color: theme.colors.muted,
            fontSize: t.size.caption,
            fontWeight: t.weight.medium,
          }}
        >
          APPEARANCE
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <SegmentedOption
            label="Dark"
            selected={preference === 'dark'}
            onPress={() => handleAppearance('dark')}
            testID="settings-appearance-dark"
          />
          <SegmentedOption
            label="Light"
            selected={preference === 'light'}
            onPress={() => handleAppearance('light')}
            testID="settings-appearance-light"
          />
        </View>
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
          Dark is the default. Your choice applies to every screen and is
          saved on this device.
        </Text>
      </Card>

      <Card>
        <Text
          style={{
            color: theme.colors.muted,
            fontSize: t.size.caption,
            fontWeight: t.weight.medium,
          }}
        >
          WEIGHT UNIT
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <SegmentedOption
            label="Kilograms (kg)"
            narrowLabel="kg"
            selected={weightUnit === 'kg'}
            onPress={() => handleWeightUnit('kg')}
            testID="settings-unit-kg"
          />
          <SegmentedOption
            label="Pounds (lb)"
            narrowLabel="lb"
            selected={weightUnit === 'lb'}
            onPress={() => handleWeightUnit('lb')}
            testID="settings-unit-lb"
          />
        </View>
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
          Weights are stored in kilograms; this only changes how they are
          shown.
        </Text>
      </Card>

      <Card>
        <Text
          style={{
            color: theme.colors.muted,
            fontSize: t.size.caption,
            fontWeight: t.weight.medium,
          }}
        >
          YOUR DATA
        </Text>
        <Text style={{ color: theme.colors.text, fontSize: t.size.body }}>
          Back up everything on this device — workouts, plans, your own
          exercises and settings — to a file you keep.
        </Text>
        <Button
          title="Export backup"
          testID="settings-export"
          busy={dataBusy === 'export'}
          disabled={dataBusy !== null}
          onPress={() => void handleExport()}
        />
        <Button
          title="Import backup"
          variant="secondary"
          testID="settings-import"
          busy={dataBusy === 'import'}
          disabled={dataBusy !== null}
          onPress={() => void handleImport()}
        />
        <Text style={{ color: theme.colors.faint, fontSize: t.size.caption }}>
          On iPhone choose &quot;Save to Files&quot; in the share sheet. LIFT
          never uploads your data anywhere.
        </Text>
      </Card>
    </View>
  );
}
