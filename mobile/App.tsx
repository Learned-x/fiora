import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import mqtt from 'mqtt';

export default function App() {
  const [apiStatus, setApiStatus] = useState('In corso...');
  const [mqttStatus, setMqttStatus] = useState('In corso...');

  useEffect(() => {
    // ── Test connessione backend ──────────────────────────────────────────
    fetch(`${process.env.EXPO_PUBLIC_API_URL}/health`)
      .then((res) => res.json())
      .then((data) => setApiStatus(`OK — ${JSON.stringify(data)}`))
      .catch((err) => setApiStatus(`ERRORE — ${err.message}`));

    // ── Test connessione HiveMQ Cloud ─────────────────────────────────────
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fiora — Test connessioni</Text>
      <Text style={styles.label}>Backend API:</Text>
      <Text style={styles.value}>{apiStatus}</Text>
      <Text style={styles.label}>HiveMQ Cloud:</Text>
      <Text style={styles.value}>{mqttStatus}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 30 },
  label: { fontSize: 14, color: '#666', marginTop: 15 },
  value: { fontSize: 16, textAlign: 'center' },
});