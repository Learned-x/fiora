import { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { spacing } from '../../src/theme/spacing';
import { TextInput } from '../../src/components/TextInput';
import { Button } from '../../src/components/Button';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useAuthStore } from '../../src/store/auth.store';

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
      <ScreenHeader />
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.t1 }]}>Accedi</Text>
        <Text style={[styles.subtitle, { color: theme.t2 }]}>Inserisci le tue credenziali.</Text>

        <View style={styles.form}>
          <TextInput
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <View style={styles.actions}>
          <Button label="Accedi" onPress={handleLogin} loading={isLoading} disabled={!email || !password} />
        </View>

        <Pressable style={styles.link} onPress={() => router.push('/(auth)/forgot-password')}>
          <Text style={[styles.linkText, { color: theme.acc }]}>Password dimenticata?</Text>
        </Pressable>

        <Pressable style={styles.link} onPress={() => router.push('/(auth)/register')}>
          <Text style={[styles.linkText, { color: theme.acc }]}>Non hai un account? Registrati</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.6, marginBottom: spacing.sm },
  subtitle: { fontSize: 16, marginBottom: spacing.xxl },
  form: { gap: spacing.md, marginBottom: spacing.xl },
  actions: { marginBottom: spacing.lg },
  link: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 15, fontWeight: '600' },
});
