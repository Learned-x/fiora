import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { TextInput } from '../../src/components/TextInput';
import { Button } from '../../src/components/Button';
import { forgotPassword } from '../../src/services/auth.api';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try {
      await forgotPassword(email.trim());
    } catch {
      // La risposta del backend è sempre positiva: un errore qui è solo di rete.
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.onSurface }]}>Password dimenticata</Text>

        {sent ? (
          <>
            <Text style={[styles.subtitle, { color: theme.onSurfaceVariant }]}>
              Se l'indirizzo è registrato, riceverai un'email con le istruzioni per reimpostare la password.
            </Text>
            <View style={styles.actions}>
              <Button label="Torna al login" onPress={() => router.back()} />
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.subtitle, { color: theme.onSurfaceVariant }]}>
              Inserisci l'email con cui ti sei registrato: ti manderemo un link per reimpostare la password.
            </Text>
            <View style={styles.form}>
              <TextInput
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                accessibilityLabel="Email"
              />
            </View>
            <View style={styles.actions}>
              <Button label="Invia" onPress={handleSubmit} loading={loading} disabled={!email} />
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: spacing.md16, justifyContent: 'center' },
  title: { ...typography.headlineMedium, marginBottom: spacing.xs4 + 2 },
  subtitle: { ...typography.bodyLarge, marginBottom: spacing.xl32 },
  form: { gap: spacing.sm12, marginBottom: spacing.lg24 },
  actions: { marginBottom: spacing.md16 },
});
