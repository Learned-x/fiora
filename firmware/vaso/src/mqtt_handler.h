#ifndef MQTT_HANDLER_H
#define MQTT_HANDLER_H

#include <WiFiClientSecure.h>
#include <PubSubClient.h>

extern WiFiClientSecure espClient;
extern PubSubClient client;

void mqttCallback(char* topic, byte* payload, unsigned int length);
void connectMQTT();
void publishTelemetry(float umidita, float luce, float temperatura, int batteria);

#endif
