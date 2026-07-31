import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { AxiosError } from 'axios';
import { useTheme } from '../src/theme/useTheme';
import { Button } from '../src/components/Button';
import { TextInput } from '../src/components/TextInput';
import { resetPassword } from '../src/services/auth.api';

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = !!token && newPassword.length >= 8 && confirmPassword === newPassword;

  async function handleSave() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await resetPassword(token!, newPassword);
      Alert.alert('Fatto', 'Password aggiornata. Accedi con la nuova password.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: { message?: string } }>;
      Alert.alert(
        'Errore',
        axiosErr.response?.data?.error?.message ?? 'Link non valido o scaduto. Richiedi un nuovo reset dalla schermata di accesso.'
      );
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: theme.t1 }]}>Nuova password</Text>

          {!token && (
            <Text style={[styles.mismatch, { color: theme.red, marginBottom: 16 }]}>
              Link non valido: apri di nuovo l'email di reset password.
            </Text>
          )}

          <Text style={[styles.fieldLabel, { color: theme.t2 }]}>NUOVA PASSWORD</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Minimo 8 caratteri"
            style={{ marginBottom: 16 }}
          />

          <Text style={[styles.fieldLabel, { color: theme.t2 }]}>CONFERMA NUOVA PASSWORD</Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            style={{ marginBottom: 8 }}
          />

          {confirmPassword.length > 0 && confirmPassword !== newPassword && (
            <Text style={[styles.mismatch, { color: theme.red }]}>Le password non coincidono.</Text>
          )}

          <View style={{ marginTop: 16 }}>
            <Button label="Aggiorna password" onPress={handleSave} disabled={!canSubmit} loading={saving} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: 16, paddingTop: 24 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5, marginBottom: 20 },
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6, paddingHorizontal: 4 },
  mismatch: { fontSize: 13, paddingHorizontal: 4 },
});
