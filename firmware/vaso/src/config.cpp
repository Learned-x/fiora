#include "config.h"

String cfg_ssid;
String cfg_wifi_pass;
String cfg_mqtt_user;
String cfg_mqtt_pass;
String cfg_mqtt_host;
int cfg_mqtt_port = 8883;
String cfg_device_id;

unsigned long samplingInterval = 30UL * 60 * 1000;   // 30 minuti
unsigned long lastPublish = 0;
bool forceRead = true;   // prima lettura all'avvio
