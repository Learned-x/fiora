#include <Wire.h>
#include <BH1750.h>
#include <Adafruit_BME280.h>
#include <Adafruit_BMP280.h>

#include "sensors.h"
#include "mqtt_handler.h"

#define SOIL_PIN 4

// GPIO34 = ADC1_CH6, input-only, sicuro da usare con WiFi attivo.
// (SOIL_PIN=4 e' ADC2: in teoria in conflitto con WiFi, va rivisto a parte)
#define BATTERY_ADC_PIN 34

// Partitore VBAT -> ADC: R_top=100k (verso VBAT), R_bottom=100k (verso GND).
// A VBAT=4.2V l'ADC vede 2.1V, ben dentro il fondo scala con attenuazione 11dB.
#define BATTERY_DIVIDER_RATIO 2.0f

static BH1750 lightMeter;
static Adafruit_BME280 bme;   // dichiarato ma mai usato nel codice originale - vedi nota
static Adafruit_BMP280 bmp;

// ---------- CALIBRAZIONE SOIL ----------
int soilDry = 3500;   // valore sensore terreno secco
int soilWet = 1200;   // valore sensore terreno bagnato

// ---------- CURVA DI SCARICA LI-ION 1S (approssimazione) ----------
struct PuntoBatteria { float volt; int percento; };

static const PuntoBatteria curvaBatteria[] = {
  {3.00, 0}, {3.45, 5}, {3.68, 10}, {3.74, 20}, {3.77, 30},
  {3.79, 40}, {3.82, 50}, {3.87, 60}, {3.92, 70}, {3.98, 80},
  {4.06, 90}, {4.20, 100}
};
static const int numPuntiBatteria = sizeof(curvaBatteria) / sizeof(curvaBatteria[0]);

static int voltoAPercento(float volt) {
  if (volt <= curvaBatteria[0].volt) return 0;
  if (volt >= curvaBatteria[numPuntiBatteria - 1].volt) return 100;

  for (int i = 0; i < numPuntiBatteria - 1; i++) {
    if (volt >= curvaBatteria[i].volt && volt <= curvaBatteria[i + 1].volt) {
      float range = curvaBatteria[i + 1].volt - curvaBatteria[i].volt;
      float pos = volt - curvaBatteria[i].volt;
      float percentRange = curvaBatteria[i + 1].percento - curvaBatteria[i].percento;
      return curvaBatteria[i].percento + (int)(pos / range * percentRange);
    }
  }
  return 0;
}

static int leggiBatteriaPercento() {
  const int campioni = 8;
  uint32_t sommaMv = 0;

  for (int i = 0; i < campioni; i++) {
    sommaMv += analogReadMilliVolts(BATTERY_ADC_PIN);
    delay(2);
  }

  float adcMv = (float)sommaMv / campioni;
  float battVolt = (adcMv * BATTERY_DIVIDER_RATIO) / 1000.0f;

  Serial.print("Batteria: ");
  Serial.print(battVolt);
  Serial.println(" V");

  return voltoAPercento(battVolt);
}

void initSensors() {
  Wire.begin(8, 9);

  analogSetPinAttenuation(BATTERY_ADC_PIN, ADC_11db);

  lightMeter.begin(BH1750::ONE_TIME_HIGH_RES_MODE);

  if (!bmp.begin(0x76)) {
    Serial.println("BME280 non trovato");
    while (1);
  }
  bmp.setSampling(
    Adafruit_BMP280::MODE_SLEEP,
    Adafruit_BMP280::SAMPLING_X1,
    Adafruit_BMP280::SAMPLING_X1,
    Adafruit_BMP280::FILTER_OFF,
    Adafruit_BMP280::STANDBY_MS_1000
  );
}

void executeSensorCycle() {
  // -------- UMIDITA TERRENO --------
  int soilValue = analogRead(SOIL_PIN);

  int soilPercent = map(soilValue, soilDry, soilWet, 0, 100);
  soilPercent = constrain(soilPercent, 0, 100);

  // -------- LUCE --------
  float lux = lightMeter.readLightLevel();

  // -------- BME280 --------
  bmp.setSampling(
    Adafruit_BMP280::MODE_FORCED,
    Adafruit_BMP280::SAMPLING_X2,
    Adafruit_BMP280::SAMPLING_X16,
    Adafruit_BMP280::FILTER_OFF,
    Adafruit_BMP280::STANDBY_MS_1000
  );
  float temperatura = bmp.readTemperature();

  // float umiditaAria = bmp.readHumidity();

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

  int batteriaPercento = leggiBatteriaPercento();

  if (!client.connected()) connectMQTT();
  client.loop();
  publishTelemetry(
    soilPercent,
    lux,
    temperatura,
    batteriaPercento
  );
}
