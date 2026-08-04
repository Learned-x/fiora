#include <Arduino.h>

#include "sensors.h"
#include "mqtt_handler.h"

// MODALITA' TEST SENZA SENSORI: scheda nuda, nessun sensore fisico collegato.
// Tutti i valori sono generati random (ma plausibili) solo per validare
// connessione BLE/WiFi/MQTT end-to-end. Da ripristinare con le letture reali
// (vedi git history di questo file) quando arrivano i sensori.

void initSensors() {
  randomSeed(analogRead(0) + micros());
}

void executeSensorCycle() {
  int soilPercent = random(20, 90);
  float lux = random(0, 20000) / 10.0f;
  float temperatura = random(150, 300) / 10.0f;
  int batteriaPercento = random(30, 100);

  Serial.println("----------------");
  Serial.println("[FAKE DATA - nessun sensore collegato]");

  Serial.print("Terreno: ");
  Serial.print(soilPercent);
  Serial.println("%");

  Serial.print("Luce: ");
  Serial.print(lux);
  Serial.println(" lux");

  Serial.print("Temperatura: ");
  Serial.print(temperatura);
  Serial.println(" C");

  Serial.print("Batteria: ");
  Serial.print(batteriaPercento);
  Serial.println("%");

  if (!client.connected()) connectMQTT();
  client.loop();
  publishTelemetry(
    soilPercent,
    lux,
    temperatura,
    batteriaPercento
  );
}
