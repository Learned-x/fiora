#include <WiFi.h>
#include "esp_wifi.h"
#include <Preferences.h>

#include "wifi_manager.h"
#include "ble_provisioning.h"
#include "mqtt_handler.h"
#include "config.h"

static Preferences prefs;

volatile bool interruptTriggered = false;

void IRAM_ATTR handleResetInterrupt() {
  interruptTriggered = true;
}

bool checkFirmwareResetToken() {
  prefs.begin("fiora", true);
  String storedToken = prefs.getString("fw_token", "");
  prefs.end();

  if (storedToken == FIRMWARE_RESET_TOKEN) {
    return false; // stesso firmware di prima, nessuna cancellazione
  }

  Serial.println("Nuovo firmware/token rilevato: cancello le credenziali salvate...");
  wipeStoredCredentials();

  return true;
}

void wipeStoredCredentials() {
  prefs.begin("fiora", false);
  prefs.clear();
  prefs.putString("fw_token", FIRMWARE_RESET_TOKEN);
  prefs.end();
}

bool loadStoredCredentials() {
  prefs.begin("fiora", true);
  bool hasSsid = prefs.isKey("ssid");
  if (hasSsid) {
    cfg_ssid      = prefs.getString("ssid", "");
    cfg_wifi_pass = prefs.getString("wifi_pass", "");
    cfg_mqtt_user = prefs.getString("mqtt_user", "");
    cfg_mqtt_pass = prefs.getString("mqtt_pass", "");
    cfg_device_id = prefs.getString("device_id", "");
  }
  prefs.end();
  return hasSsid && cfg_ssid.length() > 0;
}

bool connectWiFi() {
  WiFi.begin(cfg_ssid.c_str(), cfg_wifi_pass.c_str());

  Serial.print("Connessione WiFi");

  unsigned long startAttempt = millis();

  while (WiFi.status() != WL_CONNECTED) {

    if (interruptTriggered) {
      Serial.println("\nInterrupt rilevato: annullo connessione WiFi.");
      WiFi.disconnect(true);
      return false;
    }

    if (millis() - startAttempt >= WIFI_TIMEOUT_MS) {
      Serial.println("\nTimeout connessione WiFi: cancello ssid/password salvati.");
      WiFi.disconnect(true);

      prefs.begin("fiora", false);
      prefs.remove("ssid");
      prefs.remove("wifi_pass");
      prefs.end();

      cfg_ssid = "";
      cfg_wifi_pass = "";

      return false;
    }

    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi collegato");
  esp_wifi_set_ps(WIFI_PS_MIN_MODEM);
  Serial.println("WiFi Modem Sleep attivo");

  return true;
}

void handleInterruptIfNeeded() {
  if (!interruptTriggered) return;

  interruptTriggered = false;  // reset flag subito

  Serial.println("Interrupt: cancello credenziali WiFi e avvio provisioning BLE...");

  client.disconnect();
  WiFi.disconnect(true);

  prefs.begin("fiora", false);
  prefs.remove("ssid");
  prefs.remove("wifi_pass");
  prefs.end();

  cfg_ssid = "";
  cfg_wifi_pass = "";

  startBLEProvisioning();   // blocca finché non arrivano nuove credenziali

  connectWiFi();
}
