#include "mqtt_handler.h"
#include "config.h"

bool mqttResetRequested = false;

WiFiClientSecure espClient;
PubSubClient client(espClient);

// CA privata Fiora (staging) — firma il certificato del broker Mosquitto
// self-hosted sul server Oracle. Generata in mosquitto/ssl/ca.crt, validità
// 10 anni. Se cambia l'IP pubblico del server il certificato server va
// rigenerato: la CA resta valida, nessun reflash necessario finché la CA è
// la stessa. In produzione: CA dedicata di produzione.
static const char* ca_cert = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFQTCCAymgAwIBAgIUQNDx9WdqcIvv7ZvWDBOUI6Pu8BYwDQYJKoZIhvcNAQEL
BQAwMDEOMAwGA1UECgwFRmlvcmExHjAcBgNVBAMMFUZpb3JhIFN0YWdpbmcgUm9v
dCBDQTAeFw0yNjA5MDExMzM3MjNaFw0zNjA4MjkxMzM3MjNaMDAxDjAMBgNVBAoM
BUZpb3JhMR4wHAYDVQQDDBVGaW9yYSBTdGFnaW5nIFJvb3QgQ0EwggIiMA0GCSqG
SIb3DQEBAQUAA4ICDwAwggIKAoICAQDHh/vsvb+Y7Qq4vmZN83dhMVOuk5Obsvad
07JWVuiO/Ut4m8zQlfpiECZnCCUgukYDhFOGZ/QOzvmcwCPwRw8pGpZ2FXWYdJEr
j9Lc5Tt1x4keW1R6ijMvDMV4rB8bExPg87WqFs9Cv5nnTJiM6KoGUC7EvkSo/GEs
Y/t2WUIgU5ij+aBP/mjo8WH4lSrat2ldb7SXWt9xBKtC0O9cgYgbFlZ/48W0V5QQ
qSrBTGzSD+PJYgRqvJftEwl6FyeCUbQe/0gaaqQiWpmV6TxhOAxauT0VVbLTcSKD
1eo/0RnymKD3/2OoaoHGNC/cHti3bzFNY1NDDx8d30SYX72RgcuimXmAZlS9ZUTR
MF7PaX25FmK6K7+DM18rQkXEFOHZjcNOhudemRqIaOXKzfUqKSbdqAnsBxjhjosX
k5M/k69NeKkjfGMpmkkDHF92kAmqaZW0YbWhzJ96AJpVpE9ULC2aKP/vS8+g6Kdi
ZsM/tShFcY0NbI4MY6XBUqHYBR1kXYvSDEW5TF794YNHP5xk5fmqe5Il/sjqGdZL
YYR5zy/rfwGTajL6kZq65bVVF60ECVn3bnPilvGR+qGGuLfJFGyesQ56P3sp+6M7
7LeJLZWq5pUeodpNMMtKlqPzyqpxH0tsupKiEzUSztX+iWjuo95QNvlMAeHR70/k
4BIRmAS2xwIDAQABo1MwUTAdBgNVHQ4EFgQUr3rU/T0wUMJIEG7AtZHNBtg3W0Iw
HwYDVR0jBBgwFoAUr3rU/T0wUMJIEG7AtZHNBtg3W0IwDwYDVR0TAQH/BAUwAwEB
/zANBgkqhkiG9w0BAQsFAAOCAgEAJvCo4vIW2XCl7NnwKXHCtjxrEvQ0WWte51jt
RIEaxbzLzikigFEFG8+lCar1YDdBbcQZyvPYA0RgpQ1sR7UyOzU+sdD2ntC4YMdb
KX11851zITwVtQ9IMcxnyFvDMM5sraTQLXTM+YWR7FYB8CtuVm4Azb8Xiz7gVEI/
NCCzaUg77IInEmS5Iz21XNTh7Ltvs3djw2iNSEU0MJpCuw+x72FmDJIkC9RVvgq7
EbDji9+NdooZGaRr57PnYVWvdhSZCLRiqkp7Lak40uOQ12B9ePhXm9XrtHbsv15H
dFrI0HdOcUy6u2IqQ+hphVEgI9Thfd8PQyspGltO9msJk8ycakxMXnTuK8+LKiD6
9/LY4bug9NiU1Lveqd0eTTFmSehGSilgeL3J0YhaWbsTLPj357a4ud9a00NwdGFH
ChmDy16Hyms72fcH7cZ7L4mL0xUbnudv5OFh6wvluAeWp6Afn11UbRYlZ2g+XrsY
Hw461unXGzxrZGNUtsCbXm2urIiyRcVoa5UeUL8tNvq9U5aoAZeXQrLsQT0yGDlz
m4Y2ajqu6+x/tTft8OVsGCOI+I3FVHAg/a49YJ/oicy0cRMaOrz4dqEyapdrB6hq
EtG0AtRPTcQIVFC2ZdktYMEMiU69ZH4sQlaZWVcwkQBdjIvR/u8NlzE3UiE+MMvX
Ew3Wz2o=
-----END CERTIFICATE-----
)EOF";

void mqttCallback(char* topic, byte* payload, unsigned int length) {

  String message;

  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.print("MQTT: ");
  Serial.print(topic);
  Serial.print(" -> ");
  Serial.println(message);

  if (message == "check") {
    forceRead = true;
  }

  if (message == "reset") {
    mqttResetRequested = true;   // gestito in loop(), non qui (dentro client.loop())
  }
}

void connectMQTT() {
  espClient.setCACert(ca_cert);

  String clientId = "vaso-" + cfg_device_id;
  String willTopic = "fiora/vaso/" + cfg_device_id + "/status";
  String willPayload = "{\"device_id\":\"" + cfg_device_id + "\",\"status\":\"offline\"}";

  while (!client.connected()) {
    client.setServer(cfg_mqtt_host.c_str(), cfg_mqtt_port);
    client.setCallback(mqttCallback);
    client.setKeepAlive(60);
    if (client.connect(clientId.c_str(), cfg_mqtt_user.c_str(), cfg_mqtt_pass.c_str(),
                        willTopic.c_str(), 1, false, willPayload.c_str())) {
      // Pubblica stato online al momento della connessione
      String onlinePayload = "{\"device_id\":\"" + cfg_device_id + "\",\"status\":\"online\"}";
      client.publish(willTopic.c_str(), onlinePayload.c_str(), true);

      // Sottoscrizione al topic di configurazione
      String configTopic = "fiora/vaso/" + cfg_device_id + "/config";
      client.subscribe(configTopic.c_str());
    } else {
      delay(2000);
    }
  }
}

void publishTelemetry(float umidita, float luce, float temperatura, int batteria) {
  String topic = "fiora/vaso/" + cfg_device_id + "/telemetry";

  String payload = "{";
  payload += "\"device_id\":\"" + cfg_device_id + "\",";
  payload += "\"umidita\":" + String(umidita) + ",";
  payload += "\"luce\":" + String(luce) + ",";
  payload += "\"temperatura\":" + String(temperatura) + ",";
  payload += "\"batteria\":" + String(batteria);
  if (batteria < 20) {
    payload += ",\"batteria_scarica\":true";
  }
  payload += "}";

  client.publish(topic.c_str(), payload.c_str(), false);
}
