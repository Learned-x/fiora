import mqtt, { MqttClient } from 'mqtt';
import { prisma } from './prisma';
import * as vaseService from '../services/vase.service';
import { logger } from './logger';

const log = logger.child({ module: 'mqtt' });

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
    log.error({ deviceId, payload }, 'Payload telemetria non valido');
    return;
  }

  const vase = await prisma.smartVase.findUnique({ where: { deviceId } });
  if (!vase) {
    log.warn({ deviceId }, 'Telemetria da vaso sconosciuto');
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
    log.error({ deviceId, payload }, 'Payload status non valido');
    return;
  }

  const vase = await prisma.smartVase.findUnique({ where: { deviceId } });
  if (!vase) {
    log.warn({ deviceId }, 'Status da vaso sconosciuto');
    return;
  }

  if (data.status === 'online') {
    await vaseService.markVaseOnline(deviceId, data.batteria);
    log.info({ deviceId }, 'Vaso online (pairing completato o riconnesso)');
  } else {
    await vaseService.markVaseOffline(deviceId);
    log.info({ deviceId }, 'Vaso offline');
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
      log.error({ err, deviceId: telemetryMatch[1] }, 'Errore gestione telemetria')
    );
    return;
  }

  // fiora/vaso/{device_id}/status
  const statusMatch = topic.match(/^fiora\/vaso\/([^/]+)\/status$/);
  if (statusMatch) {
    handleStatus(statusMatch[1], message).catch((err) =>
      log.error({ err, deviceId: statusMatch[1] }, 'Errore gestione status')
    );
    return;
  }

  log.warn({ topic }, 'Topic MQTT non gestito');
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
    log.info('Connesso a HiveMQ Cloud');

    // Sottoscrivi a tutti i topic dei vasi in un'unica wildcard
    client!.subscribe('fiora/vaso/+/telemetry', { qos: 1 }, (err) => {
      if (err) log.error({ err }, 'Errore subscribe telemetry');
      else log.info('Subscriber attivo: fiora/vaso/+/telemetry');
    });

    client!.subscribe('fiora/vaso/+/status', { qos: 1 }, (err) => {
      if (err) log.error({ err }, 'Errore subscribe status');
      else log.info('Subscriber attivo: fiora/vaso/+/status');
    });
  });

  client.on('message', (topic, payload) => {
    routeMessage(topic, payload);
  });

  client.on('error', (err) => {
    log.error({ err: err.message }, 'Errore connessione MQTT');
  });

  client.on('reconnect', () => {
    log.warn('Riconnessione MQTT in corso');
  });

  client.on('disconnect', () => {
    log.warn('Disconnesso da HiveMQ Cloud');
  });

  return client;
}

// ── Publish (usato dal backend per inviare config ai vasi) ────────────────────

export function publishToVase(deviceId: string, payload: object): void {
  if (!client?.connected) {
    log.error({ deviceId }, 'Impossibile pubblicare: client MQTT non connesso');
    return;
  }
  const topic = `fiora/vaso/${deviceId}/config`;
  client.publish(topic, JSON.stringify(payload), { qos: 1 });
}

// Il firmware confronta il payload raw con la stringa "check" (non JSON) per
// forzare una lettura immediata fuori dal ciclo di campionamento — vedi
// mqttCallback in firmware/vaso/src/mqtt_handler.cpp.
export function requestVaseRefresh(deviceId: string): void {
  if (!client?.connected) {
    log.error({ deviceId }, 'Impossibile pubblicare: client MQTT non connesso');
    return;
  }
  const topic = `fiora/vaso/${deviceId}/config`;
  client.publish(topic, 'check', { qos: 1 });
}

// Il firmware confronta il payload raw con la stringa "reset" (non JSON) per
// cancellare le credenziali WiFi (mantenendo device_id e credenziali MQTT) e
// rientrare in provisioning BLE — vedi mqttCallback in
// firmware/vaso/src/mqtt_handler.cpp.
export function requestVaseWifiReset(deviceId: string): void {
  if (!client?.connected) {
    log.error({ deviceId }, 'Impossibile pubblicare: client MQTT non connesso');
    return;
  }
  const topic = `fiora/vaso/${deviceId}/config`;
  client.publish(topic, 'reset', { qos: 1 });
}