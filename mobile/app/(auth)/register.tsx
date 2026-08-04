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
      <ScreenHeader />
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.t1 }]}>Crea account</Text>
        <Text style={[styles.subtitle, { color: theme.t2 }]}>Password minimo 8 caratteri.</Text>

        <View style={styles.form}>
          <TextInput
            placeholder="Nome (opzionale)"
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
          />
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
          <Button
            label="Registrati"
            onPress={handleRegister}
            loading={isLoading}
            disabled={!email || password.length < 8}
          />
        </View>

        <Pressable style={styles.link} onPress={() => router.push('/(auth)/login')}>
          <Text style={[styles.linkText, { color: theme.acc }]}>Hai già un account? Accedi</Text>
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
