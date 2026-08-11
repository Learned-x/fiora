import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AxiosError } from 'axios';
import { useTheme } from '../src/theme/useTheme';
import { typography } from '../src/theme/typography';
import { spacing } from '../src/theme/spacing';
import { Button } from '../src/components/Button';
import { TextInput } from '../src/components/TextInput';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { changePassword } from '../src/services/user.api';

export default function ChangePasswordScreen() {
  const theme = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit =
    currentPassword.length > 0 && newPassword.length >= 8 && confirmPassword === newPassword;

  async function handleSave() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert('Fatto', 'Password aggiornata.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: { message?: string } }>;
      Alert.alert(
        'Errore',
        axiosErr.response?.data?.error?.message ?? 'Cambio password non riuscito, riprova.'
      );
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScreenHeader back={{ label: 'Indietro' }} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: theme.onSurface }]}>Cambia password</Text>

          <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>PASSWORD ATTUALE</Text>
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
            style={{ marginBottom: spacing.md16 }}
          />

          <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>NUOVA PASSWORD</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Minimo 8 caratteri"
            style={{ marginBottom: spacing.md16 }}
          />

          <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>CONFERMA NUOVA PASSWORD</Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            style={{ marginBottom: spacing.xs8 }}
          />

          {confirmPassword.length > 0 && confirmPassword !== newPassword && (
            <Text style={[styles.mismatch, { color: theme.error }]}>Le password non coincidono.</Text>
          )}

          <View style={{ marginTop: spacing.md16 }}>
            <Button label="Aggiorna password" onPress={handleSave} disabled={!canSubmit} loading={saving} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: spacing.md16, paddingTop: spacing.xs8 },
  title: { ...typography.headlineSmall, marginBottom: spacing.md20 },
  fieldLabel: { ...typography.labelMedium, letterSpacing: 0.5, marginBottom: spacing.xs8 - 2, paddingHorizontal: spacing.xs4 },
  mismatch: { ...typography.bodySmall, paddingHorizontal: spacing.xs4 },
});
