# Fiora — Aggiornamento firmware del vaso smart (OTA)

**Versione:** 1.0 — 2026-07-27
**Stato:** specifica di progetto, non ancora implementata
**Fase di riferimento:** Fase 6.5 (dopo il completamento del pairing BLE di Fase 6)

Questo documento definisce come l'app Fiora aggiorna il firmware del vaso smart
**over-the-air**, senza cavo USB e senza Arduino IDE. È la funzione mancante
rilevata il 2026-07-27 nell'audit della documentazione (vedi Allegato A per gli
altri disallineamenti trovati).

Sostituisce la frase conclusiva di `fiora-specifiche-tecniche-v1.md`
("Il backend Fiora non gestisce firmware né OTA update — questi restano
responsabilità del partner esterno"): il firmware è nel monorepo
(`firmware/vaso/vaso.ino`), quindi l'OTA è responsabilità di Fiora.

---

## 1. Perché serve

Senza OTA ogni correzione al firmware richiede di smontare il vaso, collegarlo
via USB a un Mac con Arduino IDE e riflasharlo. Con un solo prototipo è
fastidioso; con vasi in mano a utenti è impossibile. Casi concreti già presenti
nel progetto:

- Il mismatch `mqtt_username`/`mqtt_user` del payload BLE (vedi CLAUDE.md,
  "TODO bloccante"): un fix di due righe che oggi richiede il cavo.
- Cambio delle credenziali MQTT condivise o migrazione da HiveMQ a Mosquitto in
  produzione (broker host oggi hardcoded nello sketch).
- Calibrazione del sensore di umidità (`soilDry`/`soilWet`).
- Frequenza di campionamento, buffer offline, gestione batteria — tutte
  funzionalità firmware ancora da scrivere.

---

## 2. Decisioni di progetto

| Decisione | Scelta | Motivazione |
|---|---|---|
| Trasporto del comando | MQTT (topic dedicato) | Il canale vaso↔backend esiste già ed è bidirezionale; nessuna porta in ingresso da aprire sul vaso |
| Trasporto del binario | HTTPS (GET singolo) | Un `.bin` è ~1,2–1,5 MB: spezzarlo in chunk MQTT QoS 1 è fragile e lento. `HTTPClient` + `Update` sono nel core ESP32, zero dipendenze extra |
| Hosting del binario | MinIO (bucket `fiora-firmware`), URL presigned 15 min | MinIO è già in `docker-compose.dev.yml` per le foto (Fase 5); in produzione stesso storage dietro Nginx |
| Verifica integrità | SHA-256 del binario confrontato sul device | Difesa minima contro download troncati o corrotti; l'HTTPS copre il transito, non l'artefatto |
| Firma del firmware (Secure Boot) | **Fuori scope MVP** | Richiede fusing degli eFuse dell'ESP32, irreversibile — da valutare solo prima di una distribuzione reale |
| Chi decide l'aggiornamento | L'utente, dall'app | Nessun auto-update silenzioso in MVP: un OTA che fallisce a metà lascia un vaso muto e l'utente deve sapere perché |
| Aggiornamento obbligatorio | Flag `obbligatorio` sulla release | Serve per rilasci che rompono la compatibilità del protocollo MQTT: l'app lo mostra come bloccante, ma resta l'utente a confermare |
| Rollback | Best-effort applicativo (vedi §7) | Il rollback del bootloader ESP-IDF non è abilitato nelle build standard del core Arduino |

---

## 3. Modello dati

### 3.1 Nuova tabella `firmware_releases`

```sql
CREATE TABLE firmware_releases (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versione     VARCHAR(20) UNIQUE NOT NULL,   -- SemVer, es. '1.2.0'
  canale       VARCHAR(20) NOT NULL DEFAULT 'stable',  -- 'stable' | 'beta'
  url          TEXT NOT NULL,                 -- object key su MinIO (non URL firmato)
  sha256       CHAR(64) NOT NULL,             -- hash del .bin, hex minuscolo
  dimensione   INTEGER NOT NULL,              -- byte
  note         TEXT,                          -- changelog mostrato nell'app
  obbligatorio BOOLEAN NOT NULL DEFAULT FALSE,
  pubblicata   BOOLEAN NOT NULL DEFAULT FALSE,-- una release non pubblicata non viene mai offerta
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 Nuove colonne su `smart_vases`

```sql
ALTER TABLE smart_vases
  ADD COLUMN firmware_version        VARCHAR(20),                    -- versione riportata dal vaso
  ADD COLUMN firmware_target_version VARCHAR(20),                    -- versione richiesta dall'utente, NULL se nessun OTA in corso
  ADD COLUMN ota_stato               VARCHAR(20) DEFAULT 'idle',     -- 'idle'|'richiesto'|'download'|'installazione'|'fallito'
  ADD COLUMN ota_progresso           SMALLINT,                       -- 0-100, NULL fuori da un OTA
  ADD COLUMN ota_errore              TEXT,                           -- ultimo errore leggibile
  ADD COLUMN ota_aggiornato_a        TIMESTAMPTZ;                    -- ultimo cambio di stato OTA
```

Nomi Prisma corrispondenti su `model SmartVase`: `firmwareVersion`,
`firmwareTargetVersion`, `otaStato`, `otaProgresso`, `otaErrore`,
`otaAggiornatoA` (con `@map` verso le colonne snake_case, come il resto dello schema).

---

## 4. Protocollo MQTT

### 4.1 Topic nuovi

| Topic | Direzione | QoS | Retained | Payload |
|---|---|---|---|---|
| `fiora/vaso/{device_id}/ota` | backend → vaso | 1 | no | comando di aggiornamento |
| `fiora/vaso/{device_id}/ota/status` | vaso → backend | 1 | no | avanzamento ed esito |

> ⚠️ La sottoscrizione esistente `fiora/vaso/+/status` **non** intercetta
> `fiora/vaso/{id}/ota/status`: il wildcard `+` copre un solo livello. Va
> aggiunta una `subscribe('fiora/vaso/+/ota/status')` in `connectMqtt()`, e
> `routeMessage()` va aggiornato perché oggi fa match sull'ultimo segmento del
> topic (`ota/status` finirebbe in "topic non gestito").

### 4.2 Comando (backend → vaso)

```json
{
  "action": "update",
  "version": "1.2.0",
  "url": "https://storage.fiora.local/fiora-firmware/vaso-1.2.0.bin?X-Amz-...",
  "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "size": 1348912
}
```

L'URL è **presigned con scadenza 15 minuti**: il bucket non è pubblico e il
firmware non ha credenziali di storage.

### 4.3 Stato (vaso → backend)

```json
{ "device_id": "vaso-abc", "version": "1.2.0", "state": "download", "progress": 42 }
{ "device_id": "vaso-abc", "version": "1.2.0", "state": "installazione", "progress": 100 }
{ "device_id": "vaso-abc", "version": "1.2.0", "state": "fallito", "error": "SHA256_MISMATCH" }
```

Stati ammessi: `download` | `installazione` | `fallito`.
**Non esiste uno stato `success` inviato prima del riavvio**: il successo è
implicito e viene confermato dal messaggio `status: online` post-riavvio, che
riporta la nuova `fw_version`. Un vaso che dichiara "riuscito" e poi non torna
online avrebbe mentito.

Codici di errore firmware: `HTTP_ERROR`, `SHA256_MISMATCH`, `NO_SPACE`,
`WRITE_FAILED`, `BATTERY_LOW`, `WIFI_LOST`.

### 4.4 Versione firmware riportata dal vaso

Il campo `fw_version` va aggiunto ai payload esistenti:

```json
// fiora/vaso/{device_id}/status
{ "device_id": "vaso-abc", "status": "online", "fw_version": "1.1.0" }
```

`handleStatus()` in `src/lib/mqtt.ts` lo salva in `smart_vases.firmware_version`.
Se la versione ricevuta coincide con `firmware_target_version`, l'OTA è concluso
con successo: azzera `firmware_target_version`, `ota_progresso`, `ota_errore` e
imposta `ota_stato = 'idle'`.

---

## 5. API backend

```
GET   /vases/:id/firmware          Stato firmware + aggiornamento disponibile
POST  /vases/:id/firmware/update   Avvia l'OTA (pubblica il comando MQTT)

# Admin (protetti da role='admin', vedi User.role di Fase 4.5)
GET   /admin/firmware/releases     Lista release
POST  /admin/firmware/releases     Upload .bin (multipart) + metadati
PATCH /admin/firmware/releases/:id Pubblica/ritira una release
```

**`GET /vases/:id/firmware`**

```json
{
  "success": true,
  "data": {
    "versioneCorrente": "1.1.0",
    "versioneDisponibile": "1.2.0",
    "aggiornamentoDisponibile": true,
    "obbligatorio": false,
    "note": "Corregge il pairing BLE e la calibrazione del sensore di umidità",
    "ota": { "stato": "idle", "progresso": null, "errore": null }
  }
}
```

`versioneDisponibile` = release `pubblicata` più alta (SemVer) del canale
`stable` maggiore di `versioneCorrente`. Se il vaso non ha mai riportato una
versione (`firmware_version` NULL, firmware pre-OTA), `aggiornamentoDisponibile`
è `false` e l'app mostra "aggiornabile solo via cavo".

**`POST /vases/:id/firmware/update`** — body opzionale `{ "version": "1.2.0" }`
(default: ultima disponibile). Il backend:

1. verifica ownership del vaso;
2. rifiuta se `stato != 'connesso'` → `VASE_OFFLINE`;
3. rifiuta se `ota_stato` è già `richiesto`/`download`/`installazione` → `FIRMWARE_UPDATE_IN_PROGRESS`;
4. rifiuta se la versione richiesta è uguale alla corrente → `FIRMWARE_UP_TO_DATE`;
5. rifiuta se `batteria != null && batteria < 50` → `FIRMWARE_BATTERY_LOW`;
6. genera l'URL presigned MinIO (15 min), pubblica il comando su
   `fiora/vaso/{device_id}/ota`;
7. scrive `firmware_target_version`, `ota_stato='richiesto'`, `ota_progresso=0`.

**Watchdog:** un job BullMQ ricorrente (ogni 5 min) porta a
`ota_stato='fallito'`, `ota_errore='TIMEOUT'` ogni vaso fermo in uno stato OTA
da più di 15 minuti — altrimenti un vaso che si spegne a metà download lascia
l'app in caricamento per sempre.

**Nuovi codici errore** (da aggiungere a §5 delle specifiche tecniche):
`FIRMWARE_NOT_FOUND`, `FIRMWARE_UP_TO_DATE`, `FIRMWARE_UPDATE_IN_PROGRESS`,
`FIRMWARE_BATTERY_LOW`, `FIRMWARE_UPDATE_FAILED`, `VASE_OFFLINE`.

---

## 6. Firmware ESP32

### 6.1 Prerequisito: tabella delle partizioni con OTA

L'OTA richiede **due partizioni applicative** (`app0`/`app1`): il nuovo firmware
si scrive in quella inattiva e il bootloader ci passa al riavvio.

- In Arduino IDE: **Tools → Partition Scheme → "Minimal SPIFFS (1.9MB APP with
  OTA / 190KB SPIFFS)"**.
- Lo schema di default ("Default 4MB with spiffs") ha sì due slot, ma da 1,2 MB
  ciascuno: lo sketch attuale (WiFi + TLS + BLE + ArduinoJson + PubSubClient +
  sensori) rischia di non entrarci. **Verificare la dimensione compilata prima
  di scegliere**: se supera 1,2 MB serve per forza lo schema "Minimal SPIFFS".
- Cambiare schema di partizioni richiede **un ultimo flash via cavo** su ogni
  vaso già in giro: i vasi flashati con il layout attuale non sono aggiornabili
  OTA finché non ricevono una build con il layout nuovo. È il motivo per cui
  questa modifica va fatta **prima** di distribuire qualsiasi vaso.

### 6.2 Costante di versione

```cpp
#define FW_VERSION "1.1.0"   // SemVer, allineata al tag git firmware-v1.1.0
```

Da includere nel payload `status` e nei messaggi `ota/status`.

### 6.3 Handler MQTT (oggi mancante)

Lo sketch attuale si sottoscrive a `fiora/vaso/{id}/config` ma **non chiama mai
`client.setCallback()`**: qualunque messaggio in arrivo viene ignorato. Va
aggiunto un callback che smista `config` e `ota`:

```cpp
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String t(topic);
  String body; body.reserve(length);
  for (unsigned int i = 0; i < length; i++) body += (char)payload[i];

  if (t.endsWith("/ota"))    { handleOtaCommand(body); return; }
  if (t.endsWith("/config")) { handleConfigCommand(body); return; }
}

// in connectMQTT(), prima di client.connect():
client.setCallback(onMqttMessage);
client.setBufferSize(1024);   // il payload OTA supera i 256 byte di default
// dopo la connessione:
client.subscribe(("fiora/vaso/" + deviceId + "/ota").c_str(), 1);
```

> Nota: il buffer di default di `PubSubClient` è 256 byte — il comando OTA con
> URL presigned lo supera abbondantemente e verrebbe **scartato in silenzio**.
> `setBufferSize(1024)` non è opzionale.

### 6.4 Download e scrittura

```cpp
#include <HTTPClient.h>
#include <Update.h>
#include <mbedtls/sha256.h>

void handleOtaCommand(const String& body) {
  StaticJsonDocument<768> doc;
  if (deserializeJson(doc, body)) return;
  if (String((const char*)doc["action"]) != "update") return;

  String version = doc["version"] | "";
  String url     = doc["url"] | "";
  String sha     = doc["sha256"] | "";
  size_t  size   = doc["size"] | 0;
  if (version.isEmpty() || url.isEmpty() || sha.isEmpty() || size == 0) return;

  publishOtaStatus(version, "download", 0, "");

  WiFiClientSecure otaClient;
  otaClient.setCACert(ca_cert);          // stessa CA usata per MQTT/HTTPS storage

  HTTPClient http;
  http.begin(otaClient, url);
  int code = http.GET();
  if (code != HTTP_CODE_OK) {
    publishOtaStatus(version, "fallito", 0, "HTTP_ERROR");
    http.end();
    return;
  }

  if (!Update.begin(size)) {
    publishOtaStatus(version, "fallito", 0, "NO_SPACE");
    http.end();
    return;
  }

  mbedtls_sha256_context sha_ctx;
  mbedtls_sha256_init(&sha_ctx);
  mbedtls_sha256_starts_ret(&sha_ctx, 0);

  WiFiClient* stream = http.getStreamPtr();
  uint8_t buf[1024];
  size_t written = 0;
  int lastPct = -1;

  while (http.connected() && written < size) {
    size_t avail = stream->available();
    if (!avail) { delay(10); continue; }

    int n = stream->readBytes(buf, min(avail, sizeof(buf)));
    if (n <= 0) continue;

    mbedtls_sha256_update_ret(&sha_ctx, buf, n);
    if (Update.write(buf, n) != (size_t)n) {
      Update.abort();
      publishOtaStatus(version, "fallito", 0, "WRITE_FAILED");
      http.end();
      return;
    }
    written += n;

    int pct = (written * 100) / size;
    if (pct >= lastPct + 5) {                 // report ogni 5%, non a ogni chunk
      publishOtaStatus(version, "download", pct, "");
      client.loop();                          // tiene viva la connessione MQTT
      lastPct = pct;
    }
  }

  uint8_t digest[32];
  mbedtls_sha256_finish_ret(&sha_ctx, digest);
  mbedtls_sha256_free(&sha_ctx);

  char hex[65];
  for (int i = 0; i < 32; i++) sprintf(hex + i * 2, "%02x", digest[i]);
  hex[64] = '\0';

  if (sha != String(hex)) {
    Update.abort();
    publishOtaStatus(version, "fallito", 0, "SHA256_MISMATCH");
    http.end();
    return;
  }

  if (!Update.end(true)) {
    publishOtaStatus(version, "fallito", 0, "WRITE_FAILED");
    http.end();
    return;
  }

  publishOtaStatus(version, "installazione", 100, "");
  prefs.putString("fw_pending", version);     // per la validazione post-boot (§7)
  http.end();
  delay(500);
  ESP.restart();
}
```

**Vincoli:**
- Non toccare mai le `Preferences` del namespace `fiora` durante l'OTA: le
  credenziali WiFi/MQTT devono sopravvivere all'aggiornamento (le partizioni
  NVS e app sono separate, quindi un OTA "pulito" non le tocca — ma non vanno
  cancellate a mano nel codice di update).
- Rifiutare l'OTA se `batteria` è nota e `< 50%` (errore `BATTERY_LOW`), anche
  se il backend già filtra: il vaso è l'ultimo a sapere il proprio stato reale.
- Durante il download non pubblicare telemetria: il TLS + scrittura flash usa
  già molta RAM.

---

## 7. Rollback e protezione dal brick

Il rollback automatico del bootloader (`CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE`)
**non è attivo** nelle build standard del core Arduino-ESP32: se il nuovo
firmware si avvia ma non funziona, nessuno lo riporta indietro da solo. La
protezione realistica in MVP è applicativa, a due livelli:

1. **Auto-validazione post-boot.** All'avvio, se `fw_pending` è valorizzata in
   `Preferences`, il firmware ha 90 secondi per connettersi a WiFi **e** MQTT.
   Se ci riesce: pubblica `status: online` con la nuova `fw_version`, cancella
   `fw_pending` e azzera il contatore `fw_boot_fail`. Se non ci riesce:
   incrementa `fw_boot_fail` e riavvia.
2. **Ritorno alla partizione precedente.** Al terzo fallimento consecutivo
   (`fw_boot_fail >= 3`) il firmware chiama
   `esp_ota_set_boot_partition(esp_ota_get_next_update_partition(NULL))` e
   riavvia, tornando alla versione precedente, che è ancora integra nell'altro
   slot.

Questo copre il caso "firmware nuovo che non si connette" (il più probabile:
broker cambiato, bug nella logica di rete). **Non** copre un firmware che non
arriva nemmeno a `setup()` (crash in boot loop): lì serve il cavo. È il limite
accettato per l'MVP; il rollback del bootloader va valutato se si passa a
PlatformIO/ESP-IDF, che lo espone come opzione di build.

---

## 8. App mobile

### 8.1 Dove vive la funzione

In `app/vase/[id].tsx`, nuova sezione **"Firmware"** sotto i dati ambientali:

```
┌─ Firmware ────────────────────────────┐
│ Versione installata      1.1.0        │
│ ● Aggiornamento disponibile: 1.2.0    │
│   "Corregge il pairing BLE…"          │
│            [ Aggiorna ora ]           │
└───────────────────────────────────────┘
```

Stati della sezione:

| Condizione | UI |
|---|---|
| Nessun aggiornamento | "Firmware aggiornato · 1.2.0", nessun bottone |
| Aggiornamento disponibile | Badge + changelog + bottone "Aggiorna ora" |
| Aggiornamento obbligatorio | Badge ambra "Aggiornamento necessario", testo che spiega che il vaso può smettere di inviare dati |
| OTA in corso | Progress bar `ota.progresso`, testo di stato, bottone disabilitato, avviso "Non spegnere il vaso" |
| OTA fallito | Messaggio d'errore tradotto + "Riprova" |
| Vaso offline | Sezione in sola lettura + "Il vaso deve essere connesso per aggiornarsi" |
| `firmware_version` NULL | "Versione sconosciuta — aggiornabile solo via cavo" |

### 8.2 Conferma e polling

Prima di avviare, un `ActionSheet` (lo stesso componente già usato in questa
schermata) spiega cosa succede: "L'aggiornamento richiede circa 2 minuti. Il
vaso si riavvierà e non invierà dati durante l'operazione. Tienilo alimentato."

Durante l'OTA l'app fa polling su `GET /vases/:id/firmware` **ogni 3 secondi,
per un massimo di 5 minuti** — stessa filosofia del pairing (vedi CLAUDE.md,
"Verifica pairing = stato reale"): il successo si dichiara solo quando
`versioneCorrente` è diventata quella nuova e il vaso è tornato `connesso`, non
quando il comando MQTT è stato pubblicato.

Alla scadenza dei 5 minuti senza esito: "Non siamo riusciti a confermare
l'aggiornamento. Controlla che il vaso sia acceso e riprova tra qualche minuto"
— senza dichiarare fallimento, perché il vaso potrebbe essere ancora in
riavvio.

### 8.3 Notifica push

Fuori scope di questa versione. Se in futuro si vuole avvisare gli utenti di un
firmware obbligatorio, riusare l'infrastruttura di Fase 8
(`notification.service.ts`) con un nuovo tipo di messaggio e deep link
`/vase/{id}`.

---

## 9. Flusso di rilascio (per lo sviluppatore)

```bash
# 1. Bump della versione nello sketch
#    firmware/vaso/vaso.ino → #define FW_VERSION "1.2.0"

# 2. Compilazione con lo schema di partizioni OTA
arduino-cli compile \
  --fqbn esp32:esp32:esp32:PartitionScheme=min_spiffs \
  --output-dir build firmware/vaso

# 3. Hash del binario (deve coincidere con quello caricato)
shasum -a 256 build/vaso.ino.bin

# 4. Upload della release (admin)
curl -X POST https://<api>/admin/firmware/releases \
  -H "Authorization: Bearer <token-admin>" \
  -F file=@build/vaso.ino.bin \
  -F versione=1.2.0 \
  -F canale=stable \
  -F note="Corregge il pairing BLE e la calibrazione del sensore di umidità"

# 5. Test su un vaso di prova (canale beta), poi pubblicazione
curl -X PATCH https://<api>/admin/firmware/releases/<id> \
  -H "Authorization: Bearer <token-admin>" \
  -d '{"pubblicata": true}'

# 6. Tag git
git tag firmware-v1.2.0 && git push origin firmware-v1.2.0
```

Il versionamento del firmware è **indipendente** da quello dell'app (tag
`firmware-vX.Y.Z` contro `vX.Y.Z`): hardware e app si rilasciano con ritmi
diversi. Il changelog firmware va in `CHANGELOG.md` in una sezione dedicata.

---

## 10. Ordine di implementazione consigliato

| # | Passo | Perché prima | Stima |
|---|---|---|---|
| 1 | Firmware: `FW_VERSION` + `fw_version` nel payload `status` + `setCallback`/`setBufferSize` | Senza sapere la versione installata non si può decidere nulla; e questo va flashato via cavo comunque | mezza giornata |
| 2 | Firmware: passaggio allo schema partizioni `min_spiffs` | Ultimo flash via cavo obbligatorio — dopo, l'OTA è possibile | 1 ora + verifica dimensione sketch |
| 3 | Backend: colonne `smart_vases`, `handleStatus` che salva `firmware_version`, `GET /vases/:id/firmware` | Rende visibile lo stato in app senza ancora aggiornare nulla | mezza giornata |
| 4 | Backend: tabella `firmware_releases` + endpoint admin + bucket MinIO `fiora-firmware` | Serve un artefatto da servire prima di poterlo scaricare | 1 giorno |
| 5 | Firmware: `handleOtaCommand` (download + SHA-256 + `Update`) | Il pezzo grosso, testabile subito contro un binario finto su MinIO | 1-2 giorni |
| 6 | Backend: `POST /vases/:id/firmware/update`, sottoscrizione `ota/status`, watchdog BullMQ | Chiude il ciclo | 1 giorno |
| 7 | Mobile: sezione Firmware in `app/vase/[id].tsx` con polling | Ultimo: senza il resto non ha niente da mostrare | 1 giorno |
| 8 | Firmware: auto-validazione post-boot + fallback partizione (§7) | Rete di sicurezza, ma richiede un OTA già funzionante per essere testata | mezza giornata |

**Test end-to-end minimo:** flashare via cavo la 1.0.0, pubblicare la 1.0.1 che
cambia solo una stringa di log, aggiornare dall'app, verificare che
`GET /vases/:id` riporti `firmware_version: "1.0.1"` e che le credenziali
WiFi/MQTT siano sopravvissute al riavvio (il vaso torna online da solo, senza
ri-pairing BLE).

---

## Allegato A — Disallineamenti doc ↔ implementazione rilevati (audit 2026-07-27)

Emersi confrontando `docs/` con il codice; l'OTA era il buco principale, ma non
l'unico. Elencati per priorità, indipendenti da questo documento.

**Firmware — funzionalità documentate e non implementate**

1. **Handler dei messaggi `config` assente.** Lo sketch si sottoscrive a
   `fiora/vaso/{id}/config` ma non registra alcun callback: i comandi di
   `sampling_interval_seconds` (specifiche tecniche §6) vengono ignorati. Anche
   lato backend `publishToVase()` esiste ma nessun endpoint la chiama.
2. **Frequenza di campionamento.** Le specifiche prevedono 15 minuti (5 in
   allerta), il firmware pubblica ogni 3 secondi: a regime è un carico inutile
   sul broker gratuito e sull'hypertable.
3. **Buffer offline (requisito 6 delle note hardware).** Non implementato: i
   dati raccolti senza WiFi sono persi.
4. **Batteria.** `publishTelemetry()` è chiamata con `batteria = -1`, quindi il
   campo non viene mai inviato e lo stato `batteria_scarica` di `smart_vases`
   non si attiva mai. Blocca anche la condizione batteria dell'OTA (§5).
5. **Reset fisico 5 secondi.** Documentato in §10.4 funzionali e nelle note
   hardware; nessuna gestione del pulsante nello sketch. Di conseguenza la
   "Riconfigurazione WiFi" non è realizzabile end-to-end, e in app non esiste
   nessuna schermata che la avvii.
6. **Sensori commentati.** `lightMeter.begin()` e `bme.begin()` sono commentati
   nel `setup()`: luce e temperatura vengono lette da periferiche non
   inizializzate.

**Documentazione da allineare alla realtà**

7. **§6 "Hardware" cita ESP-IDF WiFi Provisioning**; l'implementazione reale usa
   un servizio BLE custom (decisione del 2026-07-24, registrata in CLAUDE.md ma
   non riportata nelle specifiche tecniche).
8. **Payload di provisioning.** Le note hardware documentano `broker_url` e
   `broker_port` nel JSON BLE; il firmware ha host e porta hardcoded e l'app non
   li invia. Da decidere: o si aggiungono al payload (preferibile, serve per la
   migrazione a Mosquitto in produzione) o si corregge la doc.
9. **Credenziali MQTT per-vaso.** §6 e §10.5 funzionali parlano di
   `username: vaso-{device_id}` e di "revoca credenziali su Mosquitto" alla
   rimozione; in dev/staging le credenziali sono condivise, quindi la revoca è
   impossibile. La nota del 2026-07-24 copre il pairing ma non la rimozione.
10. **Endpoint mancanti nella lista di §5:** `GET /vases/:id/readings` è
    documentato, ma non lo sono `PATCH /plants/:id` con `vasoId` (collega/
    scollega vaso, implementato il 2026-07-25) né gli endpoint firmware di
    questo documento.
11. **Roadmap.** `fiora-roadmap-dettagliata.md` §"Fase 7: Integrazione Vaso
    Smart" descrive ancora topic `devices/{vase_id}/telemetry` e pairing per
    numero di serie: entrambi superati da `fiora/vaso/{device_id}/telemetry` e
    dal pairing BLE. La numerazione delle fasi in quel file è sfalsata di uno
    rispetto a CLAUDE.md (là il vaso smart è Fase 6).
