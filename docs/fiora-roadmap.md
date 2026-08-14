# 🌿 Fiora — Roadmap di sviluppo

**Versione 2.0 · aggiornato al 2026-07-27**

Stato di avanzamento del progetto, fase per fase, con il debito noto da recuperare.
Sostituisce `fiora-roadmap-dettagliata.md` e `fiora-roadmap-sviluppo.txt`, che avevano
una numerazione delle fasi sfalsata rispetto a quella realmente in uso.

Documenti collegati:
- **`fiora-specifiche-funzionali.md`** — cosa fa l'app, con lo stato di ogni funzione.
- **`fiora-specifiche-tecniche.md`** — come è implementata.
- **`fiora-manuale-ambienti.md`** — setup di development, staging e produzione.
- **`fiora-mev.md`** — manutenzione evolutiva pianificata per le prossime versioni.

---

## Quadro d'insieme

| Fase | Contenuto | Stato |
|---|---|---|
| 0 | Setup infrastruttura (Docker, Postgres/TimescaleDB, Redis, MinIO) | ✅ |
| 1 | Backend core + autenticazione (JWT, OAuth Google) | ✅ |
| 2 | CRUD piante e task, catalogo specie curato | ✅ |
| 3 | Reminder engine (BullMQ) | ✅ |
| 4 | App mobile — schermate principali | ✅ |
| 4.5 | Consolidamento backend + mobile | ✅ 2026-07-13 |
| 5 | Diario fotografico (MinIO) | ⏸️ rimandata |
| **6** | **Integrazione vaso smart (MQTT, pairing BLE, schermate)** | 🚧 **in corso** |
| 7 | Alert da sensore | ⏸️ rimandata |
| 8 | Notifiche push Expo | ✅ 2026-07-13 |
| 9 | Catalogo specie esteso (CSV in dev, Trefle in prod) | 📋 |
| 10 | Apple Sign-In + rifinitura UI | 🚧 parziale |
| Post-MVP | Offline SQLite | 📋 parcheggio |
| MEV | Interventi evolutivi su funzioni esistenti — vedi `fiora-mev.md` | 📋 7 voci |

Tag `v0.1.0` su `main` (2026-07-24) = baseline pre-Fase 6.

Le email transazionali e il cambio email, prima parcheggiate a post-MVP, sono diventate
**MEV-02** con priorità alta: senza, chi dimentica la password perde l'account.

> **Nota sulla numerazione.** Nella prima stesura della roadmap il vaso smart era la
> Fase 7 e le notifiche push la Fase 6. L'ordine è stato invertito in corso d'opera:
> **vaso smart = Fase 6, notifiche push = Fase 8**. La numerazione di questo documento
> è quella corrente, allineata a `CLAUDE.md`.

---

## Fasi completate

### Fase 0 — Setup infrastruttura ✅

Infrastruttura Docker locale: PostgreSQL 16 + TimescaleDB, Redis 7, MinIO.
Schema Prisma completo con migrazioni, hypertable TimescaleDB su `sensor_readings`
con retention a 90 giorni.

### Fase 1 — Backend core + autenticazione ✅

Express 5 + TypeScript strict. Auth completa: registrazione, login, refresh, logout,
OAuth Google, eliminazione account con periodo di grazia di 30 giorni (BullMQ).
Swagger su `/docs`. Apple Sign-In pronto lato backend, mancano le credenziali.

### Fase 2 — CRUD piante e task ✅

`/plants` con soft delete, task con completa/rimanda/salta e action log,
catalogo `/species` in sola lettura.

### Fase 3 — Reminder engine ✅

Job ricorrente BullMQ (cron `0 6 * * *`) che genera i task di annaffiatura.
Scelto BullMQ invece di un cron di sistema perché era già in uso per l'eliminazione
account: un solo meccanismo di scheduling da gestire e monitorare.

### Fase 4 — App mobile, schermate principali ✅

Expo Router, tab bar custom, schermata Oggi, collezione con filtri, dettaglio
pianta e bouquet, form di aggiunta e modifica, impostazioni.

### Fase 4.5 — Consolidamento ✅ (2026-07-13)

Fase non prevista in origine, nata dal confronto fra specifiche e codice a valle
della Fase 4: la Fase 5 sarebbe partita su fondamenta con diverse divergenze aperte.

Backend: campi nuovi su User in una sola migrazione, tabella `app_options`,
reminder engine esteso (fattore clima, concimazione stagionale, bouquet e stato
automatico), nuovi tipi di task, flag `inRitardo`, storico cure, `GET /auth/me`,
`PATCH /users/me`, cambio password, login non più bloccato dal periodo di grazia.
Mobile: banner grace period, preset di rimando, conferma "ELIMINA", storico cure,
clima in impostazioni.

### Fase 8 — Notifiche push Expo ✅ (2026-07-13)

Solo reminder da calendario: digest o notifica singola con deep link, cron alle
9/15/19 con smistamento per fascia `orarioReminder`. Gli alert da sensore sono
stati spostati in Fase 7 perché presuppongono le soglie, che non esistono ancora.

---

## Fase 6 — Integrazione vaso smart 🚧 (in corso)

Fase attiva. Backend e app sono scritti; **manca la validazione su hardware reale**.

### Fatto

- **Backend pairing e telemetria** (2026-07-24): `POST /vases/pair` genera il
  `device_id` e restituisce le credenziali MQTT; CRUD vasi; handler MQTT che
  scrivono le letture in `sensor_readings` e aggiornano stato e batteria.
- **Firmware BLE provisioning** (2026-07-24): WiFi, MQTT e `device_id` non più
  hardcoded ma letti dalla flash; se assenti, il vaso avvia l'advertising BLE
  `Fiora-XXXX` e riceve le credenziali via JSON.
- **Schermata di pairing** (2026-07-24): flusso scan-first con verifica dello stato
  reale del vaso (polling fino a 45 s) e messaggi d'errore tradotti per causa.
- **Dettaglio e storico vaso** (2026-07-25): `GET /vases/:id` con pianta collegata e
  ultima lettura, `GET /vases/:id/readings`, `PATCH /plants/:id` con `vasoId`.
- **Schermate Vasi e sensori nel dettaglio pianta** (2026-07-25): lista vasi reale,
  dettaglio vaso, tile umidità/luce/temperatura e sparkline umidità 24 h.

### Da fare prima di chiudere la fase

1. ~~Test end-to-end su hardware reale~~ — **fatto** (2026-07-31): primo pairing
   completato su ESP32 fisico con il firmware riscritto. Da ripetere dopo l'aggiunta
   di `mqtt_host`/`mqtt_port` (D9, non ancora verificata su hardware).
2. ~~Allineare i nomi dei campi nel payload BLE~~ — **fatto**, vedi D1 (chiuso).
3. **Verificare i permessi dell'utente MQTT** su HiveMQ Cloud per publish e subscribe
   sui topic `fiora/vaso/+/...`.
4. **Investigare il bug collega/scollega pianta** (vedi debito D2, ancora aperto).
5. Ordinamento della collezione "per prossima azione" e filtro "con vaso smart"
   (§3.1 funzionali), rinviati qui perché richiedono l'esistenza dei vasi.

---

## Debito noto

Raccolto nell'audit del 2026-07-27 confrontando documentazione e codice, **rivisto il
2026-07-31** dopo la riscrittura del firmware (commit `c146237`, non documentata al
momento). Il firmware non è più un unico `vaso.ino` monolitico ma modulare: entry
point **`firmware/vaso/vaso-testnale.ino`** (nome non allineato, probabile refuso —
verificare se va rinominato) + `config.h/.cpp`, `ble_provisioning.h/.cpp`,
`wifi_manager.h/.cpp`, `mqtt_handler.h/.cpp`, `sensors.h/.cpp`, `sleep_manager.h/.cpp`.

### Chiuse dalla riscrittura firmware (2026-07-31)

**D1 — Nomi dei campi nel payload BLE.** ✅ Risolto. `ble_provisioning.cpp` legge
`mqtt_user`/`mqtt_pass`, allineato all'app (`mqtt_handler.cpp` li usa per il connect).

**D3 — Handler dei messaggi `config`.** ✅ Parziale. `mqttCallback` in
`mqtt_handler.cpp` ora esiste e gestisce il comando `"check"` (forza una lettura
immediata). Non gestisce ancora `sampling_interval_seconds` da remoto — resta da
aggiungere se serve cambiare l'intervallo senza reflash.

**D4 — Frequenza di campionamento.** ✅ Risolto (valore diverso dalla specifica).
`samplingInterval` ora è 30 minuti (`config.cpp`), non più 3 secondi. Le specifiche
indicano 15 minuti (5 in allerta): valutare se allineare o aggiornare la specifica.

**D5 — Batteria mai inviata.** ✅ Risolto. `sensors.cpp` legge l'ADC (GPIO34, partitore
100k/100k), converte in percentuale con curva di scarica Li-ion 1S e la passa a
`publishTelemetry()`; `batteria_scarica:true` sotto il 20%.

**D6 — Sensori non inizializzati.** ✅ Risolto. `initSensors()` chiama
`lightMeter.begin()` e `bmp.begin(0x76)` davvero (non più commentati).

**D7 — Reset fisico.** ✅ Risolto (2026-08-14, chiude anche **MEV-05**). Pin 13 con
interrupt (`handleResetInterrupt`): a runtime cancella le credenziali WiFi e rilancia
il provisioning BLE; a GPIO13 tenuto a GND al boot forza la stessa cancellazione.
Aggiunto anche un secondo modo di innescare lo stesso reset (senza accesso fisico al
vaso): comando MQTT `"reset"` sul topic `config`, azionabile da `POST
/vases/:id/reset-wifi`. Lato app, dettaglio vaso → "Riconfigura WiFi" → conferma →
`app/vase/reconnect-wifi.tsx` (nuova schermata, riusa la meccanica BLE di
`vase/pair.tsx` estratta in `src/lib/bleProvisioning.ts`) → scan → nuove credenziali
WiFi via `GET /vases/:id/reconnect-credentials` (stesso `device_id` del vaso
esistente, nessun nuovo pairing/vaso duplicato).

**D11 — Niente advertising se la connessione fallisce.** ✅ Risolto. `setup()` ora
ritenta in loop `startBLEProvisioning()` finché `connectWiFi()` non riesce; il vaso non
resta più bloccato irraggiungibile con credenziali sbagliate.

### Bloccanti per la Fase 6 rimasti aperti

**D2 — Collega/scollega pianta dal dettaglio vaso non affidabile.**
Le azioni "Cambia pianta" e "Scollega" restituiscono "Operazione non riuscita"
nell'app, ma lo stesso payload via `curl` riceve 200 dal backend. Il fallimento
coincideva con un episodio di corruzione I/O di Docker Desktop, risolto; non è stato
riverificato dopo. Indagare prima lato client (stato React non aggiornato, richiesta
inviata prima che il vaso sia caricato) che lato backend. **Non toccato dalla
riscrittura firmware**, resta da investigare.

### Nuovi problemi emersi dall'audit del firmware riscritto (2026-07-31)

**D12 — `bmp.begin()` fallito blocca il boot per sempre.** `sensors.cpp:78-81`: se il
BMP280 non risponde all'indirizzo I2C atteso, `initSensors()` entra in `while(1)`
infinito. Il vaso non pubblica nemmeno lo stato offline (il blocco è prima della
connessione MQTT/WiFi) — un sensore mal collegato o difettoso rende il vaso muto senza
diagnosi possibile da remoto.

**D13 — `Adafruit_BME280 bme` dichiarato e mai usato.** `sensors.cpp:20`, commento
esplicito nel codice. Il sensore di temperatura/pressione in uso è il BMP280 (`bmp`),
non il BME280 (niente umidità aria, nonostante il nome del tipo dichiarato). Da
rimuovere o chiarire se un domani si vuole davvero leggere l'umidità dell'aria.

### Firmware — ancora indietro rispetto alle specifiche

**D8 — Buffer offline.** Non implementato: i dati raccolti senza WiFi sono persi.

**D9 — Endpoint del broker non trasmessi nel pairing.** 🚧 Implementato il 2026-07-31,
non ancora testato su hardware. `mobile/app/vase/pair.tsx` ora estrae host e porta da
`brokerUrl` (già restituito da `startPairing()`) e li aggiunge al payload BLE
(`mqtt_host`/`mqtt_port`); il firmware (`config.h/.cpp`, `ble_provisioning.cpp`,
`wifi_manager.cpp`, `mqtt_handler.cpp`) li riceve, salva in NVS e usa in
`connectMQTT()` al posto delle costanti hardcoded. Verificare al prossimo pairing
reale che il campo numerico `mqtt_port` sia deserializzato correttamente da
ArduinoJson lato firmware.

### Altro

**D10 — Suite di test del backend non eseguibile.** ✅ Chiuso (verificato 2026-07-31):
`npm test` ora passa pulito, 153/153 (`node v20.20.2`, `jest 30.4.2`, `ts-jest
29.4.11`). L'errore "Preset ts-jest not found relative to rootDir" non si riproduce
più su questa macchina — probabile causa originale un `node_modules` incompleto/
corrotto, non un problema di configurazione. Se ricompare su un altro Mac, reinstallare
le dipendenze (`rm -rf node_modules && npm install`) prima di indagare oltre.

---

## Fasi rimandate e future

### Fase 5 — Diario fotografico ⏸️

Upload su MinIO, ridimensionamento a 1200 px e conversione WebP, timeline nel
dettaglio pianta. Rimandata il 2026-07-13 per dare precedenza al vaso smart.
MinIO è già in piedi e inutilizzato.

### Fase 7 — Alert da sensore ⏸️

Soglie sui valori dei sensori che generano task di sorgente `sensore`, con il
gruppo rosso già predisposto nella schermata Oggi, più le notifiche push relative
(escluse dalla Fase 8) e il toggle "Alert sensori" nelle impostazioni.
Dipende dalla chiusura della Fase 6.

### Fase 9 — Catalogo specie esteso 📋

Due meccanismi sulla stessa tabella `species_import_raw`, distinti dalla colonna `fonte`:

- **dev e test:** import manuale via CSV di un set ridotto di piante (script da scrivere,
  dentro `/backend`);
- **produzione:** import massivo dell'indice Trefle (~437.000 specie, circa 3–4 ore una
  tantum a 120 richieste/minuto, job riprendibile con checkpoint di pagina),
  arricchimento dei dettagli su richiesta alla prima selezione di una specie,
  risincronizzazione **settimanale** — non giornaliera: 3–4 ore di scansione per un
  dataset che cambia di rado non giustificano la frequenza.

Più: ricerca con indice trigram (`pg_trgm`), proposta di specie da parte degli utenti
con verifica locale, area admin di moderazione.

**Vincolo noto:** Trefle non ha dati di cura utilizzabili (campi `growth` quasi sempre
nulli, verificato anche su Monstera deliciosa). Serve per nomi, ricerca e immagini;
i reminder continuano a basarsi sul catalogo curato interno.

**Rischi:** Trefle è storicamente instabile ed è già stato offline in passato — la copia
locale è proprio la mitigazione. I dati sono in licenza ODbL: la copia locale è lecita
con attribuzione ("Powered by Trefle") in app, da verificare prima di un rilascio pubblico.

### Fase 10 — Apple Sign-In e rifinitura UI 🚧

Già fatto il 2026-07-13: inversione dell'onboarding e pagina intro a 3 slide.
Restano: Apple Sign-In (richiede un account Apple Developer), "fiori nel bouquet",
empty state con suggerimenti.

### Post-MVP 📋

- **Offline / cache locale SQLite** — fuori scope MVP: per il prototipo bastano
  pull-to-refresh e messaggi di errore di rete.

Email transazionali e cambio email erano parcheggiate qui: sono state promosse a
**MEV-02** (priorità alta) perché senza recupero password un utente che la dimentica
perde definitivamente l'accesso all'account.

---

## Manutenzione evolutiva (MEV) 📋

Migliorie a funzioni già esistenti, ognuna rilasciabile in modo autonomo dopo la
Fase 6. Specifiche complete in **`fiora-mev.md`**.

| ID | Intervento | Priorità |
|---|---|---|
| MEV-01 | Orario dei promemoria libero (oggi 3 fasce fisse) | Alta |
| MEV-02 | Email transazionali e recupero password | 🚧 Alta — recupero password fatto (2026-07-31), cambio email e conferma eliminazione da fare |
| MEV-03 | Rinominare e riordinare i vasi | 🚧 Media — rinomina completa, backend riordino pronto, UI mobile da ripianificare (2026-08-14) |
| MEV-04 | Storico ambientale a 7 e 30 giorni | Media |
| MEV-05 | Riconfigurazione WiFi senza ri-pairing (copre il debito D7) | ✅ completa (2026-08-14) |
| MEV-06 | Empty state con suggerimenti | Bassa |
| MEV-07 | Esportazione dei dati utente (portabilità GDPR) | Bassa |

---

## Distribuzione e ambienti

**Decisione 2026-07-24:** niente TestFlight per ora (manca un account Apple Developer).
Le build di test si installano a mano via Xcode e cavo su iPhone, o con
`expo run:android --device` su Android.

**Staging** gira su un server Ubuntu in rete locale, con Postgres e Redis dedicati.
Deploya da `develop` a ogni push. Il profilo EAS `staging` punta all'IP Tailscale del
server, così funziona anche fuori casa. Dettagli in `fiora-manuale-ambienti.md`.

---

## Workflow Git

Git Flow: `main` (solo release taggate), `develop` (lavoro quotidiano, deploya in
staging), `feature/*`, `release/x.y.z`, `hotfix/*`.
Versioning SemVer con tag su `main`, `CHANGELOG.md` aggiornato a ogni release.
Commit in stile Conventional Commits.
