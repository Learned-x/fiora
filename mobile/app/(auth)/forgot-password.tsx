import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { spacing } from '../../src/theme/spacing';
import { TextInput } from '../../src/components/TextInput';
import { Button } from '../../src/components/Button';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { forgotPassword } from '../../src/services/auth.api';

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
      <ScreenHeader />
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.t1 }]}>Password dimenticata</Text>

        {sent ? (
          <>
            <Text style={[styles.subtitle, { color: theme.t2 }]}>
              Se l'indirizzo è registrato, riceverai un'email con le istruzioni per reimpostare la password.
            </Text>
            <View style={styles.actions}>
              <Button label="Torna al login" onPress={() => router.back()} />
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.subtitle, { color: theme.t2 }]}>
              Inserisci l'email con cui ti sei registrato: ti manderemo un link per reimpostare la password.
            </Text>
            <View style={styles.form}>
              <TextInput
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
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
  content: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.6, marginBottom: spacing.sm },
  subtitle: { fontSize: 16, marginBottom: spacing.xxl, lineHeight: 22 },
  form: { gap: spacing.md, marginBottom: spacing.xl },
  actions: { marginBottom: spacing.lg },
});
