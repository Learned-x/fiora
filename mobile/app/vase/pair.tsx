import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BleError, BleErrorCode, BleManager, Device, State } from 'react-native-ble-plx';
import { isAxiosError } from 'axios';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme/useTheme';
import { spacing } from '../../src/theme/spacing';
import { radius } from '../../src/theme/radius';
import { typography } from '../../src/theme/typography';
import { Button } from '../../src/components/Button';
import { TextInput } from '../../src/components/TextInput';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { startPairing, getVase, deleteVase, renameVase, PairingCredentials } from '../../src/services/vases.api';

// Deve combaciare con firmware/vaso/ble_provisioning.cpp
const PROV_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const PROV_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

const SCAN_TIMEOUT_MS = 20000;
const VERIFY_TIMEOUT_MS = 45000;
const VERIFY_INTERVAL_MS = 3000;

type Step =
  | 'scanning'
  | 'device-list'
  | 'wifi-form'
  | 'connecting'
  | 'sending'
  | 'verifying'
  | 'done'
  | 'done-unverified'
  | 'error';

// btoa gestisce solo latin1: SSID/password con caratteri non ASCII lo rompono.
// Encoder base64 UTF-8 senza dipendenze.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function utf8ToBase64(str: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.codePointAt(i)!;
    if (code > 0xffff) i++;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? '=' : B64[c & 63];
  }
  return out;
}

// Il backend restituisce es. "mqtts://host:8883"; il firmware vuole host e porta separati.
function parseBrokerUrl(brokerUrl: string): { host: string; port: number } {
  const match = brokerUrl.match(/^mqtts?:\/\/([^:/]+):(\d+)/);
  if (!match) {
    throw new Error(`brokerUrl in formato inatteso: ${brokerUrl}`);
  }
  return { host: match[1], port: Number(match[2]) };
}

function friendlyError(err: unknown, context: 'scan' | 'provision'): string {
  if (err instanceof BleError) {
    switch (err.errorCode) {
      case BleErrorCode.BluetoothPoweredOff:
        return 'Il Bluetooth è spento. Attivalo dalle impostazioni del telefono e riprova.';
      case BleErrorCode.BluetoothUnauthorized:
        return 'Fiora non ha il permesso di usare il Bluetooth. Concedilo da Impostazioni > Fiora.';
      case BleErrorCode.BluetoothUnsupported:
        return 'Questo dispositivo non supporta il Bluetooth LE.';
      case BleErrorCode.DeviceDisconnected:
      case BleErrorCode.DeviceConnectionFailed:
        return 'Connessione con il vaso persa. Avvicina il telefono al vaso e riprova.';
      case BleErrorCode.OperationTimedOut:
        return 'Il vaso non risponde. Controlla che sia acceso e vicino al telefono.';
      case BleErrorCode.CharacteristicWriteFailed:
        return 'Invio delle credenziali fallito. Riavvia il vaso per rimetterlo in modalità pairing e riprova.';
    }
    return context === 'scan'
      ? 'Errore Bluetooth durante la ricerca. Riprova.'
      : 'Errore Bluetooth durante il collegamento. Riprova.';
  }
  if (isAxiosError(err)) {
    const backendMsg = err.response?.data?.error?.message;
    if (backendMsg) return backendMsg;
    return 'Impossibile contattare il server. Controlla la connessione a internet e riprova.';
  }
  return context === 'scan' ? 'Errore imprevisto durante la ricerca. Riprova.' : 'Errore imprevisto durante il collegamento. Riprova.';
}

async function ensureBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  // BLUETOOTH_SCAN/BLUETOOTH_CONNECT esistono solo da API 31 (Android 12).
  // Richiederli su OS precedenti (es. Android 10, API 29) può risultare in
  // 'denied' per un permesso che il sistema non riconosce, bloccando lo scan
  // anche se ACCESS_FINE_LOCATION (l'unico che serve lì) è concesso.
  const permissions =
    Platform.Version >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const granted = await PermissionsAndroid.requestMultiple(permissions);
  return Object.values(granted).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
}

export default function VasePairScreen() {
  const theme = useTheme();
  const managerRef = useRef<BleManager | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const [step, setStep] = useState<Step>('scanning');
  const [devices, setDevices] = useState<Device[]>([]);
  const [scanActive, setScanActive] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [ssid, setSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [pairedVaseId, setPairedVaseId] = useState<string | null>(null);
  const [vaseName, setVaseName] = useState('');
  const [savingName, setSavingName] = useState(false);
  // Dove riporta il tasto Riprova dopo un errore
  const [retryTarget, setRetryTarget] = useState<'scan' | 'wifi-form'>('scan');

  useEffect(() => {
    managerRef.current = new BleManager();
    startScan();
    return () => {
      unmountedRef.current = true;
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      managerRef.current?.stopDeviceScan();
      managerRef.current?.destroy();
    };
  }, []);

  function stopScan() {
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    managerRef.current?.stopDeviceScan();
    setScanActive(false);
  }

  function failScan(message: string) {
    stopScan();
    setErrorMsg(message);
    setRetryTarget('scan');
    setStep('error');
  }

  async function startScan() {
    const hasPermissions = await ensureBlePermissions();
    if (unmountedRef.current) return;
    if (!hasPermissions) {
      failScan('Fiora non ha il permesso di usare il Bluetooth. Concedilo dalle impostazioni del telefono.');
      return;
    }

    const btState = await managerRef.current!.state();
    if (unmountedRef.current) return;
    if (btState !== State.PoweredOn) {
      failScan(
        btState === State.Unsupported
          ? 'Questo dispositivo non supporta il Bluetooth LE.'
          : 'Il Bluetooth è spento. Attivalo dalle impostazioni del telefono e riprova.'
      );
      return;
    }

    setDevices([]);
    setSelectedDevice(null);
    setErrorMsg('');
    setScanActive(true);
    setStep('scanning');

    managerRef.current!.startDeviceScan(null, null, (error, device) => {
      if (error) {
        failScan(friendlyError(error, 'scan'));
        return;
      }
      if (device?.name?.startsWith('Fiora-')) {
        setDevices((prev) => (prev.some((d) => d.id === device.id) ? prev : [...prev, device]));
        setStep((current) => (current === 'scanning' ? 'device-list' : current));
      }
    });

    scanTimeoutRef.current = setTimeout(() => {
      managerRef.current?.stopDeviceScan();
      setScanActive(false);
      setStep((current) => {
        if (current === 'scanning') {
          setErrorMsg('Nessun vaso trovato nelle vicinanze. Controlla che sia acceso e in modalità pairing (LED lampeggiante).');
          setRetryTarget('scan');
          return 'error';
        }
        return current; // device-list: la lista resta, la scansione si ferma
      });
    }, SCAN_TIMEOUT_MS);
  }

  function handleSelectDevice(device: Device) {
    stopScan();
    setSelectedDevice(device);
    setStep('wifi-form');
  }

  async function handleConfirmWifi() {
    if (!ssid.trim()) {
      Alert.alert('Rete mancante', 'Inserisci il nome della rete WiFi (SSID).');
      return;
    }
    if (!wifiPassword) {
      Alert.alert('Password mancante', 'Inserisci la password della rete WiFi.');
      return;
    }

    setStep('connecting');
    setErrorMsg('');

    let credentials: PairingCredentials | null = null;
    try {
      credentials = await startPairing();
      setPairedVaseId(credentials.vaseId);
      const { host, port } = parseBrokerUrl(credentials.brokerUrl);
      await connectAndProvision(selectedDevice!, {
        ssid: ssid.trim(),
        password: wifiPassword,
        device_id: credentials.deviceId,
        mqtt_user: credentials.mqttUsername,
        mqtt_pass: credentials.mqttPassword,
        mqtt_host: host,
        mqtt_port: port,
      });
      await verifyVaseOnline(credentials.vaseId);
    } catch (err) {
      // Il vaso creato dal pairing non ha mai parlato: rimuovilo per non lasciare orfani
      if (credentials) {
        deleteVase(credentials.vaseId).catch(() => {});
      }
      if (unmountedRef.current) return;
      setErrorMsg(friendlyError(err, 'provision'));
      setRetryTarget('wifi-form'); // SSID e password restano compilati
      setStep('error');
    }
  }

  async function connectAndProvision(
    device: Device,
    payload: {
      ssid: string;
      password: string;
      device_id: string;
      mqtt_user: string;
      mqtt_pass: string;
      mqtt_host: string;
      mqtt_port: number;
    }
  ) {
    // MTU alto: il payload JSON supera i 20 byte del default BLE (iOS lo negozia da solo)
    const connected = await device.connect({ requestMTU: 512 });
    await connected.discoverAllServicesAndCharacteristics();

    setStep('sending');

    const base64Payload = utf8ToBase64(JSON.stringify(payload));

    await connected.writeCharacteristicWithResponseForService(
      PROV_SERVICE_UUID,
      PROV_CHARACTERISTIC_UUID,
      base64Payload
    );

    await connected.cancelConnection().catch(() => {});
  }

  // Il provisioning BLE è andato: aspetta che il vaso si connetta davvero a MQTT
  async function verifyVaseOnline(vaseId: string) {
    setStep('verifying');
    const deadline = Date.now() + VERIFY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (unmountedRef.current) return;
      try {
        const vase = await getVase(vaseId);
        if (vase.stato === 'connesso') {
          setStep('done');
          return;
        }
      } catch {
        // errori transitori di rete: continua a provare fino al timeout
      }
      await new Promise((resolve) => setTimeout(resolve, VERIFY_INTERVAL_MS));
    }
    if (!unmountedRef.current) setStep('done-unverified');
  }

  function handleRetry() {
    if (retryTarget === 'wifi-form' && selectedDevice) {
      setStep('wifi-form');
    } else {
      startScan();
    }
  }

  function handleExit() {
    stopScan();
    router.back();
  }

  // Durante connessione/invio/verifica non si esce: interrompere a metà lascia il vaso a metà configurazione
  const backVisible = step !== 'connecting' && step !== 'sending' && step !== 'verifying';
  const busy = step === 'scanning' || step === 'connecting' || step === 'sending' || step === 'verifying';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScreenHeader back={backVisible ? { label: 'Indietro', onPress: handleExit } : undefined} />

      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.onSurface }]}>Collega vaso smart</Text>

        {(step === 'scanning' || step === 'device-list') && (
          <View style={styles.form}>
            <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>
              Accendi il vaso e assicurati che sia in modalità pairing (LED lampeggiante).
            </Text>

            {step === 'scanning' && (
              <View style={styles.inlineStatus}>
                <ActivityIndicator color={theme.primary} />
                <Text style={[styles.statusText, { color: theme.onSurfaceVariant }]}>Ricerca vasi nelle vicinanze…</Text>
              </View>
            )}

            {step === 'device-list' && (
              <>
                <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>
                  {devices.length === 1 ? 'Vaso trovato — toccalo per collegarlo' : 'Vasi trovati — tocca il tuo'}
                </Text>
                <FlatList
                  data={devices}
                  keyExtractor={(d) => d.id}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => handleSelectDevice(item)}
                      style={[styles.deviceRow, { backgroundColor: theme.surface, borderColor: theme.outline }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Collega ${item.name}`}
                    >
                      <Text style={{ fontSize: 20 }}>🪴</Text>
                      <Text style={[styles.deviceName, { color: theme.onSurface }]}>{item.name}</Text>
                      <Svg width={8} height={13} viewBox="0 0 9 15" fill="none" style={{ marginLeft: 'auto' }}>
                        <Path d="M1 1L7.5 7.5L1 14" stroke={theme.onSurfaceVariant} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </Pressable>
                  )}
                  ListFooterComponent={
                    scanActive ? (
                      <View style={styles.inlineStatus}>
                        <ActivityIndicator color={theme.primary} size="small" />
                        <Text style={[styles.footerText, { color: theme.onSurfaceVariant }]}>Ricerca di altri vasi…</Text>
                      </View>
                    ) : (
                      <View style={{ marginTop: spacing.sm12 }}>
                        <Button label="Cerca di nuovo" onPress={startScan} variant="outline" />
                      </View>
                    )
                  }
                />
              </>
            )}
          </View>
        )}

        {step === 'wifi-form' && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.form}>
              <View style={[styles.selectedBox, { backgroundColor: theme.surface, borderColor: theme.outline }]}>
                <Text style={{ fontSize: 20 }}>🪴</Text>
                <Text style={[styles.deviceName, { color: theme.onSurface }]}>{selectedDevice?.name}</Text>
              </View>
              <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>
                Inserisci la rete WiFi a cui è connesso il telefono: il vaso userà la stessa rete. Deve essere una rete
                a 2.4 GHz (il vaso non supporta le reti 5 GHz).
              </Text>
              <TextInput
                placeholder="Nome rete WiFi (SSID)"
                value={ssid}
                onChangeText={setSsid}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                placeholder="Password WiFi"
                value={wifiPassword}
                onChangeText={setWifiPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button label="Collega vaso" onPress={handleConfirmWifi} />
              <Button label="Scegli un altro vaso" onPress={startScan} variant="outline" />
            </View>
          </KeyboardAvoidingView>
        )}

        {step === 'connecting' && (
          <View style={styles.status}>
            <View style={styles.statusCenter}>
              <ActivityIndicator color={theme.primary} size="large" />
              <Text style={[styles.statusMsg, { color: theme.onSurface }]}>Connessione a {selectedDevice?.name}…</Text>
            </View>
          </View>
        )}

        {step === 'sending' && (
          <View style={styles.status}>
            <View style={styles.statusCenter}>
              <ActivityIndicator color={theme.primary} size="large" />
              <Text style={[styles.statusMsg, { color: theme.onSurface }]}>Invio credenziali al vaso…</Text>
            </View>
          </View>
        )}

        {step === 'verifying' && (
          <View style={styles.status}>
            <View style={styles.statusCenter}>
              <ActivityIndicator color={theme.primary} size="large" />
              <Text style={[styles.statusMsg, { color: theme.onSurface }]}>
                Credenziali inviate. In attesa che il vaso si connetta alla rete…
              </Text>
              <Text style={[styles.footerText, { color: theme.onSurfaceVariant }]}>Può volerci fino a un minuto.</Text>
            </View>
          </View>
        )}

        {step === 'done' && (
          <View style={styles.status}>
            <View style={styles.statusCenter}>
              <Text style={styles.statusEmoji}>✅</Text>
              <Text style={[styles.statusTitle, { color: theme.onSurface }]}>Vaso collegato!</Text>
              <Text style={[styles.statusText, { color: theme.onSurfaceVariant }]}>
                {selectedDevice?.name} è online e sta inviando i dati dei sensori.
              </Text>
              <TextInput
                label="Nome del vaso"
                placeholder="Es. Vaso soggiorno"
                value={vaseName}
                onChangeText={setVaseName}
                autoFocus
                maxLength={255}
                style={styles.nameInput}
              />
            </View>
            <Button
              label="Fatto"
              loading={savingName}
              onPress={async () => {
                const nome = vaseName.trim();
                if (nome && pairedVaseId) {
                  setSavingName(true);
                  try {
                    await renameVase(pairedVaseId, nome);
                  } catch {
                    // il vaso resta collegato e funzionante: si potrà rinominare dal dettaglio
                  }
                }
                router.back();
              }}
            />
          </View>
        )}

        {step === 'done-unverified' && (
          <View style={styles.status}>
            <View style={styles.statusCenter}>
              <Text style={styles.statusEmoji}>⏳</Text>
              <Text style={[styles.statusTitle, { color: theme.onSurface }]}>Credenziali inviate</Text>
              <Text style={[styles.statusText, { color: theme.onSurfaceVariant }]}>
                Il vaso non risulta ancora online. Se la password WiFi è corretta comparirà tra i tuoi vasi entro
                qualche minuto; altrimenti rimettilo in modalità pairing e riprova.
              </Text>
            </View>
            <Button label="Chiudi" onPress={() => router.back()} />
          </View>
        )}

        {step === 'error' && (
          <View style={styles.status}>
            <View style={styles.statusCenter}>
              <Text style={styles.statusEmoji}>⚠️</Text>
              <Text style={[styles.statusMsg, { color: theme.onSurface }]}>{errorMsg}</Text>
            </View>
            <Button label="Riprova" onPress={handleRetry} />
            <Button label="Annulla" onPress={handleExit} variant="outline" />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: spacing.md16 },
  title: { ...typography.headlineSmall, letterSpacing: -0.5, marginBottom: spacing.lg24 - 4 },
  form: { gap: spacing.sm12, flex: 1 },
  label: { ...typography.bodyMedium, lineHeight: 20 },
  sectionLabel: { ...typography.labelMedium, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: spacing.xs8 },
  status: { alignItems: 'stretch', gap: spacing.md16, paddingTop: spacing.xl32 + 8, paddingHorizontal: spacing.xs8 },
  statusCenter: { alignItems: 'center', gap: spacing.xs8 },
  statusTitle: { ...typography.titleMedium },
  statusMsg: { ...typography.bodyLarge, textAlign: 'center' },
  statusText: { ...typography.bodyMedium, textAlign: 'center', lineHeight: 21 },
  statusEmoji: { fontSize: 44 },
  nameInput: { alignSelf: 'stretch', marginTop: spacing.sm12, width: '100%' },
  inlineStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm12 - 2, paddingVertical: spacing.lg24 - 4 },
  footerText: { ...typography.bodySmall, textAlign: 'center' },
  selectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm12,
    padding: spacing.sm12 + 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 44,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm12,
    padding: spacing.sm12 + 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm12 - 2,
    minHeight: 44,
  },
  deviceName: { ...typography.bodyLarge, fontWeight: '500' },
});
