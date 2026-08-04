import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { AxiosError } from 'axios';
import { useTheme } from '../src/theme/useTheme';
import { verifyEmail } from '../src/services/auth.api';
import { useAuthStore } from '../src/store/auth.store';

export default function VerifyEmailScreen() {
  const theme = useTheme();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { refreshProfile } = useAuthStore();
  const [status, setStatus] = useState<'checking' | 'error'>('checking');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    verifyEmail(token)
      .then(async () => {
        await refreshProfile();
        Alert.alert('Fatto', 'Il tuo nuovo indirizzo email è stato confermato.', [
          { text: 'OK', onPress: () => router.replace('/(tabs)/settings') },
        ]);
      })
      .catch((err) => {
        const axiosErr = err as AxiosError<{ error?: { message?: string } }>;
        setStatus('error');
        Alert.alert(
          'Errore',
          axiosErr.response?.data?.error?.message ?? 'Link non valido o scaduto. Richiedi un nuovo cambio email dalle Impostazioni.'
        );
      });
  }, [token]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={styles.content}>
        {status === 'checking' ? (
          <>
            <ActivityIndicator color={theme.acc} />
            <Text style={[styles.text, { color: theme.t2 }]}>Conferma in corso…</Text>
          </>
        ) : (
          <Text style={[styles.text, { color: theme.t2 }]}>Link non valido.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  text: { fontSize: 15 },
});
