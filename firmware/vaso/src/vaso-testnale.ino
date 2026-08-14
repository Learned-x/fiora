#include "config.h"
#include "ble_provisioning.h"
#include "wifi_manager.h"
#include "mqtt_handler.h"
#include "sensors.h"
#include "sleep_manager.h"

// ========== MODIFICHE DI TEST ATTIVE (scheda nuda, senza sensori) ==========
// 1) sensors.cpp: dati fake random invece di letture reali (nessun sensore fisico collegato)
// 2) mqtt_handler.cpp: client.setKeepAlive(60) — il default 15s scadeva troppo in fretta
//    e causava il ciclo online/offline visto nei test (LWT del broker)
// 3) config.h: FIRMWARE_RESET_TOKEN "v2" — forza un nuovo pairing BLE al prossimo boot
// 4) setup(): burst di 10 letture fake ogni 2s subito dopo la connessione MQTT,
//    per verificare il flusso end-to-end senza aspettare samplingInterval (30 min)
// 5) loop(): enterLightSleep() sostituito con delay() semplice — confermato che il
//    light sleep rompeva la sessione MQTT (client.connected() restava true ma i
//    messaggi in arrivo, es. "check" su .../config, non venivano più recapitati).
//    Il codice originale con light sleep è commentato sotto, da ripristinare
//    quando si affronterà il consumo energetico (va gestito diversamente, es.
//    tenendo sveglio lo stack WiFi durante lo sleep o un ciclo di sleep più corto)
// =============================================================================

// Ogni quanto controllare la connessione durante l'attesa (light sleep)
#define POLL_SLEEP_MS 3000

void setup() {

  Serial.begin(115200);

  pinMode(RESET_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(RESET_PIN), handleResetInterrupt, FALLING);

  // ---------- PROVISIONING ----------

  // 1) Se il firmware è stato appena caricato con un token diverso
  //    (compreso il primo avvio in assoluto), cancella tutto in automatico.
  bool firmwareJustReset = checkFirmwareResetToken();

  // 2) Se il pin di reset è già a GND all'avvio, forza la cancellazione
  //    delle credenziali (es. per cambiare rete WiFi da spento).
  bool resetPinHeld = (digitalRead(RESET_PIN) == LOW);

  if (resetPinHeld && !firmwareJustReset) {
    Serial.println("Pin di reset attivo all'avvio: cancello le credenziali salvate...");
    wipeStoredCredentials();
  }

  // L'interrupt potrebbe essere scattato durante l'avvio: lo ignoriamo qui,
  // tanto resetPinHeld già intercetta il caso "pin a GND al boot".
  interruptTriggered = false;

  bool hasCredentials = loadStoredCredentials();

  if (!hasCredentials || resetPinHeld || firmwareJustReset) {
    startBLEProvisioning();   // blocca finché non arrivano i dati via BLE
  } else {
    Serial.println("Credenziali trovate in memoria, provisioning saltato.");
  }

  Serial.print("Device ID: ");
  Serial.println(cfg_device_id);

  // WiFi (con timeout 10s + possibilità di interrupt)
  if (!connectWiFi()) {
    // Se non connesso (per timeout o interrupt), torna in provisioning
    // e riprova, in loop, finché non riesce.
    while (!connectWiFi()) {
      startBLEProvisioning();
    }
  }

  initSensors();

  // ---------- BURST DI TEST: 10 letture fake rapide, WiFi già connesso qui ----------
  connectMQTT();
  for (int i = 0; i < 10; i++) {
    client.loop();
    executeSensorCycle();
    delay(2000);
  }
}

void loop() {

  handleInterruptIfNeeded();   // gestisce il reset via GPIO13 (a runtime)

  if (!client.connected())
    connectMQTT();

  client.loop();

  if (mqttResetRequested) {
    mqttResetRequested = false;

    Serial.println("Comando reset ricevuto via MQTT: cancello credenziali e riavvio provisioning BLE...");

    client.disconnect();
    WiFi.disconnect(true);

    wipeWifiCredentials();

    startBLEProvisioning();   // blocca finché non arrivano nuove credenziali
    connectWiFi();
  }

  if (forceRead ||
      millis() - lastPublish >= samplingInterval) {

    forceRead = false;
    lastPublish = millis();

    executeSensorCycle();
  }

  // Codice originale (light sleep), commentato — vedi nota in cima al file:
  // enterLightSleep(POLL_SLEEP_MS);
  delay(POLL_SLEEP_MS);
}
