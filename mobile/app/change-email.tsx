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
import { spacing } from '../src/theme/spacing';
import { Button } from '../src/components/Button';
import { TextInput } from '../src/components/TextInput';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { changeEmail } from '../src/services/auth.api';
import { useAuthStore } from '../src/store/auth.store';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ChangeEmailScreen() {
  const theme = useTheme();
  const { profile } = useAuthStore();
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit =
    EMAIL_REGEX.test(newEmail) && newEmail !== profile?.email && currentPassword.length > 0;

  async function handleSave() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await changeEmail(newEmail, currentPassword);
      Alert.alert(
        'Controlla la posta',
        `Abbiamo inviato un link di conferma a ${newEmail}. Il tuo indirizzo attuale resta attivo finché non lo confermi.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: { message?: string } }>;
      Alert.alert(
        'Errore',
        axiosErr.response?.data?.error?.message ?? 'Cambio email non riuscito, riprova.'
      );
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScreenHeader />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: theme.t1 }]}>Cambia email</Text>
          <Text style={[styles.sub, { color: theme.t2 }]}>
            Attuale: {profile?.email ?? '—'}
          </Text>

          <Text style={[styles.fieldLabel, { color: theme.t2 }]}>NUOVO INDIRIZZO EMAIL</Text>
          <TextInput
            value={newEmail}
            onChangeText={setNewEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={{ marginBottom: 16 }}
          />

          <Text style={[styles.fieldLabel, { color: theme.t2 }]}>PASSWORD ATTUALE</Text>
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
            style={{ marginBottom: 8 }}
          />

          <View style={{ marginTop: 16 }}>
            <Button label="Invia link di conferma" onPress={handleSave} disabled={!canSubmit} loading={saving} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: spacing.lg, paddingTop: spacing.sm },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, marginBottom: spacing.xs },
  sub: { fontSize: 14, marginBottom: spacing.xl, paddingHorizontal: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: spacing.sm, paddingHorizontal: 4 },
});
