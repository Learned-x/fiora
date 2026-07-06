import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import mqtt from 'mqtt';
import { Redirect, router } from 'expo-router';
import { useTheme } from '../src/theme/useTheme';
import { Button } from '../src/components/Button';
import { useAuthStore } from '../src/store/auth.store';

export default function HomeScreen() {
  const theme = useTheme();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [apiStatus, setApiStatus] = useState('In corso...');
  const [mqttStatus, setMqttStatus] = useState('In corso...');

  useEffect(() => {
    fetch(`${process.env.EXPO_PUBLIC_API_URL}/health`)
      .then((res) => res.json())
      .then((data) => setApiStatus(`OK — ${JSON.stringify(data)}`))
      .catch((err) => setApiStatus(`ERRORE — ${err.message}`));

    const client = mqtt.connect(process.env.EXPO_PUBLIC_MQTT_URL!, {
      username: process.env.EXPO_PUBLIC_MQTT_USERNAME,
      password: process.env.EXPO_PUBLIC_MQTT_PASSWORD,
    });

    client.on('connect', () => setMqttStatus('OK — connesso a HiveMQ Cloud'));
    client.on('error', (err) => setMqttStatus(`ERRORE — ${err.message}`));

    return () => {
      client.end();
    };
  }, []);

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/climate');
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/climate" />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.t1 }]}>Benvenuto in Fiora</Text>
        <Text style={[styles.email, { color: theme.t2 }]}>{user?.email ?? 'Utente'}</Text>

        <View style={styles.debug}>
          <Text style={[styles.label, { color: theme.t2 }]}>Backend API:</Text>
          <Text style={[styles.value, { color: theme.t1 }]}>{apiStatus}</Text>
          <Text style={[styles.label, { color: theme.t2 }]}>HiveMQ Cloud:</Text>
          <Text style={[styles.value, { color: theme.t1 }]}>{mqttStatus}</Text>
        </View>

        <View style={styles.actions}>
          <Button label="Esci" variant="outline" onPress={handleLogout} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 16, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginBottom: 6, textAlign: 'center' },
  email: { fontSize: 15, textAlign: 'center', marginBottom: 40 },
  debug: { marginBottom: 40 },
  label: { fontSize: 13, marginTop: 12 },
  value: { fontSize: 14 },
  actions: { marginTop: 20 },
});
