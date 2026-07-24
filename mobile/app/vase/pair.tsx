import { useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BleManager, Device } from 'react-native-ble-plx';
import { useTheme } from '../../src/theme/useTheme';
import { Button } from '../../src/components/Button';
import { TextInput } from '../../src/components/TextInput';
import { startPairing } from '../../src/services/vases.api';

// Deve combaciare con firmware/vaso/vaso.ino
const PROV_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const PROV_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

type Step = 'wifi-form' | 'scanning' | 'connecting' | 'sending' | 'done' | 'error';

async function ensureBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ]);
  return Object.values(granted).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
}

export default function VasePairScreen() {
  const theme = useTheme();
  const managerRef = useRef<BleManager | null>(null);
  const [ssid, setSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [step, setStep] = useState<Step>('wifi-form');
  const [errorMsg, setErrorMsg] = useState('');
  const [foundDeviceName, setFoundDeviceName] = useState('');

  useEffect(() => {
    managerRef.current = new BleManager();
    return () => {
      managerRef.current?.stopDeviceScan();
      managerRef.current?.destroy();
    };
  }, []);

  async function handleStart() {
    if (!ssid.trim() || !wifiPassword) {
      Alert.alert('Dati mancanti', 'Inserisci SSID e password del WiFi.');
      return;
    }

    const hasPermissions = await ensureBlePermissions();
    if (!hasPermissions) {
      Alert.alert('Permessi mancanti', 'Servono i permessi Bluetooth per collegare il vaso.');
      return;
    }

    setStep('scanning');
    setErrorMsg('');

    try {
      const credentials = await startPairing();
      const manager = managerRef.current!;

      manager.startDeviceScan(null, null, async (error, device) => {
        if (error) {
          manager.stopDeviceScan();
          setErrorMsg(error.message);
          setStep('error');
          return;
        }

        if (device?.name?.startsWith('Fiora-')) {
          manager.stopDeviceScan();
          setFoundDeviceName(device.name);
          setStep('connecting');

          try {
            await connectAndProvision(device, {
              ssid: ssid.trim(),
              password: wifiPassword,
              device_id: credentials.deviceId,
              mqtt_username: credentials.mqttUsername,
              mqtt_password: credentials.mqttPassword,
            });
            setStep('done');
          } catch (err: any) {
            setErrorMsg(err?.message ?? 'Errore durante il provisioning');
            setStep('error');
          }
        }
      });

      // Timeout scansione: 20s
      setTimeout(() => {
        if (step === 'scanning') {
          manager.stopDeviceScan();
          setErrorMsg('Nessun vaso trovato nelle vicinanze. Assicurati che sia acceso e in modalità pairing.');
          setStep('error');
        }
      }, 20000);
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Impossibile avviare il pairing');
      setStep('error');
    }
  }

  async function connectAndProvision(
    device: Device,
    payload: {
      ssid: string;
      password: string;
      device_id: string;
      mqtt_username: string;
      mqtt_password: string;
    }
  ) {
    const connected = await device.connect();
    await connected.discoverAllServicesAndCharacteristics();

    setStep('sending');

    const json = JSON.stringify(payload);
    const base64Payload = btoa(json);

    await connected.writeCharacteristicWithResponseForService(
      PROV_SERVICE_UUID,
      PROV_CHARACTERISTIC_UUID,
      base64Payload
    );

    await connected.cancelConnection();
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.t1 }]}>Collega vaso smart</Text>

        {step === 'wifi-form' && (
          <View style={styles.form}>
            <Text style={[styles.label, { color: theme.t2 }]}>
              Assicurati che il vaso sia acceso e in modalità pairing (LED lampeggiante), poi inserisci la tua rete WiFi.
            </Text>
            <TextInput placeholder="Nome rete WiFi (SSID)" value={ssid} onChangeText={setSsid} autoCapitalize="none" />
            <TextInput
              placeholder="Password WiFi"
              value={wifiPassword}
              onChangeText={setWifiPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <Button label="Cerca vaso nelle vicinanze" onPress={handleStart} />
          </View>
        )}

        {step === 'scanning' && (
          <View style={styles.status}>
            <Text style={[styles.statusText, { color: theme.t1 }]}>Ricerca vaso in corso…</Text>
          </View>
        )}

        {step === 'connecting' && (
          <View style={styles.status}>
            <Text style={[styles.statusText, { color: theme.t1 }]}>Trovato {foundDeviceName}, connessione…</Text>
          </View>
        )}

        {step === 'sending' && (
          <View style={styles.status}>
            <Text style={[styles.statusText, { color: theme.t1 }]}>Invio credenziali al vaso…</Text>
          </View>
        )}

        {step === 'done' && (
          <View style={styles.status}>
            <Text style={[styles.statusText, { color: theme.t1 }]}>
              Credenziali inviate. Il vaso si sta riavviando e connettendo alla rete — potrebbe volerci qualche secondo.
            </Text>
            <Button label="Fatto" onPress={() => router.back()} />
          </View>
        )}

        {step === 'error' && (
          <View style={styles.status}>
            <Text style={[styles.statusText, { color: theme.red }]}>{errorMsg}</Text>
            <Button label="Riprova" onPress={() => setStep('wifi-form')} variant="outline" />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5, marginBottom: 20 },
  form: { gap: 12 },
  label: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  status: { alignItems: 'center', gap: 16, paddingTop: 40 },
  statusText: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
});
