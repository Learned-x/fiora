import mqtt, { MqttClient } from 'mqtt';

let client: MqttClient | null = null;

// ── Handlers per ogni tipo di messaggio ──────────────────────────────────────

function handleTelemetry(deviceId: string, payload: string) {
  try {
    const data = JSON.parse(payload);
    console.log(`[MQTT] Telemetria da ${deviceId}:`, data);

    // TODO (Fase 6): salvare in sensor_readings (TimescaleDB)
    // TODO (Fase 6): triggerare BullMQ per check soglie
  } catch {
    console.error(`[MQTT] Payload telemetria non valido da ${deviceId}:`, payload);
  }
}

function handleStatus(deviceId: string, payload: string) {
  try {
    const data = JSON.parse(payload);
    console.log(`[MQTT] Status da ${deviceId}:`, data);

    // TODO (Fase 6): aggiornare smart_vases.stato e last_seen
  } catch {
    console.error(`[MQTT] Payload status non valido da ${deviceId}:`, payload);
  }
}

// ── Router messaggi in arrivo ─────────────────────────────────────────────────

function routeMessage(topic: string, payload: Buffer) {
  const message = payload.toString();

  // fiora/vaso/{device_id}/telemetry
  const telemetryMatch = topic.match(/^fiora\/vaso\/([^/]+)\/telemetry$/);
  if (telemetryMatch) {
    handleTelemetry(telemetryMatch[1], message);
    return;
  }

  // fiora/vaso/{device_id}/status
  const statusMatch = topic.match(/^fiora\/vaso\/([^/]+)\/status$/);
  if (statusMatch) {
    handleStatus(statusMatch[1], message);
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