import { useEffect, useState } from 'react';
import { Alert, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTheme } from '../../src/theme/useTheme';
import { SocialButton } from '../../src/components/SocialButton';
import { useAuthStore } from '../../src/store/auth.store';
import { GoogleSignInCancelledError, AppleSignInCancelledError } from '../../src/services/oauth';
import { spacing } from '../../src/theme/spacing';
import { radius } from '../../src/theme/radius';
import { typography } from '../../src/theme/typography';

export default function AuthScreen() {
  const theme = useTheme();
  const { loginWithGoogle, loginWithApple, isLoading, error } = useAuthStore();
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  async function handleGoogle() {
    try {
      await loginWithGoogle();
      router.replace('/(tabs)');
    } catch (err) {
      if (err instanceof GoogleSignInCancelledError) return;
      Alert.alert('Login Google fallito', useAuthStore.getState().error ?? 'Riprova più tardi');
    }
  }

  async function handleApple() {
    try {
      await loginWithApple();
      router.replace('/(tabs)');
    } catch (err) {
      if (err instanceof AppleSignInCancelledError) return;
      Alert.alert('Login Apple fallito', useAuthStore.getState().error ?? 'Riprova più tardi');
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.content}>
        <Text style={[styles.progress, { color: theme.onSurfaceVariant }]}>1 di 2</Text>
        <Text style={[styles.title, { color: theme.onSurface }]}>Crea account</Text>
        <Text style={[styles.subtitle, { color: theme.onSurfaceVariant }]}>I tuoi dati sincronizzati ovunque.</Text>

        <View style={styles.buttons}>
          <SocialButton provider="google" label="Continua con Google" onPress={handleGoogle} loading={isLoading} />
          {appleAvailable && (
            <SocialButton provider="apple" label="Continua con Apple" onPress={handleApple} loading={isLoading} />
          )}
        </View>

        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: theme.outlineVariant }]} />
          <Text style={[styles.dividerText, { color: theme.onSurfaceVariant }]}>oppure</Text>
          <View style={[styles.line, { backgroundColor: theme.outlineVariant }]} />
        </View>

        <Pressable
          style={[styles.emailButton, { borderColor: theme.primary }]}
          onPress={() => router.push('/(auth)/login')}
          accessibilityRole="button"
          accessibilityLabel="Continua con email"
        >
          <Text style={[styles.emailButtonText, { color: theme.primary }]}>Continua con email</Text>
        </Pressable>

        {error && <Text style={[styles.error, { color: theme.error }]}>{error}</Text>}

        <Pressable
          style={styles.skip}
          onPress={() => router.push('/(auth)/login')}
          accessibilityRole="button"
          accessibilityLabel="Salta per ora"
        >
          <Text style={[styles.skipText, { color: theme.onSurfaceVariant }]}>Salta per ora</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: spacing.md16, justifyContent: 'center' },
  progress: { ...typography.labelLarge, marginBottom: spacing.xs8 },
  title: { ...typography.headlineMedium, marginBottom: spacing.xs4 + 2 },
  subtitle: { ...typography.bodyLarge, marginBottom: spacing.xl32 },
  buttons: { gap: spacing.sm12 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm12, marginVertical: spacing.lg24 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { ...typography.bodySmall },
  emailButton: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingVertical: 15,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  emailButtonText: { ...typography.titleMedium },
  error: { marginTop: spacing.md16, ...typography.bodySmall, textAlign: 'center' },
  skip: { marginTop: spacing.lg24, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  skipText: { ...typography.bodyLarge },
});
