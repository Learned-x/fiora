import { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { TextInput } from '../../src/components/TextInput';
import { Button } from '../../src/components/Button';
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
  content: { flex: 1, padding: 16, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { fontSize: 15, marginBottom: 32 },
  form: { gap: 12, marginBottom: 24 },
  actions: { marginBottom: 16 },
  link: { alignItems: 'center' },
  linkText: { fontSize: 15, fontWeight: '500' },
});
