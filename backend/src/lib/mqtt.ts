import mqtt, { MqttClient } from 'mqtt';
import { prisma } from './prisma';
import * as vaseService from '../services/vase.service';

let client: MqttClient | null = null;

interface TelemetryPayload {
  umidita?: number;
  luce?: number;
  temperatura?: number;
  batteria?: number;
}

interface StatusPayload {
  status: 'online' | 'offline';
  batteria?: number;
}

// ── Handlers per ogni tipo di messaggio ──────────────────────────────────────

async function handleTelemetry(deviceId: string, payload: string) {
  let data: TelemetryPayload;
  try {
    data = JSON.parse(payload);
  } catch {
    console.error(`[MQTT] Payload telemetria non valido da ${deviceId}:`, payload);
    return;
  }

  const vase = await prisma.smartVase.findUnique({ where: { deviceId } });
  if (!vase) {
    console.warn(`[MQTT] Telemetria da vaso sconosciuto: ${deviceId}`);
    return;
  }

  const plant = await prisma.plant.findFirst({ where: { vasoId: vase.id } });

  await prisma.sensorReading.create({
    data: {
      time: new Date(),
      vasoId: vase.id,
      plantId: plant?.id ?? null,
      umidita: data.umidita ?? null,
      luce: data.luce ?? null,
      temperatura: data.temperatura ?? null,
      batteria: data.batteria ?? null,
    },
  });

  await vaseService.touchVaseLastSeen(deviceId, data.batteria);

  // TODO (Fase 7): triggerare BullMQ per check soglie umidità e alert push
}

async function handleStatus(deviceId: string, payload: string) {
  let data: StatusPayload;
  try {
    data = JSON.parse(payload);
  } catch {
    console.error(`[MQTT] Payload status non valido da ${deviceId}:`, payload);
    return;
  }

  const vase = await prisma.smartVase.findUnique({ where: { deviceId } });
  if (!vase) {
    console.warn(`[MQTT] Status da vaso sconosciuto: ${deviceId}`);
    return;
  }

  if (data.status === 'online') {
    await vaseService.markVaseOnline(deviceId, data.batteria);
    console.log(`[MQTT] Vaso ${deviceId} online (pairing completato o riconnesso)`);
  } else {
    await vaseService.markVaseOffline(deviceId);
    console.log(`[MQTT] Vaso ${deviceId} offline`);
    // TODO (Fase 7): notifica push + fallback a reminder calendario
  }
}

// ── Router messaggi in arrivo ─────────────────────────────────────────────────

function routeMessage(topic: string, payload: Buffer) {
  const message = payload.toString();

  // fiora/vaso/{device_id}/telemetry
  const telemetryMatch = topic.match(/^fiora\/vaso\/([^/]+)\/telemetry$/);
  if (telemetryMatch) {
    handleTelemetry(telemetryMatch[1], message).catch((err) =>
      console.error(`[MQTT] Errore gestione telemetria da ${telemetryMatch[1]}:`, err)
    );
    return;
  }

  // fiora/vaso/{device_id}/status
  const statusMatch = topic.match(/^fiora\/vaso\/([^/]+)\/status$/);
  if (statusMatch) {
    handleStatus(statusMatch[1], message).catch((err) =>
      console.error(`[MQTT] Errore gestione status da ${statusMatch[1]}:`, err)
    );
    return;
  }

  console.warn(`[MQTT] Topic non gestito: ${topic}`);
}

// ── Connessione e avvio subscriber ───────────────────────────────────────────

export function connectMqtt(): MqttClient {
  if (client) return client;

  const brokerUrl = process.env.MQTT_BROKER_URL!;

  client = mqtt.connect(brokerUrl, {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    // HiveMQ Cloud usa WebSocket in ambienti browser; Node.js può usare
    // il protocollo MQTT nativo su TCP (mqtts://) — nessun workaround necessario
    reconnectPeriod: 5000,  // riconnessione automatica ogni 5s se cade
    keepalive: 60,
  });

  client.on('connect', () => {
    console.log('[MQTT] Connesso a HiveMQ Cloud');

    // Sottoscrivi a tutti i topic dei vasi in un'unica wildcard
    client!.subscribe('fiora/vaso/+/telemetry', { qos: 1 }, (err) => {
      if (err) console.error('[MQTT] Errore subscribe telemetry:', err);
      else console.log('[MQTT] Subscriber attivo: fiora/vaso/+/telemetry');
    });

    client!.subscribe('fiora/vaso/+/status', { qos: 1 }, (err) => {
      if (err) console.error('[MQTT] Errore subscribe status:', err);
      else console.log('[MQTT] Subscriber attivo: fiora/vaso/+/status');
    });
  });

  client.on('message', (topic, payload) => {
    routeMessage(topic, payload);
  });

  client.on('error', (err) => {
    console.error('[MQTT] Errore connessione:', err.message);
  });

  client.on('reconnect', () => {
    console.warn('[MQTT] Riconnessione in corso...');
  });

  client.on('disconnect', () => {
    console.warn('[MQTT] Disconnesso da HiveMQ Cloud');
  });

  return client;
}

// ── Publish (usato dal backend per inviare config ai vasi) ────────────────────

export function publishToVase(deviceId: string, payload: object): void {
  if (!client?.connected) {
    console.error('[MQTT] Impossibile pubblicare: client non connesso');
    return;
  }
  const topic = `fiora/vaso/${deviceId}/config`;
  client.publish(topic, JSON.stringify(payload), { qos: 1 });
}