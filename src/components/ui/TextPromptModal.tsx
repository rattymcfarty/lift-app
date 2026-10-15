/**
 * TextPromptModal — a small cross-platform "enter a name" dialog (Alert.prompt
 * is iOS-only). Used for renaming programs and days.
 */
import { useEffect, useState, type JSX } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../theme';

export function TextPromptModal({
  visible,
  title,
  initial,
  placeholder,
  confirmLabel = 'Save',
  onSubmit,
  onClose,
  testID,
}: {
  visible: boolean;
  title: string;
  initial: string;
  placeholder?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
  testID?: string;
}): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const c = theme.colors;
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (visible) setValue(initial);
  }, [visible, initial]);
  const submit = (): void => {
    const v = value.trim();
    if (v) {
      onSubmit(v);
      onClose();
    }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: theme.spacing.lg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ backgroundColor: c.surface, borderRadius: theme.radius.lg, padding: theme.spacing.md, gap: theme.spacing.md }}>
          <Text style={{ color: c.text, fontSize: t.size.card, fontWeight: t.weight.bold }}>{title}</Text>
          <TextInput
            testID={testID}
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={c.faint}
            autoFocus
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={submit}
            selectTextOnFocus
            style={{
              backgroundColor: c.surfaceMuted,
              borderColor: c.border,
              borderWidth: 1,
              borderRadius: theme.radius.md,
              color: c.text,
              fontSize: t.size.body,
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
            }}
          />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
            <Pressable onPress={onClose} accessibilityRole="button" style={{ padding: theme.spacing.sm }}>
              <Text style={{ color: c.muted, fontSize: t.size.row, fontWeight: t.weight.medium }}>Cancel</Text>
            </Pressable>
            <Pressable
              testID={testID ? `${testID}-save` : undefined}
              onPress={submit}
              accessibilityRole="button"
              style={{ padding: theme.spacing.sm }}
            >
              <Text style={{ color: c.accent, fontSize: t.size.row, fontWeight: t.weight.bold }}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
