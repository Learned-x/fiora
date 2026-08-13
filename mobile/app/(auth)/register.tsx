import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { TextInput } from '../../src/components/TextInput';
import { Button } from '../../src/components/Button';
import { useAuthStore } from '../../src/store/auth.store';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function RegisterScreen() {
  const theme = useTheme();
  const { register, isLoading } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleRegister() {
    try {
      await register(email.trim(), password, name.trim() || undefined);
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Registrazione fallita', useAuthStore.getState().error ?? 'Riprova più tardi');
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.onSurface }]}>Crea account</Text>
        <Text style={[styles.subtitle, { color: theme.onSurfaceVariant }]}>Password minimo 8 caratteri.</Text>

        <View style={styles.form}>
          <TextInput
            label="Nome (opzionale)"
            placeholder="Come ti chiami"
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
          />
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
            placeholder="Minimo 8 caratteri"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <View style={styles.actions}>
          <Button
            label="Registrati"
            onPress={handleRegister}
            loading={isLoading}
            disabled={!email || password.length < 8}
          />
        </View>

        <Pressable
          style={styles.link}
          onPress={() => router.push('/(auth)/login')}
          accessibilityRole="button"
          accessibilityLabel="Hai già un account? Accedi"
        >
          <Text style={[styles.linkText, { color: theme.primary }]}>Hai già un account? Accedi</Text>
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
