import { PermissionsAndroid, Platform } from 'react-native';
import { BleError, BleErrorCode, Device } from 'react-native-ble-plx';
import { isAxiosError } from 'axios';

// Deve combaciare con firmware/vaso/ble_provisioning.cpp
export const PROV_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const PROV_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

export interface ProvisioningPayload {
  ssid: string;
  password: string;
  device_id: string;
  mqtt_user: string;
  mqtt_pass: string;
  mqtt_host: string;
  mqtt_port: number;
}

// btoa gestisce solo latin1: SSID/password con caratteri non ASCII lo rompono.
// Encoder base64 UTF-8 senza dipendenze.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function utf8ToBase64(str: string): string {
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
export function parseBrokerUrl(brokerUrl: string): { host: string; port: number } {
  const match = brokerUrl.match(/^mqtts?:\/\/([^:/]+):(\d+)/);
  if (!match) {
    throw new Error(`brokerUrl in formato inatteso: ${brokerUrl}`);
  }
  return { host: match[1], port: Number(match[2]) };
}

export function friendlyError(err: unknown, context: 'scan' | 'provision'): string {
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

export async function ensureBlePermissions(): Promise<boolean> {
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

export async function connectAndProvision(
  device: Device,
  payload: ProvisioningPayload,
  onSending?: () => void
): Promise<void> {
  // MTU alto: il payload JSON supera i 20 byte del default BLE (iOS lo negozia da solo)
  const connected = await device.connect({ requestMTU: 512 });
  await connected.discoverAllServicesAndCharacteristics();

  onSending?.();

  const base64Payload = utf8ToBase64(JSON.stringify(payload));

  await connected.writeCharacteristicWithResponseForService(
    PROV_SERVICE_UUID,
    PROV_CHARACTERISTIC_UUID,
    base64Payload
  );

  await connected.cancelConnection().catch(() => {});
}
