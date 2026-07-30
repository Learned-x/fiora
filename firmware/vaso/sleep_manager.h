#ifndef SLEEP_MANAGER_H
#define SLEEP_MANAGER_H

#include <Arduino.h>

// Light sleep per 'ms' millisecondi. CPU ferma, RAM e stato WiFi/MQTT
// preservati. Il timer RTC continua a contare: al risveglio l'esecuzione
// riprende dalla riga successiva, e millis() ha già conteggiato il tempo
// dormito.
void enterLightSleep(uint32_t ms);

#endif
