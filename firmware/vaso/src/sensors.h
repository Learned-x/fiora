#ifndef SENSORS_H
#define SENSORS_H

// Inizializza I2C e i sensori (luce, temperatura). Blocca se il BMP280 non risponde.
void initSensors();

// Legge tutti i sensori, stampa i valori, applica la logica di allerta
// e pubblica la telemetria via MQTT.
void executeSensorCycle();

#endif
