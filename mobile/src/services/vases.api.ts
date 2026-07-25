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
