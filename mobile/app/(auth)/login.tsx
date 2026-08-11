import { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { TextInput } from '../../src/components/TextInput';
import { Button } from '../../src/components/Button';
import { useAuthStore } from '../../src/store/auth.store';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function LoginScreen() {
  const theme = useTheme();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleLogin() {
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Accesso fallito', useAuthStore.getState().error ?? 'Credenziali non valide');
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.onSurface }]}>Accedi</Text>
        <Text style={[styles.subtitle, { color: theme.onSurfaceVariant }]}>Inserisci le tue credenziali.</Text>

        <View style={styles.form}>
          <TextInput
            label="Email"
            placeholder="mario@esempio.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            label="Password"
            placeholder="La tua password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <View style={styles.actions}>
          <Button label="Accedi" onPress={handleLogin} loading={isLoading} disabled={!email || !password} />
        </View>

        <Pressable
          style={styles.link}
          onPress={() => router.push('/(auth)/forgot-password')}
          accessibilityRole="button"
          accessibilityLabel="Password dimenticata?"
        >
          <Text style={[styles.linkText, { color: theme.primary }]}>Password dimenticata?</Text>
        </Pressable>

        <Pressable
          style={styles.link}
          onPress={() => router.push('/(auth)/register')}
          accessibilityRole="button"
          accessibilityLabel="Non hai un account? Registrati"
        >
          <Text style={[styles.linkText, { color: theme.primary }]}>Non hai un account? Registrati</Text>
        </Pressable>
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
  link: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  linkText: { ...typography.bodyLarge, fontWeight: '500' },
});
