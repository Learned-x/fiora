import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { AxiosError } from 'axios';
import { useTheme } from '../src/theme/useTheme';
import { typography } from '../src/theme/typography';
import { spacing } from '../src/theme/spacing';
import { Button } from '../src/components/Button';
import { TextInput } from '../src/components/TextInput';
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
      <View style={styles.nav}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Indietro"
          hitSlop={8}
          style={styles.backBtn}
        >
          <Svg width={9} height={15} viewBox="0 0 9 15" fill="none">
            <Path d="M8 1L1.5 7.5L8 14" stroke={theme.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={{ fontSize: 17, color: theme.primary }}>Indietro</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: theme.onSurface }]}>Cambia email</Text>
          <Text style={[styles.sub, { color: theme.onSurfaceVariant }]}>
            Attuale: {profile?.email ?? '—'}
          </Text>

          <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>NUOVO INDIRIZZO EMAIL</Text>
          <TextInput
            value={newEmail}
            onChangeText={setNewEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={{ marginBottom: spacing.md16 }}
          />

          <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>PASSWORD ATTUALE</Text>
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
            style={{ marginBottom: spacing.xs8 }}
          />

          <View style={{ marginTop: spacing.md16 }}>
            <Button label="Invia link di conferma" onPress={handleSave} disabled={!canSubmit} loading={saving} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  nav: { paddingHorizontal: spacing.md16, paddingTop: spacing.sm12 + 2, paddingBottom: spacing.xs8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs4 - 1, alignSelf: 'flex-start', minHeight: 44 },
  form: { padding: spacing.md16, paddingTop: spacing.xs8 },
  title: { ...typography.headlineSmall, marginBottom: spacing.xs8 - 2 },
  sub: { ...typography.bodyMedium, marginBottom: spacing.md20, paddingHorizontal: spacing.xs4 },
  fieldLabel: { ...typography.labelMedium, letterSpacing: 0.5, marginBottom: spacing.xs8 - 2, paddingHorizontal: spacing.xs4 },
});
