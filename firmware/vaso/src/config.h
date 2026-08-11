#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ---------- FIRMWARE / RESET TOKEN ----------
// Cambia questa stringa (es. "v1" -> "v2") e ricarica il firmware quando vuoi
// forzare una cancellazione automatica delle credenziali al primo avvio
// dopo l'upload, senza dover usare il pin di reset.
#define FIRMWARE_RESET_TOKEN "v2"

// ---------- PIN DI RESET ----------
#define RESET_PIN 13
#define WIFI_TIMEOUT_MS 10000UL   // 10 secondi

// ---------- CREDENZIALI / CONFIG (caricate da NVS o ricevute via BLE) ----------
extern String cfg_ssid;
extern String cfg_wifi_pass;
extern String cfg_mqtt_user;
extern String cfg_mqtt_pass;
extern String cfg_mqtt_host;
extern int cfg_mqtt_port;
extern String cfg_device_id;

// ---------- SCHEDULING LETTURE SENSORI ----------
extern unsigned long samplingInterval;
extern unsigned long lastPublish;
extern bool forceRead;

#endif
