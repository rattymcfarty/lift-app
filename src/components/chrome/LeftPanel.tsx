/**
 * LeftPanel — the slide-in menu (top-left button).
 *
 * A quick "New workout" action, a search shortcut, Programs, and the secondary
 * screens under "More". The three main doors live on the floating bar itself, so
 * there is nothing to jump to or reorder here (owner decision 2026-10-26: the
 * menu is for features, the right panel is for settings). Everything is tap only;
 * the panel closes on scrim tap, the close button, any item tap, or Android back
 * (handled by the host).
 */
import { useCallback, type JSX } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Button } from '../workout/ui';
import { ActionIcon, type ActionIconName } from '../icons';
import { GlassButton } from '../ui/Glass';
import { usePanels } from '../../chrome/panels';
import { PANEL_MORE_LINKS } from '../../chrome/panelLinks';

export function LeftPanel(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { closePanel } = usePanels();
  const go = useCallback(
    (href: string) => {
      closePanel();
      router.push(href as Href);
    },
    [closePanel, router],
  );

  const openSearch = useCallback(() => {
    closePanel();
    router.push({ pathname: '/exercises', params: { focus: 'search' } } as Href);
  }, [closePanel, router]);


  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.sm,
        }}
      >
        <Text style={{ color: c.text, fontSize: t.size.section, fontWeight: t.weight.bold }}>LIFT</Text>
        <GlassButton
          testID="panel-close"
          icon={<ActionIcon name="close" color={c.text} size={22} />}
          accessibilityLabel="Close menu"
          onPress={closePanel}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.md,
          paddingBottom: insets.bottom + theme.spacing.xl,
          gap: theme.spacing.lg,
        }}
      >
        <View style={{ gap: theme.spacing.sm }}>
          <Button title="New workout" testID="panel-new-workout" onPress={() => go('/workout/new')} />
          <PanelRow
            icon="search"
            label="Search exercises"
            testID="panel-search"
            divider
            onPress={openSearch}
          />
          <PanelRow
            icon="note"
            label="Programs"
            testID="panel-programs"
            divider={false}
            onPress={() => go('/programs')}
          />
        </View>

        <View>
          <SectionTitle>More</SectionTitle>
          <View>
            {PANEL_MORE_LINKS.map((link, index) => (
              <PanelRow
                key={link.key}
                icon={link.icon}
                label={link.label}
                testID={`panel-more-${link.key}`}
                divider={index < PANEL_MORE_LINKS.length - 1}
                onPress={() => go(link.href)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** Small uppercased heading inside the panel. */
function SectionTitle({ children }: { children: string }): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  return (
    <Text
      style={{
        color: theme.colors.muted,
        fontSize: t.size.caption,
        fontWeight: t.weight.medium,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: theme.spacing.xs,
      }}
    >
      {children}
    </Text>
  );
}

/** One tappable menu row: leading glyph, label, trailing chevron. */
function PanelRow({
  icon,
  label,
  testID,
  onPress,
  divider = true,
}: {
  icon: ActionIconName;
  label: string;
  testID: string;
  onPress: () => void;
  divider?: boolean;
}): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.sm,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: c.border,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <ActionIcon name={icon} color={c.muted} size={20} />
      <Text style={{ flex: 1, color: c.text, fontSize: t.size.body }}>{label}</Text>
      <ActionIcon name="chevron-right" color={c.faint} size={18} />
    </Pressable>
  );
}
