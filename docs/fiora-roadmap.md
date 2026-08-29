# 🌿 Fiora — Roadmap di sviluppo

**Versione 2.1 · aggiornato al 2026-08-20**

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
| **6** | **Integrazione vaso smart (MQTT, pairing BLE, schermate)** | ✅ **completa (2026-08-18)** |
| 7 | Alert da sensore | ⏸️ rimandata |
| 8 | Notifiche push Expo | ✅ 2026-07-13 |
| 9 | Catalogo specie esteso (CSV in dev, Trefle in prod) | 🚧 parziale — proposta specie utente ✅ |
| 10 | Apple Sign-In + rifinitura UI | 🚧 parziale |
| 16 | Aggiornamento firmware OTA | 📋 pianificata, da fare prima del rilascio in produzione |
| Post-MVP | Offline SQLite | 📋 parcheggio |
| MEV | Interventi evolutivi su funzioni esistenti — vedi `fiora-mev.md` | 📋 9 voci |

Tag `v0.1.0` su `main` (2026-07-24) = baseline pre-Fase 6.
Fase 6 dichiarata completa il 2026-08-18: pairing BLE testato end-to-end su hardware
reale (Android + ESP32), firmware modulare, credenziali MQTT verificate su HiveMQ
Cloud. Nessun test end-to-end pendente — vedi dettaglio più sotto.

Le email transazionali e il cambio email, prima parcheggiate a post-MVP, sono diventate
**MEV-02** con priorità alta: senza, chi dimentica la password perde l'account.

Lo stress test del 2026-08-28 ha aperto il **debito di efficienza backend D20–D31**
(backend CPU-bound, 4 core al 70–90% sotto carico modesto): dettaglio e ordine di
intervento nella sezione dedicata in `## Debito di efficienza backend`.

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

## Fase 6 — Integrazione vaso smart ✅ (completa, 2026-08-18)

Backend, app e firmware scritti e **validati su hardware reale**: pairing BLE
end-to-end su device Android reale + ESP32 fisico, utente MQTT condiviso verificato
con permessi corretti su HiveMQ Cloud (publish/subscribe su `fiora/vaso/+/...`).
Nessun test end-to-end pendente per questa fase.

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

### Chiusura fase (2026-08-18)

1. ~~Test end-to-end su hardware reale~~ — **fatto** (2026-08-18): pairing completo
   ripetuto dopo l'aggiunta di `mqtt_host`/`mqtt_port` (D9), su ESP32 fisico + Android
   reale. Esito positivo.
2. ~~Allineare i nomi dei campi nel payload BLE~~ — **fatto**, vedi D1 (chiuso).
3. ~~Verificare i permessi dell'utente MQTT~~ — **fatto** (2026-08-18): publish e
   subscribe su `fiora/vaso/+/...` verificati su HiveMQ Cloud.
4. ~~Investigare il bug collega/scollega pianta~~ — **fatto**, vedi D2 (chiuso).
5. Ordinamento della collezione "per prossima azione" e filtro "con vaso smart"
   (§3.1 funzionali) restano da fare ma non bloccano la chiusura della fase — spostati
   come lavoro autonomo, non hanno altre dipendenze non soddisfatte.

---

## Debito noto

Raccolto nell'audit del 2026-07-27 confrontando documentazione e codice, **rivisto il
2026-07-31** dopo la riscrittura del firmware (commit `c146237`, non documentata al
momento) e **di nuovo il 2026-08-18** dopo il test end-to-end su hardware reale che ha
chiuso D2/D9/D10 (dettagli sotto). Il **2026-08-28** aggiunto il debito di efficienza
backend **D20–D31**, dallo stress test (backend CPU-bound: 4 core al 70–90% sotto carico
modesto) — vedi sezione dedicata in fondo. Il firmware non è più un unico `vaso.ino`
monolitico ma modulare: entry point **`firmware/vaso/vaso-testnale.ino`** (nome non
allineato, probabile refuso — verificare se va rinominato) + `config.h/.cpp`,
`ble_provisioning.h/.cpp`, `wifi_manager.h/.cpp`, `mqtt_handler.h/.cpp`,
`sensors.h/.cpp`, `sleep_manager.h/.cpp`.

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

Nessuno — fase chiusa il 2026-08-18.

### Chiuse dopo l'audit del 2026-07-31

**D2 — Collega/scollega pianta dal dettaglio vaso non affidabile.** ✅ Risolto
(`f8539f8`, 2026-08-14). Causa reale: `updatePlant` scollegava il vaso dalla pianta
precedente e collegava quella nuova in due query separate senza transazione — se la
prima falliva, o la richiesta partiva con stato client non aggiornato, il vaso
restava agganciato alla pianta sbagliata o l'update falliva con `VASE_ALREADY_LINKED`
anche a fronte di un cambio pianta legittimo. Fix: singola transazione Prisma
(scollega pianta precedente se presente + aggiorna quella nuova, atomico). Non era
Docker Desktop come sospettato inizialmente.

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

**D9 — Endpoint del broker non trasmessi nel pairing.** ✅ Risolto e verificato su
hardware (2026-08-18). `mobile/app/vase/pair.tsx` estrae host e porta da `brokerUrl`
(già restituito da `startPairing()`) e li aggiunge al payload BLE
(`mqtt_host`/`mqtt_port`); il firmware (`config.h/.cpp`, `ble_provisioning.cpp`,
`wifi_manager.cpp`, `mqtt_handler.cpp`) li riceve, salva in NVS e usa in
`connectMQTT()` al posto delle costanti hardcoded. Pairing reale ripetuto con esito
positivo, `mqtt_port` deserializzato correttamente da ArduinoJson.

### Altro

**D10 — Suite di test del backend non eseguibile.** ✅ Chiuso (verificato 2026-07-31):
`npm test` ora passa pulito, 153/153 (`node v20.20.2`, `jest 30.4.2`, `ts-jest
29.4.11`). L'errore "Preset ts-jest not found relative to rootDir" non si riproduce
più su questa macchina — probabile causa originale un `node_modules` incompleto/
corrotto, non un problema di configurazione. Se ricompare su un altro Mac, reinstallare
le dipendenze (`rm -rf node_modules && npm install`) prima di indagare oltre.

---

## Debito di efficienza backend — audit 2026-08-28

Dallo stress test: il backend è **CPU-bound** e satura il core del main thread già sotto
carico modesto (4 vCPU al 70–90%). Il backend è **un singolo processo Node** → un solo
core esegue JavaScript; gli altri core sotto carico sono Postgres, i worker-thread di
pino e la threadpool libuv (bcrypt). Le ottimizzazioni per-richiesta abbassano il costo
ma **non distribuiscono** il carico: per usare i core 2–N serve lo scaling orizzontale
(D20). La CPU-per-richiesta resta la stessa su qualsiasi macchina — dimezzarla dimezza
il costo infra e alza il tetto utenti.

Riferimenti `file:riga` relativi a `backend/`. Il test attuale (5 utenti, 5 righe, sole
letture) esalta D29 e il costo fisso per-richiesta (log, pool) e **nasconde** D23–D25 e
D28: per misurarli serve un seed realistico (100+ utenti, storico task di mesi, decine
di piante ciascuno) con le scritture riattivate.

### Strutturale — sblocca i core oltre il primo (produzione)

**D20 — Processo singolo, nessun clustering.** `Dockerfile:27` (`CMD ["node",
"dist/index.js"]`), `src/index.ts:18`. In prod con 2–N vCPU ne usa **uno solo** per
servire richieste. Fix: più repliche del container dietro reverse proxy (Nginx/Caddy —
**oggi assente del tutto**), una per vCPU, oppure PM2 cluster mode. È l'unico intervento
che distribuisce il carico. Prerequisito: D22 (dimensionare il pool per replica) e D21
(togliere i worker dal processo API, o le repliche eseguono N volte gli stessi job).

**D21 — Worker BullMQ nel processo API + reminder engine N+1 in scrittura.**
`src/index.ts:10-14` importa 4 Worker (`reminder`, `notification`, `account-deletion`,
`email`) nello stesso processo dell'HTTP. A regime il costo è basso (job 1×/giorno e
3×/giorno), ma `runReminderEngine` (`src/services/reminder.service.ts:49-96` e simili)
carica **tutte** le piante attive globali e fa `prisma.task.create` **una alla volta** in
loop: con 5–10k piante il run delle 6:00 pinna l'event loop per secondi e stalla l'HTTP.
Fix: (a) processo worker separato (`node dist/worker.js`, container distinto — Redis +
BullMQ già presenti); (b) riscrivere il reminder engine con `createMany`/`updateMany`
batch invece di N insert sequenziali.

**D22 — Pool di connessioni Prisma non configurato.** `src/lib/prisma.ts:10`:
`new PrismaPg({ connectionString })` senza opzioni. Con l'adapter `@prisma/adapter-pg`
il parametro `?connection_limit=` nell'URL **è inefficace** (agisce sul pool del
query-engine Rust, bypassato dal driver adapter); il pool reale è quello di `pg.Pool`,
default `max: 10`. Va impostato esplicitamente e dimensionato su `max_connections` di
Postgres ÷ (numero repliche D20 + worker D21):
```ts
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 10 });
```

### Per-richiesta — abbassa il tetto, fattibile subito

**D23 — Indici tasks mancanti/non allineati.** `prisma/schema.prisma:247`: unico indice
`(user_id, scadenza)`. Le query reali filtrano `user_id + stato` e ordinano `scadenza`
→ serve `(user_id, stato, scadenza)`. Il `_count` di `listPlants` (D25) filtra `tasks
WHERE plant_id + stato='pending'` → serve `(plant_id, stato)`. Due migration, alto
impatto sulle due rotte più chiamate.

**D24 — `GET /tasks` senza paginazione.** `src/services/task.service.ts:67-84`:
`listTasks` senza filtro `stato` restituisce **tutti** i task di sempre dell'utente
(completati inclusi), ognuno con `include: { plant }`. Un utente con anni di storico →
migliaia di righe a ogni chiamata. Fix: `take: 100` di default + cursor pagination.

**D25 — `GET /plants` — `_count` con filtro = subquery correlata per riga.**
`src/services/plant.service.ts:194-203`: `_count: { select: { tasks: { where: { stato:
'pending' } } } }` diventa uno scalare correlato eseguito per ogni pianta. Prima prova
**solo l'indice** `(plant_id, stato)` di D23 (rende il conteggio un index-count cheap);
se resta lento, sostituisci con `task.groupBy({ by: ['plantId'], where: { userId, stato:
'pending' }, _count: true })` in parallelo + merge in JS (2 query totali).

**D26 — `completeTask` non atomico + round-trip multipli.**
`src/services/task.service.ts:98-116`: `findOwnedTask` → `task.update` →
`actionLog.create`, 3 round-trip in serie; se `actionLog.create` fallisce il task resta
`completato` **senza log** (correttezza, non solo efficienza). Fix: `where: { id, userId
}` nell'update (fonde l'ownership check) + `prisma.$transaction([update, actionLogCreate])`.
Stesso pattern per `postponeTask`/`skipTask` (2→1 round-trip, togliendo `findOwnedTask`).

**D27 — Logging per-richiesta a `info` in prod su 3 stream.** `src/lib/logger.ts` +
`pino-http` in `src/app.ts:24`: ogni richiesta è loggata a `info` (default in prod) su
file `combined` (worker-thread) + stdout — serializzazione + IPC + write su disco per
ogni GET, health check e `/docs` inclusi. Fix: `autoLogging.ignore` per `/health` e
`/docs*`, e valutare `LOG_LEVEL=warn` per l'access log in prod (gli errori restano sul
loro stream dedicato).

**D28 — MQTT `handleTelemetry`: nessun limite di concorrenza + 3–4 query/messaggio.**
`src/lib/mqtt.ts:85-107`: `routeMessage` fa `handleTelemetry(...).catch(...)`
fire-and-forget, **senza backpressure** — con molti vasi o un burst di riconnessioni
QoS 1 le promesse concorrenti sono illimitate → query illimitate sullo **stesso pool
dell'API** (D22) → degradazione non lineare. Inoltre per ogni messaggio:
`smartVase.findUnique` + `plant.findFirst` + `sensorReading.create` +
`touchVaseLastSeen` (4 round-trip). Fix: concorrenza limitata (`p-limit`, o telemetrie
in una coda BullMQ con `concurrency` fissa); cache in memoria `deviceId → { vaseId,
plantId }`; batch degli insert (`createMany` ogni 2–5 s); `touchVaseLastSeen` throttled.

### Minori

**D29 — Verifica JWT sincrona a ogni richiesta + blacklist mai controllata.**
`src/middleware/auth.middleware.ts:26`: `jwt.verify` HS256 sull'event loop a ogni
richiesta autenticata (~0,05–0,15 ms — contributo, non tappo principale). Cache in
memoria opzionale (chiave = hash SHA-256 del token, TTL = `exp`). **Nello stesso punto**:
la blacklist Redis `blacklist:${userId}` è scritta da `auth.service.ts:352` (richiesta
eliminazione account) ma `requireAuth` **non la legge mai** — un access token resta
valido fino a scadenza (15 min) anche dopo la richiesta. Sistemare le due cose insieme:
cache + check blacklist sul miss.

**D30 — Nessun rate-limit oltre `/auth`.** `express-rate-limit` è applicato solo in
`src/routes/auth.routes.ts:15`. `/plants`, `/tasks`, `/species` non hanno limiti: un
client in loop (bug mobile o abuso) può saturare la CPU senza freni. Un limiter globale
è assicurazione a costo CPU trascurabile.

**D31 — Igiene varia.** (a) `express.json()` senza `limit` (`src/app.ts:23`) — aggiungere
`{ limit: '32kb' }`, impatto CPU ~0 ma buona pratica; (b) `BCRYPT_ROUNDS = 12`
(`src/services/auth.service.ts:12`) → 10 è ancora sicuro nel 2026 e dimezza la CPU per
login, utile contro burst di login post-deploy che saturano la threadpool libuv;
(c) `tsconfig.json:3` `target: ES2020` su Node 20 → alzare a `ES2022` (downlevel
async/await più verboso), marginale; (d) `updatePlant` (`src/services/plant.service.ts:227-274`)
fa fino a 5 query sequenziali prima della transazione — parallelizzabili con `Promise.all`,
PATCH è raro quindi priorità bassa; (e) ricerca specie (`src/services/species.service.ts:32-40`)
fa `findMany` + `count` a ogni keystroke con `ILIKE '%x%'` — nullo con 12 specie, da
sistemare quando arriva il catalogo esteso Fase 9 (indice `pg_trgm`, già previsto, +
togliere/limitare il `count`).

### Ordine consigliato

Prod: **D20 → D21 → D22** (strutturale, in quest'ordine per le dipendenze).
Subito, indipendenti: **D23** (indici) → **D25** (prova solo indice) → **D24** →
**D26** → **D27** → **D28**. Minori a seguire.

Atteso dopo D22+D23+D25 a parità di carico: CPU backend da ~72% a ~30–40%, p95 in forte
calo. Poi rilanciare lo stress test con il seed realistico.

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
— **revisione 2026-08-18**: niente più area admin di moderazione, la specie proposta
è attiva da subito ma visibile solo al proponente (dettagli in
`fiora-specifiche-funzionali.md` §12.3/§14 e `fiora-mev.md` MEV-09).

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

### Fase 16 — Aggiornamento firmware OTA 📋

Specifica di progetto completa in `fiora-specifiche-tecniche.md` §16 (modello dati,
protocollo MQTT, API backend, flusso app, rollback), **zero codice scritto**. Lavoro
firmware, va pianificato e fatto **prima del rilascio in produzione**: senza OTA ogni
fix richiede di smontare il vaso e riflasharlo via USB, insostenibile con vasi in mano
a utenti reali. Non prioritario finché si lavora su un solo prototipo via cavo.

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
| MEV-03 | Rinominare e riordinare i vasi | ⏸️ Media — in pausa (2026-08-18), rinomina completa, backend riordino pronto, UI mobile da ripianificare |
| MEV-04 | Storico ambientale a 7 e 30 giorni | Media |
| MEV-05 | Riconfigurazione WiFi senza ri-pairing (copre il debito D7) | ✅ completa e testata (2026-08-14/18) |
| MEV-06 | Empty state con suggerimenti | Bassa |
| MEV-07 | Esportazione dei dati utente (portabilità GDPR) | Bassa |
| MEV-08 | Soglie sensori personalizzabili per pianta + alert configurabili | 🚧 Step 1 (soglie per-pianta) ✅ completo e testato (2026-08-18); step 2 (alert, = Fase 7) da valutare — dettagli in `fiora-mev.md` |
| MEV-09 | Cura manuale per pianta (senza/con specie) + proposta specie utente | ✅ completa (2026-08-18) |

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
