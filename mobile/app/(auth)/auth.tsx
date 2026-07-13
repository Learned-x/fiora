import { Alert, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { SocialButton } from '../../src/components/SocialButton';
import { useAuthStore } from '../../src/store/auth.store';
import { GoogleSignInCancelledError } from '../../src/services/oauth';

export default function AuthScreen() {
  const theme = useTheme();
  const { loginWithGoogle, isLoading, error } = useAuthStore();

  async function handleGoogle() {
    try {
      await loginWithGoogle();
      router.replace('/(tabs)');
    } catch (err) {
      if (err instanceof GoogleSignInCancelledError) return;
      Alert.alert('Login Google fallito', useAuthStore.getState().error ?? 'Riprova più tardi');
    }
  }

  function handleApple() {
    Alert.alert('Sign in with Apple', 'Disponibile a breve — credenziali Apple in attesa.');
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.content}>
        <Text style={[styles.progress, { color: theme.t2 }]}>1 di 2</Text>
        <Text style={[styles.title, { color: theme.t1 }]}>Crea account</Text>
        <Text style={[styles.subtitle, { color: theme.t2 }]}>I tuoi dati sincronizzati ovunque.</Text>

        <View style={styles.buttons}>
          <SocialButton provider="google" label="Continua con Google" onPress={handleGoogle} loading={isLoading} />
          <SocialButton provider="apple" label="Continua con Apple" onPress={handleApple} />
        </View>

        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: theme.bord }]} />
          <Text style={[styles.dividerText, { color: theme.t2 }]}>oppure</Text>
          <View style={[styles.line, { backgroundColor: theme.bord }]} />
        </View>

        <Pressable
          style={[styles.emailButton, { borderColor: theme.acc }]}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={[styles.emailButtonText, { color: theme.acc }]}>Continua con email</Text>
        </Pressable>

        {error && <Text style={[styles.error, { color: theme.red }]}>{error}</Text>}

        <Pressable style={styles.skip} onPress={() => router.push('/(auth)/login')}>
          <Text style={[styles.skipText, { color: theme.t2 }]}>Salta per ora</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 16, justifyContent: 'center' },
  progress: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginBottom: 6 },
  subtitle: { fontSize: 15, marginBottom: 32 },
  buttons: { gap: 12 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 13 },
  emailButton: {
    borderRadius: 13,
    borderWidth: 1.5,
    paddingVertical: 15,
    alignItems: 'center',
  },
  emailButtonText: { fontSize: 16, fontWeight: '600' },
  error: { marginTop: 16, fontSize: 13, textAlign: 'center' },
  skip: { marginTop: 24, alignItems: 'center' },
  skipText: { fontSize: 15 },
});
