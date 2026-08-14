import { api } from './api';

export interface SensorReading {
  time: string;
  umidita: number | null;
  luce: number | null;
  temperatura: string | null;
  batteria: number | null;
}

export interface SmartVase {
  id: string;
  deviceId: string;
  nome: string | null;
  stato: 'connesso' | 'disconnesso' | 'batteria_scarica';
  batteria: number | null;
  ordine: number;
  lastSeen: string | null;
  createdAt: string;
  plants?: { id: string; nome: string }[];
  ultimaLettura?: SensorReading | null;
}

export interface PairingCredentials {
  vaseId: string;
  deviceId: string;
  mqttUsername: string;
  mqttPassword: string;
  brokerUrl: string;
}

export async function startPairing(): Promise<PairingCredentials> {
  const res = await api.post<{ data: PairingCredentials }>('/vases/pair');
  return res.data.data;
}

export async function listVases(): Promise<SmartVase[]> {
  const res = await api.get<{ data: SmartVase[] }>('/vases');
  return res.data.data;
}

export async function reorderVases(orderedIds: string[]): Promise<void> {
  await api.patch('/vases/order', { orderedIds });
}

export async function getVase(id: string): Promise<SmartVase> {
  const res = await api.get<{ data: SmartVase }>(`/vases/${id}`);
  return res.data.data;
}

export async function getVaseReadings24h(id: string): Promise<SensorReading[]> {
  const res = await api.get<{ data: SensorReading[] }>(`/vases/${id}/readings`);
  return res.data.data;
}

export async function renameVase(id: string, nome: string): Promise<SmartVase> {
  const res = await api.patch<{ data: SmartVase }>(`/vases/${id}`, { nome });
  return res.data.data;
}

export async function deleteVase(id: string): Promise<void> {
  await api.delete(`/vases/${id}`);
}

// Chiede al vaso una lettura immediata: fire-and-forget, il dato arriva
// poi via MQTT come una lettura normale — chi chiama deve ripollare
// getVase()/getVaseReadings24h() per vederlo.
export async function refreshVase(id: string): Promise<void> {
  await api.post(`/vases/${id}/refresh`);
}

// Chiede al vaso di dimenticare SSID/password WiFi e rientrare in
// provisioning BLE: fire-and-forget, il vaso si disconnette pochi istanti
// dopo — chi chiama deve poi guidare l'utente al flusso BLE di
// reconnect-wifi.tsx (non un nuovo pairing: stesso device_id).
export async function resetVaseWifi(id: string): Promise<void> {
  await api.post(`/vases/${id}/reset-wifi`);
}

// Credenziali per riconfigurare via BLE un vaso GIÀ esistente (stessa shape
// di PairingCredentials, ma senza creare un nuovo vaso lato backend).
export async function getReconnectCredentials(id: string): Promise<PairingCredentials> {
  const res = await api.get<{ data: PairingCredentials }>(`/vases/${id}/reconnect-credentials`);
  return res.data.data;
}
