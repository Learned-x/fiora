import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { radius } from '../theme/radius';
import { typography } from '../theme/typography';
import { Button } from './Button';
import { TextInput } from './TextInput';
import { renameVase } from '../services/vases.api';

interface RenameVaseModalProps {
  visible: boolean;
  vaseId: string;
  currentName: string | null;
  onClose: () => void;
  onRenamed: () => void;
  onError: () => void;
}

export function RenameVaseModal({ visible, vaseId, currentName, onClose, onRenamed, onError }: RenameVaseModalProps) {
  const theme = useTheme();
  const [value, setValue] = useState(currentName ?? '');

  useEffect(() => {
    if (visible) setValue(currentName ?? '');
  }, [visible, currentName]);

  async function confirm() {
    const nome = value.trim();
    if (!nome) return;
    onClose();
    try {
      await renameVase(vaseId, nome);
      onRenamed();
    } catch {
      onError();
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={[styles.card, { backgroundColor: theme.surface }]} onPress={() => {}}>
            <Text style={[styles.title, { color: theme.onSurface }]}>Nome vaso</Text>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder="Es. Vaso soggiorno"
              autoFocus
              maxLength={255}
              style={{ marginTop: spacing.sm12, marginBottom: spacing.md16 }}
            />
            <View style={styles.actions}>
              <View style={{ flex: 1 }}>
                <Button label="Annulla" variant="outline" onPress={onClose} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Salva" onPress={confirm} disabled={!value.trim()} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg24 },
  card: { borderRadius: radius.lg, padding: spacing.md20 },
  title: { ...typography.titleSmall },
  actions: { flexDirection: 'row', gap: spacing.sm12 - 2 },
});
