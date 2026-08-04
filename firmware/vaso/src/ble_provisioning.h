#ifndef BLE_PROVISIONING_H
#define BLE_PROVISIONING_H

// Avvia il server BLE e resta in attesa (bloccante) dei dati di
// configurazione dall'app. Alla ricezione salva le credenziali in NVS
// e disattiva il BLE.
void startBLEProvisioning();

#endif
