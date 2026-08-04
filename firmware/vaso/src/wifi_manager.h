#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

extern volatile bool interruptTriggered;

void IRAM_ATTR handleResetInterrupt();

// true se questo firmware/token è nuovo rispetto all'ultimo avvio salvato
// (in quel caso cancella tutte le credenziali salvate in NVS)
bool checkFirmwareResetToken();

// Cancella ssid/password/mqtt/device_id salvati, mantenendo il fw_token
void wipeStoredCredentials();

// Carica le credenziali salvate in NVS, se presenti
bool loadStoredCredentials();

// Connette il WiFi con le credenziali correnti (cfg_ssid/cfg_wifi_pass).
// Ritorna false su interrupt di reset o timeout (in quel caso cancella ssid/password).
bool connectWiFi();

// Da chiamare a ogni loop(): se il pin RESET_PIN ha generato un interrupt,
// cancella le credenziali, avvia il provisioning BLE e riconnette il WiFi.
void handleInterruptIfNeeded();

#endif
