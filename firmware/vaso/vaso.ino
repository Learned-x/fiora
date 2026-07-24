#include <Wire.h>
#include <BH1750.h>
#include <Adafruit_BME280.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>

// ---------- BLE PROVISIONING ----------
// UUID custom del servizio/caratteristica di pairing Fiora.
#define PROV_SERVICE_UUID        "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define PROV_CHARACTERISTIC_UUID "6e400002-b5a3-f393-e0a9-e50e24dcca9e"

Preferences prefs;
BLEServer* bleServer = nullptr;
volatile bool provisioningReceived = false;
String provPayload;

class ProvisioningCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    provPayload = String(characteristic->getValue().c_str());
    provisioningReceived = true;
  }
};

// Applica il payload ricevuto via BLE: { ssid, password, device_id, mqtt_username, mqtt_password }
bool applyProvisioningPayload(const String& payload) {
  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, payload);
  if (err) {
    Serial.println("[BLE] Payload provisioning non valido (JSON malformato)");
    return false;
  }

  const char* ssid = doc["ssid"];
  const char* password = doc["password"];
  const char* deviceId = doc["device_id"];
  const char* mqttUser = doc["mqtt_username"];
  const char* mqttPass = doc["mqtt_password"];

  if (!ssid || !password || !deviceId || !mqttUser || !mqttPass) {
    Serial.println("[BLE] Payload provisioning incompleto");
    return false;
  }

  prefs.putString("ssid", ssid);
  prefs.putString("wifipass", password);
  prefs.putString("device_id", deviceId);
  prefs.putString("mqtt_user", mqttUser);
  prefs.putString("mqtt_pass", mqttPass);

  Serial.println("[BLE] Credenziali salvate, riavvio...");
  return true;
}

// Avvia BLE advertising "Fiora-XXXX" e attende il payload di provisioning.
// Blocca finché non riceve credenziali valide, poi riavvia il device.
void startBleProvisioning() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char bleName[16];
  snprintf(bleName, sizeof(bleName), "Fiora-%02X%02X", mac[4], mac[5]);

  Serial.printf("[BLE] Avvio provisioning, nome dispositivo: %s\n", bleName);

  BLEDevice::init(bleName);
  bleServer = BLEDevice::createServer();
  BLEService* service = bleServer->createService(PROV_SERVICE_UUID);

  BLECharacteristic* characteristic = service->createCharacteristic(
    PROV_CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );
  characteristic->setCallbacks(new ProvisioningCallback());

  service->start();
  bleServer->getAdvertising()->addServiceUUID(PROV_SERVICE_UUID);
  bleServer->getAdvertising()->start();

  while (!provisioningReceived) {
    delay(200);
  }

  if (applyProvisioningPayload(provPayload)) {
    delay(500);
    ESP.restart();
  }

  // Payload non valido: resetta il flag e continua ad ascoltare
  provisioningReceived = false;
  startBleProvisioning();
}

//-----------MQTT-------------
const char* ca_cert = "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----\n";
const char* mqtt_host = "6c6f661a355149fbb2e308bc4a2ed846.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;

String mqttUser;
String mqttPass;
String deviceId;
String wifiSsid;
String wifiPassword;

WiFiClientSecure espClient;
PubSubClient client(espClient);

// ---------- SENSORI ----------
#define SOIL_PIN 4

BH1750 lightMeter;
Adafruit_BME280 bme;

// ---------- CALIBRAZIONE SOIL ----------
int soilDry = 3500;   // valore sensore terreno secco
int soilWet = 1200;   // valore sensore terreno bagnato

void connectMQTT();
void publishTelemetry(float umidita, float luce, float temperatura, int batteria);

void setup() {
  Serial.begin(115200);

  prefs.begin("fiora", false);
  deviceId = prefs.getString("device_id", "");

  if (deviceId.length() == 0) {
    // Nessuna configurazione salvata: entra in modalità pairing BLE
    startBleProvisioning();
    // startBleProvisioning riavvia il device al termine, non torna qui
  }

  wifiSsid = prefs.getString("ssid", "");
  wifiPassword = prefs.getString("wifipass", "");
  mqttUser = prefs.getString("mqtt_user", "");
  mqttPass = prefs.getString("mqtt_pass", "");

  // WiFi
  WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());

  Serial.print("Connessione WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi collegato");

  // I2C
  Wire.begin();

  // luce
  //lightMeter.begin();

  // temperatura/umidità
  /*  if(!bme.begin(0x76)){
      Serial.println("BME280 non trovato");
      while(1);
    }*/
}

void loop() {
  // -------- UMIDITA TERRENO --------

  int soilValue = analogRead(SOIL_PIN);

  int soilPercent = map(
    soilValue,
    soilDry,
    soilWet,
    0,
    100
  );

  soilPercent = constrain(
    soilPercent,
    0,
    100
  );

  // -------- LUCE --------

  float lux = lightMeter.readLightLevel();

  // -------- BME280 --------

  float temperatura = bme.readTemperature();

  float umiditaAria = bme.readHumidity();

  // -------- STAMPA DATI --------

  Serial.println("----------------");

  Serial.print("Terreno: ");
  Serial.print(soilPercent);
  Serial.println("%");
  Serial.println(soilValue);

  Serial.print("Luce: ");
  Serial.print(lux);
  Serial.println(" lux");

  Serial.print("Temperatura: ");
  Serial.print(temperatura);
  Serial.println(" C");

  Serial.print("Umidita aria: ");
  Serial.print(umiditaAria);
  Serial.println("%");

  // -------- LOGICA PIANTA --------

  if (soilPercent < 30) {
    Serial.println("🚨 Serve acqua");
  }

  if (soilPercent > 80) {
    Serial.println("⚠ Terreno troppo bagnato");
  }

  if (lux < 500) {
    Serial.println("⚠ Poca luce");
  }

  if (temperatura < 10) {
    Serial.println("⚠ Troppo freddo");
  }

  if (temperatura > 35) {
    Serial.println("⚠ Troppo caldo");
  }

  if (umiditaAria < 30) {
    Serial.println("⚠ Aria troppo secca");
  }

  if (!client.connected()) connectMQTT();
  client.loop();

  publishTelemetry(soilPercent, lux, temperatura, -1);

  delay(3000); // misura ogni 3 secondi
}

void connectMQTT() {
  espClient.setCACert(ca_cert);

  String clientId = "vaso-" + deviceId;
  String willTopic = "fiora/vaso/" + deviceId + "/status";
  String willPayload = "{\"device_id\":\"" + deviceId + "\",\"status\":\"offline\"}";

  while (!client.connected()) {
    client.setServer(mqtt_host, mqtt_port);
    if (client.connect(clientId.c_str(), mqttUser.c_str(), mqttPass.c_str(),
                        willTopic.c_str(), 1, false, willPayload.c_str())) {
      // Pubblica stato online al momento della connessione
      String onlinePayload = "{\"device_id\":\"" + deviceId + "\",\"status\":\"online\"}";
      client.publish(willTopic.c_str(), onlinePayload.c_str(), true);

      // Sottoscrizione al topic di configurazione
      String configTopic = "fiora/vaso/" + deviceId + "/config";
      client.subscribe(configTopic.c_str());
    } else {
      delay(2000);
    }
  }
}

void publishTelemetry(float umidita, float luce, float temperatura, int batteria) {
  String topic = "fiora/vaso/" + deviceId + "/telemetry";

  String payload = "{";
  payload += "\"device_id\":\"" + deviceId + "\",";
  payload += "\"umidita\":" + String(umidita) + ",";
  payload += "\"luce\":" + String(luce) + ",";
  payload += "\"temperatura\":" + String(temperatura);
  if (batteria >= 0) {
    payload += ",\"batteria\":" + String(batteria);
    if (batteria < 20) {
      payload += ",\"batteria_scarica\":true";
    }
  }
  payload += "}";

  client.publish(topic.c_str(), payload.c_str(), false); // QoS 1 va gestito lato client MQTT
}
