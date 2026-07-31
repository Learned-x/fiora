#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include <Preferences.h>

#include "ble_provisioning.h"
#include "config.h"

#define PROV_SERVICE_UUID         "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define PROV_CHARACTERISTIC_UUID  "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"

static Preferences prefs;
static BLEServer* pServer = nullptr;
static BLECharacteristic* pProvCharacteristic = nullptr;
static volatile bool credentialsReceived = false;

class ProvisioningCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pChar) override {
    String value = pChar->getValue().c_str();
    if (value.length() == 0) return;

    Serial.print("BLE RX: ");
    Serial.println(value);

    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, value);
    if (err) {
      Serial.print("JSON provisioning non valido: ");
      Serial.println(err.c_str());
      return;
    }

    if (!doc.containsKey("ssid") || !doc.containsKey("password") ||
        !doc.containsKey("mqtt_user") || !doc.containsKey("mqtt_pass") ||
        !doc.containsKey("mqtt_host") || !doc.containsKey("mqtt_port") ||
        !doc.containsKey("device_id")) {
      Serial.println("JSON provisioning incompleto");
      return;
    }

    cfg_ssid       = doc["ssid"].as<String>();
    cfg_wifi_pass  = doc["password"].as<String>();
    cfg_mqtt_user  = doc["mqtt_user"].as<String>();
    cfg_mqtt_pass  = doc["mqtt_pass"].as<String>();
    cfg_mqtt_host  = doc["mqtt_host"].as<String>();
    cfg_mqtt_port  = doc["mqtt_port"].as<int>();
    cfg_device_id  = doc["device_id"].as<String>();

    prefs.begin("fiora", false);
    prefs.putString("ssid", cfg_ssid);
    prefs.putString("wifi_pass", cfg_wifi_pass);
    prefs.putString("mqtt_user", cfg_mqtt_user);
    prefs.putString("mqtt_pass", cfg_mqtt_pass);
    prefs.putString("mqtt_host", cfg_mqtt_host);
    prefs.putInt("mqtt_port", cfg_mqtt_port);
    prefs.putString("device_id", cfg_device_id);
    prefs.end();

    Serial.println("Credenziali salvate in NVS");
    credentialsReceived = true;
  }
};

void startBLEProvisioning() {
  Serial.println("Avvio provisioning Bluetooth...");

  BLEDevice::init("Fiora-Setup");
  pServer = BLEDevice::createServer();

  BLEService* pService = pServer->createService(PROV_SERVICE_UUID);

  pProvCharacteristic = pService->createCharacteristic(
    PROV_CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  pProvCharacteristic->setCallbacks(new ProvisioningCallback());
  pProvCharacteristic->addDescriptor(new BLE2902());

  pService->start();

  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(PROV_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->start();

  Serial.println("In attesa di configurazione dall'app (Android/iOS)...");
  Serial.println("Formato JSON atteso:");
  Serial.println("{\"ssid\":\"...\",\"password\":\"...\",\"mqtt_user\":\"...\",\"mqtt_pass\":\"...\",\"mqtt_host\":\"...\",\"mqtt_port\":8883,\"device_id\":\"...\"}");

  credentialsReceived = false;
  while (!credentialsReceived) {
    delay(200);
  }

  delay(500); // tempo per lasciare che l'app riceva l'ack/disconnessione pulita

  BLEDevice::deinit(true);
  Serial.println("Provisioning completato, BLE disattivato.");
}
