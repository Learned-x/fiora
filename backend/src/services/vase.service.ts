import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

  return {
    vaseId: vase.id,
    deviceId: vase.deviceId,
    mqttUsername: process.env.MQTT_USERNAME!,
    mqttPassword: process.env.MQTT_PASSWORD!,
    brokerUrl: process.env.MQTT_BROKER_URL!,
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
    orderBy: { createdAt: 'desc' },
    include: { plants: { select: { id: true, nome: true }, take: 1 } },
  });
}

export async function renameVase(userId: string, vaseId: string, nome: string) {
  await findOwnedVase(userId, vaseId);
  return prisma.smartVase.update({ where: { id: vaseId }, data: { nome } });
}

export async function deleteVase(userId: string, vaseId: string) {
  await findOwnedVase(userId, vaseId);
  // Le piante collegate restano ma perdono il riferimento (tornano a reminder da calendario)
  await prisma.plant.updateMany({ where: { vasoId: vaseId }, data: { vasoId: null } });
  await prisma.smartVase.delete({ where: { id: vaseId } });
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
