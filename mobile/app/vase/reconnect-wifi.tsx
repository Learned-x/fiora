import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { BleManager, Device, State } from 'react-native-ble-plx';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../src/theme/useTheme';
import { spacing } from '../../src/theme/spacing';
import { radius } from '../../src/theme/radius';
import { typography } from '../../src/theme/typography';
import { Button } from '../../src/components/Button';
import { TextInput } from '../../src/components/TextInput';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { getReconnectCredentials, getVase } from '../../src/services/vases.api';
import { connectAndProvision, ensureBlePermissions, friendlyError, parseBrokerUrl } from '../../src/lib/bleProvisioning';

const SCAN_START_DELAY_MS = 2500; // il vaso impiega qualche istante a rientrare in advertising dopo il reset
const SCAN_TIMEOUT_MS = 20000;
const VERIFY_TIMEOUT_MS = 45000;
const VERIFY_INTERVAL_MS = 3000;

type Step =
  | 'starting'
  | 'scanning'
  | 'device-list'
  | 'wifi-form'
  | 'connecting'
  | 'sending'
  | 'verifying'
  | 'done'
  | 'error';

export default function VaseReconnectWifiScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const managerRef = useRef<BleManager | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const [step, setStep] = useState<Step>('starting');
  const [devices, setDevices] = useState<Device[]>([]);
  const [scanActive, setScanActive] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [ssid, setSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  // Dove riporta il tasto Riprova dopo un errore
  const [retryTarget, setRetryTarget] = useState<'scan' | 'wifi-form'>('scan');

  useEffect(() => {
    managerRef.current = new BleManager();
    startTimeoutRef.current = setTimeout(startScan, SCAN_START_DELAY_MS);
    return () => {
      unmountedRef.current = true;
      if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
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
          setErrorMsg('Nessun vaso trovato nelle vicinanze. Controlla che sia acceso e vicino al telefono.');
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

    try {
      const credentials = await getReconnectCredentials(id);
      const { host, port } = parseBrokerUrl(credentials.brokerUrl);
      await connectAndProvision(
        selectedDevice!,
        {
          ssid: ssid.trim(),
          password: wifiPassword,
          device_id: credentials.deviceId,
          mqtt_user: credentials.mqttUsername,
          mqtt_pass: credentials.mqttPassword,
          mqtt_host: host,
          mqtt_port: port,
        },
        () => setStep('sending')
      );
      await verifyVaseOnline();
    } catch (err) {
      // A differenza del primo pairing, il vaso esiste già: nessuna cancellazione,
      // resta nell'app con il suo stato precedente finché non si riprova.
      if (unmountedRef.current) return;
      setErrorMsg(friendlyError(err, 'provision'));
      setRetryTarget('wifi-form'); // SSID e password restano compilati
      setStep('error');
    }
  }

  async function verifyVaseOnline() {
    setStep('verifying');
    const deadline = Date.now() + VERIFY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (unmountedRef.current) return;
      try {
        const vase = await getVase(id);
        if (vase.stato === 'connesso') {
          setStep('done');
          return;
        }
      } catch {
        // errori transitori di rete: continua a provare fino al timeout
      }
      await new Promise((resolve) => setTimeout(resolve, VERIFY_INTERVAL_MS));
    }
    if (!unmountedRef.current) {
      setErrorMsg(
        'Il vaso non risulta ancora online. Se la password WiFi è corretta comparirà connesso entro qualche minuto; altrimenti riprova.'
      );
      setRetryTarget('scan');
      setStep('error');
    }
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScreenHeader back={backVisible ? { label: 'Indietro', onPress: handleExit } : undefined} />

      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.onSurface }]}>Riconfigura WiFi</Text>

        {step === 'starting' && (
          <View style={styles.status}>
            <View style={styles.statusCenter}>
              <ActivityIndicator color={theme.primary} size="large" />
              <Text style={[styles.statusMsg, { color: theme.onSurface }]}>Il vaso si sta disconnettendo…</Text>
            </View>
          </View>
        )}

        {(step === 'scanning' || step === 'device-list') && (
          <View style={styles.form}>
            <Text style={[styles.label, { color: theme.onSurfaceVariant }]}>
              Il vaso è tornato in modalità pairing (LED lampeggiante). Selezionalo per continuare.
            </Text>

            {step === 'scanning' && (
              <View style={styles.inlineStatus}>
                <ActivityIndicator color={theme.primary} />
                <Text style={[styles.statusText, { color: theme.onSurfaceVariant }]}>Ricerca del vaso…</Text>
              </View>
            )}

            {step === 'device-list' && (
              <>
                <Text style={[styles.sectionLabel, { color: theme.onSurfaceVariant }]}>
                  {devices.length === 1 ? 'Vaso trovato — toccalo per continuare' : 'Vasi trovati — tocca il tuo'}
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
                Inserisci la nuova rete WiFi. Deve essere una rete a 2.4 GHz (il vaso non supporta le reti 5 GHz).
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
              <Button label="Riconfigura vaso" onPress={handleConfirmWifi} />
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
              <Text style={[styles.statusTitle, { color: theme.onSurface }]}>Vaso riconnesso!</Text>
              <Text style={[styles.statusText, { color: theme.onSurfaceVariant }]}>
                {selectedDevice?.name} è di nuovo online sulla nuova rete. Pianta collegata e storico sono intatti.
              </Text>
            </View>
            <Button label="Fatto" onPress={() => router.back()} />
          </View>
        )}

        {step === 'error' && (
          <View style={styles.status}>
            <View style={styles.statusCenter}>
              <Text style={styles.statusEmoji}>⚠️</Text>
              <Text style={[styles.statusMsg, { color: theme.onSurface }]}>{errorMsg}</Text>
              <Text style={[styles.statusText, { color: theme.onSurfaceVariant }]}>
                Il vaso non è stato modificato: pianta collegata e storico restano quelli di prima.
              </Text>
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
