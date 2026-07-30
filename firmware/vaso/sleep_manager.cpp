#include "esp_sleep.h"

#include "sleep_manager.h"

void enterLightSleep(uint32_t ms) {
  esp_sleep_enable_timer_wakeup((uint64_t)ms * 1000ULL);
  esp_light_sleep_start();
}
