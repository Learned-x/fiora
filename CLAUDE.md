# Fiora — Contesto progetto per Claude Code

## Cos'è questo progetto
App mobile per la cura delle piante con integrazione IoT (vaso smart con sensori).
Monorepo con backend Node.js (`/backend`) e app mobile React Native/Expo (`/mobile`).

## Stato attuale sviluppo
**Fase 0 ✅ — Fase 1 ✅ — Fase 2 ✅ — Fase 3 ✅ — Fase 4 ✅** (UI mobile completata e testata il 2026-07-08)

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
- Test jest: 75 passati (route + service, prisma mockato)
- Mobile: Expo Router, onboarding clima → auth, login/registrazione email, Google Sign-In nativo funzionante (dev build EAS simulatore iOS), token in SecureStore, refresh interceptor
- **Fase 4**: UI mobile — tab bar custom (Oggi/Piante/Aggiungi/Vasi/Impostazioni), schermata Oggi (task con Completa/Rimanda/Salta), collezione grid con filtri, dettaglio pianta/bouquet (guida cura, ciclo vita, azioni rapide), form aggiungi/modifica con picker specie, impostazioni con logout; Vasi placeholder (Fase 6)
- Repository GitHub privato

### Prossimi passi
- **Fase 4.5 (consolidamento)** — vedi `docs/fiora-specifiche-integrazioni-v1.md` §1: /auth/me + PATCH /users/me, clima onboarding salvato, fix task su archiviazione, reminder concimazione+bouquet+stato automatico, tipi task allineati, modulazione clima, storico cure, app_options, migration campi User, seed 10 specie
- Poi Fase 5 (foto diario MinIO)
- Apple Sign-In mobile: in attesa credenziali Apple Developer personali
- Valutare inversione onboarding: prima login, poi selezione clima (idea utente 2026-07-08, da decidere in fase successiva)

### Note build iOS locale (npx expo run:ios)
- Lo spazio nei path ("SSD Lexar", "Fiora TG") rompe script di build RN/Expo. Patch attive:
  - `mobile/patches/expo-constants+18.0.13.patch` (via patch-package, postinstall) — quoting in EXConstants podspec e get-app-config-ios.sh
  - Fase "Bundle React Native code and images" in `ios/mobile.xcodeproj` ha lo stesso bug (backtick non quotato) — NON ancora patchata, build locale fallisce lì; per ora si usa EAS
- Xcode 26 richiede runtime simulatore iOS 26 (scaricato)

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
- Zustand (state management, da implementare)
- Expo Router (navigazione, da implementare)

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
│   ├── services/
│   │   └── auth.service.ts   ← logica autenticazione
│   └── routes/
│       └── auth.routes.ts    ← endpoints /auth/*
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
- **Fase 4.5** Consolidamento: profilo (/auth/me, PATCH /users/me), clima onboarding, fix archiviazione, reminder bouquet+concimazione, app_options, storico cure, migration campi User
- **Fase 5** Foto diario (MinIO)
- **Fase 6** Integrazione vaso smart (MQTT → DB, schermate Vasi, pairing BLE)
- **Fase 7** Alert sensori
- **Fase 8** Notifiche push (Expo)
- **Fase 9** Catalogo esteso: import massivo Trefle in DB locale (437k specie, ~3-4h una tantum), arricchimento dettagli on-demand, sync settimanale, ricerca pg_trgm, proposta specie + area admin. NB: Trefle NON ha dati di cura (verificato: growth null anche per Monstera) — serve solo per ricerca/nomi/immagini
- **Fase 10** Apple Sign-In + rifinitura UI (inversione onboarding, fiori bouquet, empty state suggerimenti)
- **Post-MVP** Email transazionali, offline SQLite, cambio email

## Note importanti
- Prisma 7: il campo `url` NON va in `schema.prisma` ma in `prisma.config.ts` (già configurato)
- `moduleResolution` in tsconfig deve essere `node16` (non `node`)
- Expo SDK 54 (non 56 — downgrade per compatibilità con Expo Go)
- Il mobile si connette a MQTT via WebSocket (wss://), NON via TCP diretto
- `sensor_readings` è una TimescaleDB hypertable — non modificare la PK senza ricreare l'hypertable