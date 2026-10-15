/**
 * Program Details — page 1: name, tagline, description, thumbnail.
 * Used for both "create" (flow=create → continues to page 2 → builder) and
 * editing an existing program (changes save as you type).
 */
import { useCallback, useState, type JSX } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../../../src/theme';
import { Section, TextArea, WizardPage } from '../../../src/components/programs/ProgramFormBits';
import { Button } from '../../../src/components/workout/ui';
import {
  deleteUserProgram,
  detailsOf,
  getUserProgram,
  setProgramThumbnail,
  updateProgramDetails,
} from '../../../src/programs/userPrograms';
import { DESCRIPTION_MAX, NAME_MAX, TAGLINE_MAX, type UserProgram } from '../../../src/programs/userProgramDef';

export default function ProgramDetailsPage(): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  const params = useLocalSearchParams<{ id: string; flow?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const creating = params.flow === 'create';

  const [program, setProgram] = useState<UserProgram | null>(null);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const p = await getUserProgram(id);
        if (cancelled || !p) return;
        const d = detailsOf(p);
        setProgram(p);
        if (!loaded) {
          setName(p.name);
          setTagline(d.tagline);
          setDescription(d.description);
          setLoaded(true);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [id, loaded]),
  );

  if (!program) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.muted} />
      </View>
    );
  }
  const d = detailsOf(program);
  const nameOk = name.trim().length > 0;

  const persist = async (): Promise<UserProgram> => {
    const next = await updateProgramDetails(program, { name: name.trim() || program.name, tagline: tagline.trim(), description });
    setProgram(next);
    return next;
  };

  const pickThumbnail = async (): Promise<void> => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
      if (res.canceled) return;
      const uri = res.assets[0]?.uri;
      if (!uri) return;
      const next = await setProgramThumbnail(program, uri);
      setProgram(next);
    } catch (e) {
      Alert.alert('Could not use that image', e instanceof Error ? e.message : 'Try a different file.');
    }
  };

  const leave = (): void => {
    // Backing out of a brand-new program with no name changes discards it.
    if (creating && name.trim() === 'New Program' && !tagline && !description) {
      void deleteUserProgram(program.id).finally(() => router.back());
      return;
    }
    void persist().finally(() => router.back());
  };

  return (
    <WizardPage
      title="Program Details"
      progress={creating ? 'Step 1 of 3' : undefined}
      onBack={leave}
      nextDisabled={!nameOk}
      nextTestID="details-next"
      onNext={() => {
        void persist().then(() =>
          router.push(`/programs/${program.id}/setup${creating ? '?flow=create' : ''}` as Href),
        );
      }}
    >
      <Section label="Program Name" required counter={`${name.length}/${NAME_MAX}`}>
        <TextArea testID="details-name" value={name} onChangeText={setName} maxLength={NAME_MAX} placeholder="e.g. Longevity 4-7-8" autoCapitalize="words" />
      </Section>
      <Section label="Tagline" counter={`${tagline.length}/${TAGLINE_MAX}`}>
        <TextArea
          testID="details-tagline"
          value={tagline}
          onChangeText={setTagline}
          maxLength={TAGLINE_MAX}
          multiline
          minHeight={78}
          placeholder="One line that sums it up"
        />
      </Section>
      <Section label="Description" counter={`${description.length}/${DESCRIPTION_MAX}`}>
        <TextArea
          testID="details-description"
          value={description}
          onChangeText={setDescription}
          maxLength={DESCRIPTION_MAX}
          multiline
          minHeight={170}
          placeholder="What is this program for? Who is it for? How should it feel?"
        />
      </Section>
      <Section label="Thumbnail">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Pressable
            testID="details-thumbnail"
            onPress={() => void pickThumbnail()}
            accessibilityRole="button"
            accessibilityLabel="Choose thumbnail"
            style={{
              width: 104,
              height: 104,
              borderRadius: theme.radius.md,
              overflow: 'hidden',
              backgroundColor: c.surfaceMuted,
              borderWidth: 1,
              borderColor: c.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {d.thumbnailUri ? (
              <Image source={{ uri: d.thumbnailUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <Text style={{ color: c.muted, fontSize: t.size.section }}>＋</Text>
            )}
          </Pressable>
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <Text style={{ color: c.muted, fontSize: t.size.meta + 1 }}>
              Optional. Stored only on this device — it never leaves your phone.
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button title={d.thumbnailUri ? 'Change' : 'Choose image'} variant="secondary" onPress={() => void pickThumbnail()} />
              </View>
              {d.thumbnailUri ? (
                <View style={{ flex: 1 }}>
                  <Button
                    title="Remove"
                    variant="danger"
                    onPress={() => {
                      void setProgramThumbnail(program, null).then(setProgram);
                    }}
                  />
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Section>
    </WizardPage>
  );
}
