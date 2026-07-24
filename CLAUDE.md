# Fiora — Contesto progetto per Claude Code

## Cos'è questo progetto
App mobile per la cura delle piante con integrazione IoT (vaso smart con sensori).
Monorepo con backend Node.js (`/backend`) e app mobile React Native/Expo (`/mobile`).

## Stato attuale sviluppo
**Fase 0 ✅ — Fase 1 ✅ — Fase 2 ✅ — Fase 3 ✅ — Fase 4 ✅ — Fase 4.5 ✅ — Fase 8 ✅** (push calendario, 2026-07-13) + **Fase 10 parziale** (onboarding invertito + pagina intro).
Decisione utente (2026-07-13): MinIO/Fase 5 e vaso smart (Fasi 6-7) rimandati — prossimo obiettivo: **ambiente di test + TestFlight**.
Tag `v0.1.0` su `main` (2026-07-24) = baseline di questo stato. Decisione (2026-07-24): niente TestFlight per ora, build di test installate manualmente via Xcode+cavo su iPhone reale; staging gira su server Ubuntu locale (stessa rete LAN di casa).

## Workflow Git (Git Flow)
- **`main`**: solo release taggate, sempre deployabile/stabile. Mai commit diretti.
- **`develop`**: branch di lavoro quotidiano, base per le feature. Deploya in **staging** (server Ubuntu) ad ogni push/merge — ambiente di test continuo.
- **`feature/*`**: da `develop`, merge in `develop` a fine lavoro.
- **`release/x.y.z`**: da `develop` quando si stabilizza una versione candidata per test manuale su iPhone. Solo bugfix qui dentro, no nuove feature. A fine stabilizzazione: merge in `main` (tag `vx.y.z`) **e** back-merge in `develop`.
- **`hotfix/*`**: da `main`, per fix urgenti su una release già taggata. Merge in `main` (nuovo tag patch) **e** back-merge in `develop`.
- **Versioning**: SemVer (`vMAJOR.MINOR.PATCH`), tag git su `main` ad ogni release. `CHANGELOG.md` aggiornato ad ogni release (sezione `[Unreleased]` durante lo sviluppo). Mobile: `app.json` `version`/`ios.buildNumber` allineati al tag alla creazione del branch `release/*`.

### Completato
- Infrastruttura Docker locale: PostgreSQL (TimescaleDB), Redis, MinIO
- Schema Prisma completo con migrate (`npx prisma migrate dev`)
- TimescaleDB hypertable su `sensor_readings` (retention 90 giorni)
- MQTT subscriber attivo sul backend (`src/lib/mqtt.ts`) — connesso a HiveMQ Cloud
- Auth completa: `/auth/register|login|refresh|logout`, OAuth Google (`/auth/oauth/google`), Apple (backend pronto, credenziali mancanti), account deletion con grace period 30gg (BullMQ)
- Campo `name` su User (opzionale, backfill da Google)
- **Fase 2**: CRUD `/plants` (soft delete), task `/plants/:id/tasks` + `/tasks` (completa/rimanda/salta con action log), catalogo `/species` in sola lettura, seed 6 specie curate (`npm run seed`)
- **Fase 3**: reminder engine BullMQ (`src/services/reminder.service.ts`, `src/jobs/reminder.job.ts`) — job ricorrente (repeatable, cron `0 6 * * *` via `upsertJobScheduler`) genera task `annaffiatura` sorgente `calendario` per piante attive con specie collegata, intervallo giorni mappato da `Species.annaffiatura` (poca=10gg/media=5gg/frequente=2gg, hardcoded in `INTERVALLO_ANNAFFIATURA_GIORNI`); piante senza specie o bouquet escluse
- Swagger su `/docs`, export OpenAPI JSON su `/docs.json` (import Postman)
- Test jest: 153 passati (route + service, prisma mockato)
- Mobile: Expo Router, onboarding clima → auth, login/registrazione email, Google Sign-In nativo funzionante (dev build EAS simulatore iOS), token in SecureStore, refresh interceptor
- **Fase 4**: UI mobile — tab bar custom (Oggi/Piante/Aggiungi/Vasi/Impostazioni), schermata Oggi (task con Completa/Rimanda/Salta), collezione grid con filtri, dettaglio pianta/bouquet (guida cura, ciclo vita, azioni rapide), form aggiungi/modifica con picker specie, impostazioni con logout; Vasi placeholder (Fase 6)
- **Fase 4.5 backend** (2026-07-13): migration `fase_4_5_consolidamento` — User (+`onboardingDone`, `mostraNomiScientifici`, `orarioReminder`, `role`, `pushToken`), Plant (+`statoBouquetManuale`), tabella `app_options` (unique `categoria+chiave`); reminder engine esteso (`runReminderEngine`): fattore clima su annaffiatura (`FATTORE_CLIMA`: freddo 1.3/temperato 1.0/appartamento 1.0/mediterraneo 0.8/tropicale 0.7, min 1gg), concimazione 30gg solo mar-ott, bouquet `cambio_acqua` 2gg + `controllo_stato` 1gg + stato automatico da `dataRicezione` (0-2 fresco/3-6 in_cura/7-10 appassendo/>10 concluso, skip se `statoBouquetManuale`); `ricalcolaScadenzeClima` su cambio clima (solo piante `vasoId:null`); TASK_TYPES +5 tipi (`cambio_acqua`, `taglio_steli`, `controllo_stato`, `rotazione`, `pulizia_foglie`; `controllo` deprecato); rimanda rifiuta scadenza passata (`TASK_SCADENZA_PASSATA`); flag derivato `inRitardo` (pending + scadenza >3gg fa) in ogni response task; archiviazione pianta ora salta i task pending (come delete); `giaInAcqua` su create bouquet → task iniziale `cambio_acqua`; nuovi endpoint `GET /auth/me`, `POST /auth/change-password`, `PATCH /users/me` (name/clima/mostraNomiScientifici/orarioReminder), `GET /options[/:categoria]`, `GET /plants/:id/actions` (storico paginato, filtri tipo/periodo); login con grace period non blocca più: restituisce `graceperiod {active, deletedAt, giorniRimanenti}`; seed: 12 specie + 39 `app_options`; test 133 passati
- **Fase 4.5 mobile** (2026-07-13, commit `f0df682`): banner grace period con annulla eliminazione, preset Rimanda 2h/domani/2gg, conferma "ELIMINA" su delete pianta, schermata Storico cure, indicatore `inRitardo`, cambio password, clima in Impostazioni, `giaInAcqua` su create bouquet
- **Fase 8 backend** (2026-07-13): push Expo solo reminder calendario (niente alert sensori, rimandati a Fase 7) — `notification.service.ts` (`buildPushMessage`: 1 task → "🌱 Annaffia <Nome>" deep link `/plant/<id>`, N task → digest "Hai N cure da fare oggi" deep link `/`), coda BullMQ `push-reminders` + `notification.job.ts` (cron `0 9,15,19 * * *`, worker mappa ora→`orarioReminder` via `orarioFromHour`), utenti con `pushToken` non null e task pending `scadenza <= endOfDay`; ticket `DeviceNotRegistered` → azzera `pushToken`; `pushToken` (string|null) su `PATCH /users/me` e nelle select profilo; `expo-server-sdk@3` (v4 è ESM-only, backend CommonJS); test 153 passati
- **Fase 8 mobile** (2026-07-13): `expo-notifications`+`expo-device` (plugin in app.json — richiede rebuild dev client EAS), hook `src/hooks/usePushNotifications.ts` (register/disable + `useNotificationObserver` per tap → deep link, cold start incluso), toggle Notifiche + riga Orario promemoria in Impostazioni; token iOS solo su device reale (simulatore: fallisce con grazia)
- **Onboarding invertito + intro** (2026-07-13, Fase 10 parziale): pagina intro pre-auth 3 slide (`app/(auth)/index.tsx`), flusso intro → auth → login/register → clima post-auth (`app/onboarding/climate.tsx`, gated da `onboardingDone` in `(tabs)/_layout`, gate soft se profilo non caricato); `pendingClima` rimosso dallo store; prompt permessi push a fine onboarding
- Repository GitHub privato

### Prossimi passi
- **Ambiente staging** (in corso, 2026-07-24): backend in Docker su server Ubuntu locale (LAN casa), Postgres+Redis dedicati staging, `.env.staging`, `docker-compose.staging.yml`; mobile build EAS profilo `staging` puntata a IP LAN del server, installata su iPhone via Xcode+cavo (no TestFlight, manca account Apple Developer)
- Script import CSV specie in `species_import_raw` (da scrivere, dentro /backend)
- Rimandati: Fase 5 (foto MinIO), Fasi 6-7 (vaso smart), fiori bouquet, empty state suggerimenti
- QA push su device reale: token iOS, ricezione notifiche, tap → deep link
- TestFlight + Apple Sign-In: rimandati, richiedono account Apple Developer

### Note build iOS locale (npx expo run:ios)
- Lo spazio nei path ("SSD Lexar", "Fiora TG") rompe script di build RN/Expo. Patch attive:
  - `mobile/patches/expo-constants+18.0.13.patch` (via patch-package, postinstall) — quoting in EXConstants podspec e get-app-config-ios.sh
  - Fase "Bundle React Native code and images" in `ios/mobile.xcodeproj` ha lo stesso bug (backtick non quotato) — NON ancora patchata, build locale fallisce lì; per ora si usa EAS
- Xcode 26 richiede runtime simulatore iOS 26 (scaricato)

## Scelte progettuali fatte (con motivazione)
- **Reminder engine su BullMQ repeatable job** (`upsertJobScheduler`, cron `0 6 * * *`) invece di cron di sistema: già usiamo BullMQ per account deletion, un solo meccanismo di scheduling
- **Intervalli annaffiatura e fattori clima come costanti backend** (`INTERVALLO_ANNAFFIATURA_GIORNI`, `FATTORE_CLIMA` in reminder.service.ts) — `app_options` esiste (Fase 4.5) ma serve solo per le dropdown UI, non per la logica reminder; spostamento eventuale post-MVP
- **statoBouquetManuale** (Fase 4.5): PATCH esplicito di `statoBouquet` imposta il flag e il cron non ricalcola più lo stato; nessun modo di riattivare l'automatismo (fuori scope)
- **Grace period non blocca il login** (Fase 4.5): `AUTH_ACCOUNT_DELETED` rimosso, la risposta login include `graceperiod` — il mobile mostra banner con annulla eliminazione
- **Compound unique Prisma 7**: il nome nel client è quello dell'attributo `@@unique(name:...)` (es. `uq_app_options_categoria_chiave`), NON `campo1_campo2`
- **Riferimento scadenza task**: `completatoA ?? createdAt` dell'ultimo task annaffiatura, altrimenti `plant.createdAt`; skip se esiste già task pending (no duplicati)
- **Google Sign-In**: client OAuth Web (ID token verificato dal backend), flusso nativo via dev build EAS — Expo Go non supporta il modulo nativo
- **Apple Sign-In**: backend pronto, bottone mobile placeholder — mancano credenziali Apple Developer
- **Dark mode**: `userInterfaceStyle: "automatic"` in app.json (era "light", bloccava il tema scuro; richiede rebuild nativa perché finisce in Info.plist)
- **Guard auth nelle tabs**: `app/(tabs)/_layout.tsx` fa `Redirect` a `/(auth)/climate` se non autenticato; NON esiste `app/index.tsx` (creava conflitto di route con `(tabs)/index.tsx`, entrambi risolvono `/`)
- **SpeciesPickerModal condiviso** tra add-plant ed edit-plant, ricerca con debounce 250ms su `/species`
- **Trefle** (deciso dopo verifica live API): import completo indice in DB locale (437k specie, ~3-4h, rate limit 120 req/min), sync SETTIMANALE (non giornaliero: dataset stabile, scan costoso), ricerca pg_trgm. Trefle NON ha dati di cura → i reminder restano basati sulle nostre specie curate
- **Catalogo grezzo generico** (2026-07-13): tabella `trefle_species_raw` rinominata in **`species_import_raw`** (model `SpeciesImportRaw`) con campi generici `externalId` (era trefleId), `updatedAtSource` e nuova colonna `fonte` (`'csv'|'trefle'`, default csv); anche `Species.trefleId` → `Species.externalId`. Motivo: in dev/test il catalogo esteso si popola via **import CSV manuale** con poche specie, Trefle resta il meccanismo di produzione (Fase 9). Migration `rinomina_catalogo_import_generico`. Script import CSV da scrivere (dentro /backend, vedi lezione ts-node)
- **docs/ e CLAUDE.md versionati** in git (tolti da .gitignore, repo privato)
- **Build iOS**: EAS come via principale; build locale accantonata per bug path con spazi (vedi sopra)
- **Push notifications (Fase 8, 2026-07-13)**: stile "digest + singola smart" (1 task → notifica specifica con deep link pianta, N → digest); notifiche attive = `pushToken != null` (nessuna colonna `enable_notifications`); orario invio per-utente da `orarioReminder` (cron unico `0 9,15,19 * * *`, worker filtra per fascia); niente polling receipts Expo (solo errori ticket, `DeviceNotRegistered` → token azzerato); alert sensori esclusi (Fase 7)
- **expo-server-sdk pinnato a v3**: v4+ è ESM-only e il backend è CommonJS (`TS1479` in build) — non aggiornare a v4 senza migrare il modulo system
- **Onboarding invertito (2026-07-13)**: prima auth, poi clima come step post-login (`/onboarding/climate`) gated da `onboardingDone`; gate soft (profilo null offline → entra nei tabs); `pendingClima` eliminato; utenti esistenti con `onboardingDone:false` vedono il clima una volta al login successivo

## Errori corretti / lezioni apprese
- **`docker exec` senza `-i`**: heredoc psql ignora stdin silenziosamente (exit 0, insert non eseguiti) — usare sempre `docker exec -i` e verificare con SELECT
- **Conflitto route Expo Router**: `app/index.tsx` + `app/(tabs)/index.tsx` insieme rompono la risoluzione di `/` — tenere solo quello nel gruppo tabs
- **Path con spazi rompe build iOS**: `bash -c "$VAR"` word-splitta il path espanso; fix con quoting interno, persistito via patch-package (vedi Note build)
- **Prisma mock nei test**: nuove code BullMQ vanno aggiunte anche in `src/lib/__mocks__/bullmq.ts` o i test route falliscono
- **ts-node fuori dal progetto**: script in /tmp non compilano (moduleResolution node16) — script one-off vanno dentro /backend, lanciati con `ts-node-dev --transpile-only`
- **Trefle base URL**: l'env contiene già `/api/v1` — non riaggiungerlo nel client (404 su `/api/v1/api/v1`)
- **Trefle campo `growth`**: quasi sempre null anche su specie comuni (verificato su Monstera deliciosa) — mai contarci per dati di cura

## Stack tecnico

### Backend (`/backend`)
- Node.js 20 + Express 5 + TypeScript (strict) — nota: con i tipi Express 5 `req.params.x` è `string | string[]`, serve cast
- Prisma 7 ORM (PostgreSQL)
- Redis (ioredis)
- mqtt.js per subscriber HiveMQ Cloud
- express-validator, express-rate-limit, helmet, bcrypt, jsonwebtoken

### Mobile (`/mobile`)
- Expo SDK 54 + React Native + TypeScript
- mqtt.js (connessione via WebSocket wss://)
- Zustand (state management — store auth in `src/store/auth.store.ts`)
- Expo Router (navigazione file-based: gruppo `(auth)` onboarding, gruppo `(tabs)` app principale)
- Axios (`src/services/api.ts`) con interceptor refresh token; token in expo-secure-store
- react-native-svg per le icone; tema light/dark in `src/theme/` agganciato a `useColorScheme()`

### Database
- PostgreSQL 16 + TimescaleDB (container: `fiora-postgres-dev`)
- Redis 7 (container: `fiora-redis-dev`)
- MinIO (container: `fiora-minio-dev`, bucket: `fiora-photos`)

## Configurazione MQTT
- **Broker:** HiveMQ Cloud (piano gratuito, cluster condiviso dev+staging)
- **Host:** `6c6f661a355149fbb2e308bc4a2ed846.s1.eu.hivemq.cloud`
- **Porta backend (TCP/TLS):** 8883 — protocollo `mqtts://`
- **Porta mobile (WebSocket/TLS):** 8884 — protocollo `wss://`, path `/mqtt`
- **Autenticazione:** username/password (vedere `.env.development`)
- **Topic telemetria vasi:** `fiora/vaso/{device_id}/telemetry`
- **Topic status vasi:** `fiora/vaso/{device_id}/status`
- **Topic config vasi:** `fiora/vaso/{device_id}/config`
- In production si usa Mosquitto self-hosted (non HiveMQ) per compatibilità firmware ESP32

## Struttura cartelle backend
```
backend/
├── src/
│   ├── index.ts              ← entry point, avvia Express + MQTT subscriber
│   ├── app.ts                ← Express setup, middleware globali, routes
│   ├── lib/
│   │   ├── prisma.ts         ← Prisma client singleton
│   │   ├── redis.ts          ← Redis client singleton
│   │   └── mqtt.ts           ← MQTT subscriber HiveMQ Cloud
│   ├── middleware/
│   │   └── auth.middleware.ts ← JWT requireAuth middleware
│   ├── services/             ← auth, plants, tasks, species, reminder
│   ├── jobs/                 ← worker BullMQ (reminder.job.ts, account deletion)
│   └── routes/               ← /auth, /plants, /tasks, /species
├── prisma/
│   └── schema.prisma         ← schema completo (users, plants, species, tasks, ecc.)
└── generated/
    └── prisma/               ← client generato da `npx prisma generate`
```

## Comandi principali
```bash
# Backend (da /backend)
npm run dev                                    # avvia con hot reload
npx prisma generate                            # rigenera client Prisma
npx prisma migrate dev --name <nome>           # crea nuova migration
npx prisma studio                              # GUI database

# Mobile (da /mobile)
npx expo start -c                              # avvia con cache pulita
npx expo install <pacchetto>                   # installa dipendenza compatibile SDK

# Docker (dalla root /fiora)
docker compose -f docker-compose.dev.yml up -d    # avvia infrastruttura
docker compose -f docker-compose.dev.yml down -v  # reset completo con dati
docker compose -f docker-compose.dev.yml ps        # stato container
```

## Ambiente staging (server Ubuntu locale)
- Server Ubuntu: IP LAN `192.168.1.50`, IP Tailscale `100.102.50.17`
- File: `docker-compose.staging.yml` (root) + `backend/Dockerfile` + `backend/.env.staging` (da `.env.staging.example`, mai committato)
- Deploy da `develop` (staging riflette sempre l'ultimo `develop`):
```bash
# Sul server Ubuntu, dentro il repo (branch develop)
git pull origin develop
docker compose -f docker-compose.staging.yml up -d --build
docker compose -f docker-compose.staging.yml exec backend npx prisma migrate deploy
```
- Backend raggiungibile su `http://192.168.1.50:3000` (LAN) o `http://100.102.50.17:3000` (Tailscale, da qualsiasi rete)
- Mobile: profilo EAS `staging` in `mobile/eas.json` usa **l'IP Tailscale** (`EXPO_PUBLIC_API_URL=http://100.102.50.17:3000`) — funziona sia in LAN casa sia fuori (Tailscale instrada diretto se stesso subnet, altrimenti via relay). Richiede app Tailscale installata e autenticata sull'iPhone di test.
```bash
# Da /mobile
eas build --profile staging --platform ios
```
- Install su iPhone: cavo USB + Xcode → Window → Devices and Simulators → trascina l'`.ipa` scaricato (no TestFlight, manca account Apple Developer)

## Convenzioni codice
- TypeScript strict, nessun `any` esplicito
- Tutti gli endpoint rispondono `{ success: true, data: ... }` oppure `{ success: false, error: { code, message } }`
- I codici errore sono stringhe uppercase: `AUTH_TOKEN_EXPIRED`, `VALIDATION_ERROR`, ecc.
- Il backend è l'unico responsabile della logica di business — l'app mobile è solo presentazione
- Commit in stile Conventional Commits: `feat(auth): aggiunge refresh token`

## File sensibili (mai committare)
- `backend/.env` e `backend/.env.development`
- `mobile/.env.development`
- Tutti coperti da `.gitignore`

## Roadmap fasi
(dettaglio revisioni in `docs/fiora-specifiche-integrazioni-v1.md`)
- **Fase 0** ✅ Setup infrastruttura
- **Fase 1** ✅ Backend Core + Autenticazione
- **Fase 2** ✅ CRUD piante + task (+ catalogo specie read-only)
- **Fase 3** ✅ Reminder engine (BullMQ)
- **Fase 4** ✅ App mobile UI (schermate principali)
- **Fase 4.5** ✅ backend + mobile (2026-07-13)
- **Fase 5** Foto diario (MinIO) — rimandata (decisione 2026-07-13)
- **Fase 6** Integrazione vaso smart (MQTT → DB, schermate Vasi, pairing BLE) — rimandata
- **Fase 7** Alert sensori (+ push per alert, esclusi da Fase 8) — rimandata
- **Fase 8** ✅ Notifiche push Expo (2026-07-13, solo reminder calendario)
- **Fase 9** Catalogo esteso: in dev/test import CSV manuale in `species_import_raw` (`fonte='csv'`, set ridotto — script da scrivere); in prod import massivo Trefle (`fonte='trefle'`, 437k specie, ~3-4h una tantum), arricchimento dettagli on-demand, sync settimanale, ricerca pg_trgm, proposta specie + area admin. NB: Trefle NON ha dati di cura (verificato: growth null anche per Monstera) — serve solo per ricerca/nomi/immagini
- **Fase 10** Apple Sign-In + rifinitura UI (fiori bouquet, empty state suggerimenti) — inversione onboarding + pagina intro ✅ fatte il 2026-07-13
- **Post-MVP** Email transazionali, offline SQLite, cambio email

## Note importanti
- Prisma 7: il campo `url` NON va in `schema.prisma` ma in `prisma.config.ts` (già configurato)
- `moduleResolution` in tsconfig deve essere `node16` (non `node`)
- Expo SDK 54 (non 56 — downgrade per compatibilità con Expo Go)
- Il mobile si connette a MQTT via WebSocket (wss://), NON via TCP diretto
- `sensor_readings` è una TimescaleDB hypertable — non modificare la PK senza ricreare l'hypertable