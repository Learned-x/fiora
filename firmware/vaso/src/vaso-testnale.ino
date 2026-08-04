#include "config.h"
#include "ble_provisioning.h"
#include "wifi_manager.h"
#include "mqtt_handler.h"
#include "sensors.h"
#include "sleep_manager.h"

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
}

void loop() {

  handleInterruptIfNeeded();   // gestisce il reset via GPIO13 (a runtime)

  if (!client.connected())
    connectMQTT();

  client.loop();

  if (forceRead ||
      millis() - lastPublish >= samplingInterval) {

    forceRead = false;
    lastPublish = millis();

    executeSensorCycle();
  }

  // Invece di restare sveglio, dorme 2-3s alla volta: si risveglia,
  // ricontrolla MQTT/timer, e se non c'è nulla torna a dormire.
  // Così resta raggiungibile "quasi sempre" senza consumare come da sveglio.
  enterLightSleep(POLL_SLEEP_MS);
}
