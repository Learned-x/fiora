import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { audit } from '../lib/audit';
import { requestVaseRefresh, requestVaseWifiReset } from '../lib/mqtt';

// ── Helpers ───────────────────────────────────────────────────────────────────

// URL del broker da trasmettere al vaso via BLE. Diverso da MQTT_BROKER_URL
// (usato dal backend sulla rete Docker: mqtt://mosquitto:1883): il vaso deve
// raggiungere il broker dall'esterno, via TLS. In dev/HiveMQ i due coincidono
// e MQTT_PUBLIC_URL non è valorizzato.
function deviceBrokerUrl(): string {
  return process.env.MQTT_PUBLIC_URL || process.env.MQTT_BROKER_URL!;
}

export async function findOwnedVase(userId: string, vaseId: string) {
  const vase = await prisma.smartVase.findFirst({
    where: { id: vaseId, userId },
    include: { plants: { select: { id: true, nome: true }, take: 1 } },
  });
  if (!vase) {
    throw { code: 'VASE_NOT_FOUND', status: 404, message: 'Vaso non trovato' };
  }
  return vase;
}

// ── Pairing ───────────────────────────────────────────────────────────────────

// Avvia il pairing: crea il vaso in stato 'disconnesso' con un device_id univoco
// e restituisce le credenziali MQTT da trasferire al vaso via BLE.
// Dev/staging: credenziali MQTT condivise (HiveMQ Cloud, nessuna API di gestione
// credenziali sul piano gratuito) — vedi CLAUDE.md, nota broker per ambiente.
export async function startPairing(userId: string) {
  const deviceId = `vaso-${randomUUID()}`;

  const vase = await prisma.smartVase.create({
    data: {
      userId,
      deviceId,
      stato: 'disconnesso',
    },
  });

  audit('vase.pairing.started', { userId, targetId: vase.id, meta: { deviceId } });

  return {
    vaseId: vase.id,
    deviceId: vase.deviceId,
    mqttUsername: process.env.MQTT_USERNAME!,
    mqttPassword: process.env.MQTT_PASSWORD!,
    brokerUrl: deviceBrokerUrl(),
  };
}

export async function getVase(userId: string, vaseId: string) {
  const vase = await findOwnedVase(userId, vaseId);
  const ultimaLettura = await prisma.sensorReading.findFirst({
    where: { vasoId: vaseId },
    orderBy: { time: 'desc' },
  });
  return { ...vase, ultimaLettura };
}

export async function getVaseReadings24h(userId: string, vaseId: string) {
  await findOwnedVase(userId, vaseId);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.sensorReading.findMany({
    where: { vasoId: vaseId, time: { gte: since } },
    orderBy: { time: 'asc' },
    select: { time: true, umidita: true, luce: true, temperatura: true },
  });
}

export async function listVases(userId: string) {
  return prisma.smartVase.findMany({
    where: { userId },
    orderBy: [{ ordine: 'asc' }, { createdAt: 'desc' }],
    include: { plants: { select: { id: true, nome: true }, take: 1 } },
  });
}

export async function renameVase(userId: string, vaseId: string, nome: string) {
  await findOwnedVase(userId, vaseId);
  return prisma.smartVase.update({ where: { id: vaseId }, data: { nome } });
}

// orderedIds deve contenere esattamente l'insieme dei vasi dell'utente: un
// riordino parziale lascerebbe i vasi omessi con un ordine non aggiornato.
export async function reorderVases(userId: string, orderedIds: string[]) {
  const owned = await prisma.smartVase.findMany({ where: { userId }, select: { id: true } });
  const ownedIds = new Set(owned.map((v: { id: string }) => v.id));
  const validSet = orderedIds.length === ownedIds.size && orderedIds.every((id) => ownedIds.has(id));
  if (!validSet) {
    throw { code: 'VALIDATION_ERROR', status: 400, message: 'La lista deve contenere tutti i vasi dell\'utente' };
  }

  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.smartVase.update({ where: { id }, data: { ordine: index } }))
  );
  audit('vase.reordered', { userId, meta: { order: orderedIds } });
}

// Chiede al vaso una lettura immediata (fuori dal normale ciclo di
// campionamento). Fire-and-forget: il dato aggiornato arriva poi via MQTT
// telemetry come una lettura normale, non in risposta a questa chiamata.
export async function refreshVase(userId: string, vaseId: string) {
  const vase = await findOwnedVase(userId, vaseId);
  if (vase.stato !== 'connesso') {
    throw { code: 'VASE_OFFLINE', status: 409, message: 'Il vaso è disconnesso, impossibile richiedere una lettura' };
  }
  requestVaseRefresh(vase.deviceId);
  audit('vase.refresh.requested', { userId, targetId: vaseId, meta: { deviceId: vase.deviceId } });
}

// Chiede al vaso di dimenticare SSID/password WiFi (mantenendo device_id e
// credenziali MQTT) e rientrare in provisioning BLE — permette di cambiare
// rete senza perdere pianta collegata e storico letture. Il vaso torna
// visibile via BLE pochi istanti dopo l'invio, l'app deve poi fornire le
// nuove credenziali con lo stesso device_id (vedi getReconnectCredentials).
export async function resetVaseWifi(userId: string, vaseId: string) {
  const vase = await findOwnedVase(userId, vaseId);
  if (vase.stato !== 'connesso') {
    throw { code: 'VASE_OFFLINE', status: 409, message: 'Il vaso è disconnesso, impossibile inviare il comando di reset' };
  }
  requestVaseWifiReset(vase.deviceId);
  audit('vase.wifi_reset.requested', { userId, targetId: vaseId, meta: { deviceId: vase.deviceId } });
}

// Credenziali per riconfigurare via BLE un vaso GIÀ esistente (dopo
// resetVaseWifi o un pulsante fisico) — stessa shape di startPairing() ma
// senza creare una nuova riga smart_vases: il device_id è quello del vaso
// esistente, altrimenti il firmware lo sovrascriverebbe creando un secondo
// vaso "fantasma" lato app.
export async function getReconnectCredentials(userId: string, vaseId: string) {
  const vase = await findOwnedVase(userId, vaseId);
  return {
    vaseId: vase.id,
    deviceId: vase.deviceId,
    mqttUsername: process.env.MQTT_USERNAME!,
    mqttPassword: process.env.MQTT_PASSWORD!,
    brokerUrl: deviceBrokerUrl(),
  };
}

export async function deleteVase(userId: string, vaseId: string) {
  const vase = await findOwnedVase(userId, vaseId);
  // Se il vaso è online, chiedigli di dimenticare le credenziali WiFi prima di
  // cancellarlo: altrimenti resta orfano, connesso a un device_id che lato
  // backend non esiste più, muto finché qualcuno non preme il pulsante fisico.
  // Fire-and-forget: se il vaso è offline il comando si perde, ma la riga va
  // comunque rimossa — in quel caso serve comunque il pulsante fisico.
  if (vase.stato === 'connesso') {
    requestVaseWifiReset(vase.deviceId);
  }
  // Le piante collegate restano ma perdono il riferimento (tornano a reminder da calendario)
  await prisma.plant.updateMany({ where: { vasoId: vaseId }, data: { vasoId: null } });
  await prisma.smartVase.delete({ where: { id: vaseId } });
  audit('vase.deleted', { userId, targetId: vaseId, meta: { deviceId: vase.deviceId } });
}

// ── Chiamato dal subscriber MQTT ────────────────────────────────────────────────

// Primo messaggio status dal vaso dopo il pairing (o riconnessione): segna online.
export async function markVaseOnline(deviceId: string, batteria?: number) {
  await prisma.smartVase.updateMany({
    where: { deviceId },
    data: {
      stato: 'connesso',
      lastSeen: new Date(),
      ...(batteria !== undefined ? { batteria } : {}),
    },
  });
}

export async function markVaseOffline(deviceId: string) {
  await prisma.smartVase.updateMany({
    where: { deviceId },
    data: { stato: 'disconnesso' },
  });
}

export async function touchVaseLastSeen(deviceId: string, batteria?: number) {
  await prisma.smartVase.updateMany({
    where: { deviceId },
    data: {
      lastSeen: new Date(),
      stato: 'connesso',
      ...(batteria !== undefined ? { batteria } : {}),
    },
  });
}
