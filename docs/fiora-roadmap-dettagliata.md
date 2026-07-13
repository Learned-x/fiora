# 🌿 Fiora - Roadmap di Sviluppo Prototipo
## Versione per deployment su server Ubuntu
 
---
 
## Panoramica
 
Questa roadmap è strutturata per lo sviluppo incrementale del prototipo Fiora su un **server Ubuntu dedicato**. L'approccio privilegia:
 
- **Containerizzazione con Docker** per isolamento e portabilità
- **Sviluppo incrementale** con rilasci funzionali a ogni fase
- **MVP-first approach** per validare le feature core prima di espandere
- **Testing continuo** su hardware reale (server Ubuntu)
### Tempistiche Complessive
 
- **Durata minima:** 21 settimane (~5 mesi)
- **Durata massima:** 29 settimane (~7 mesi)
- **Durata media:** ~25 settimane (~6 mesi)
Con un team di 1-2 sviluppatori full-stack, il progetto richiede circa **6 mesi** per arrivare a un prototipo funzionale completo.
 
---
 
## Prerequisiti Server Ubuntu
 
Prima di iniziare, il server Ubuntu deve avere:
 
- **Sistema operativo:** Ubuntu 22.04 LTS o 24.04 LTS
- **Hardware minimo:** 4 core, 8GB RAM, 100GB storage SSD
- **Accesso root o sudo**
- **Connessione internet stabile**
- **Dominio configurato** (per SSL/TLS)
- **Porte aperte:** 80, 443 (HTTP/HTTPS), 8883 (MQTT TLS), eventualmente 1883 (MQTT dev)
---
 
## Fase 0: Setup Infrastruttura
**Durata:** 1-2 settimane | **Priorità:** CRITICA
 
### Obiettivo
Preparare l'ambiente di sviluppo sul server Ubuntu con tutti i servizi containerizzati.
 
### Task Principali
 
1. **Setup Docker Environment**
   - Installare Docker Engine (ultimo stable)
   - Installare Docker Compose v2
   - Configurare Docker per avvio automatico
   - Creare network Docker `fiora-network`
2. **PostgreSQL 16 + TimescaleDB**
   - Deploy container `timescale/timescaledb:latest-pg16`
   - Creazione database `fiora_db`
   - Creazione utente dedicato con privilegi limitati
   - Configurazione backup automatici (pg_dump schedulato)
   - Abilitazione estensione TimescaleDB per hypertables
3. **Redis 7**
   - Deploy container `redis:7-alpine`
   - Configurazione AOF persistence
   - Limitazione memoria (max 2GB)
   - Password per Redis (da .env)
4. **MinIO**
   - Deploy container `minio/minio:latest`
   - Creazione bucket `fiora-photos`
   - Policy pubbliche per lettura, private per scrittura
   - Configurazione retention policy per storage efficiente
5. **Mosquitto MQTT Broker**
   - Deploy container `eclipse-mosquitto:2`
   - Configurazione TLS/SSL con certificati Let's Encrypt
   - Configurazione autenticazione basata su username/password
   - Preparazione dinamica credenziali per dispositivi IoT
   - Setup ACL per topic segregation
6. **Nginx Reverse Proxy**
   - Deploy container `nginx:alpine`
   - Configurazione reverse proxy per API backend
   - Configurazione reverse proxy per MinIO
   - Setup certificati SSL con Let's Encrypt (Certbot)
   - Rate limiting globale
7. **Docker Compose Orchestration**
   - File `docker-compose.yml` completo
   - File `.env` per secrets e configurazioni
   - Health checks per tutti i servizi
   - Restart policies (always/unless-stopped)
   - Logging centralizzato (json-file driver con rotazione)
### Deliverables
- ✅ Tutti i container attivi e raggiungibili
- ✅ Database PostgreSQL inizializzato
- ✅ MQTT broker con TLS configurato
- ✅ MinIO con bucket creati
- ✅ Nginx proxy funzionante con SSL
- ✅ File `docker-compose.yml` versionato su Git
### Note Tecniche
- Usare volumi Docker per persistenza dati
- Configurare log rotation (max 50MB per file, max 5 file)
- Testare backup e restore di PostgreSQL
- Verificare connettività MQTT da client esterno (MQTT Explorer)
---
 
## Fase 1: Backend Core + Autenticazione
**Durata:** 2-3 settimane | **Priorità:** CRITICA | **Dipendenze:** Fase 0
 
### Obiettivo
API REST funzionante con sistema di autenticazione completo basato su JWT.
 
### Task Principali
 
1. **Setup Progetto Backend**
   - Inizializzare progetto Node.js 20+ con TypeScript
   - Configurare Express.js con middleware standard
   - Setup ESLint + Prettier
   - Configurare `tsconfig.json` (strict mode)
   - Struttura cartelle: `/src/{routes,controllers,services,models,middleware,utils}`
2. **ORM e Database**
   - Setup Prisma ORM
   - Schema completo: `users`, `plants`, `vases`, `tasks`, `species`, `action_logs`, `photo_diary`, `app_options`
   - Migrations iniziali
   - Seeding dati base (specie comuni, opzioni)
3. **Autenticazione Email/Password**
   - `POST /auth/register`: registrazione con email + password
   - `POST /auth/login`: login con JWT
   - Password hashing con bcrypt (cost factor 12)
   - Access token (15 min) + Refresh token (30 giorni)
   - `POST /auth/refresh`: rinnovo access token
   - `POST /auth/logout`: invalidazione refresh token
4. **Middleware e Sicurezza**
   - Middleware `authenticate`: verifica JWT
   - Rate limiting per `/auth/*` (5 tentativi/minuto)
   - CORS configurato (whitelist origins)
   - Helmet.js per security headers
   - Express validator per input validation
5. **Gestione Account**
   - `DELETE /auth/account`: richiesta eliminazione (periodo grazia 30gg)
   - `POST /auth/account/cancel-deletion`: annulla eliminazione
   - Job BullMQ schedulato per eliminazione definitiva
6. **Job Queue**
   - Setup BullMQ con Redis
   - Worker per job eliminazione account
   - Worker per job reminder (preparazione per Fase 3)
   - Dashboard BullMQ (opzionale, dev only)
7. **Testing**
   - Unit test per autenticazione (Jest)
   - Integration test per API auth (Supertest)
   - Test copertura >80%
### Deliverables
- ✅ API `/auth/*` complete e testate
- ✅ JWT funzionanti (access + refresh)
- ✅ Database schema deployato con migrations
- ✅ BullMQ operativo
- ✅ Documentazione API (Swagger/OpenAPI)
### Note Tecniche
- Invalidare refresh token su logout (blacklist in Redis)
- Log tentativi di login falliti per security audit
- Considerare 2FA in futuro (non in MVP)
---
 
## Fase 2: Gestione Piante - MVP
**Durata:** 2-3 settimane | **Priorità:** ALTA | **Dipendenze:** Fase 1
 
### Obiettivo
CRUD completo per piante con upload foto e catalogo specie interno.
 
### Task Principali
 
1. **API CRUD Piante**
   - `POST /plants`: crea nuova pianta
   - `GET /plants`: lista piante utente (con filtri)
   - `GET /plants/:id`: dettaglio pianta
   - `PATCH /plants/:id`: modifica pianta
   - `DELETE /plants/:id`: soft delete (stato=archiviato)
   - `POST /plants/:id/restore`: ripristina da archivio
2. **Upload Foto**
   - `POST /plants/:id/photo`: upload foto principale
   - Integrazione MinIO per storage
   - Ridimensionamento automatico: thumbnail (300x300), standard (1200x1200)
   - Conversione WebP per ottimizzazione
   - Libreria: Sharp
   - Gestione sostituzione foto esistente
3. **Catalogo Specie Interno**
   - Seeding 20-30 specie comuni (basilico, pothos, monstera, succulente, etc.)
   - Campi: nome comune, nome scientifico, frequenze base, descrizione, difficoltà
   - `GET /species/search?q={query}`: ricerca fuzzy
   - Algoritmo ricerca: PostgreSQL `ILIKE` + ranking per priorità
4. **Gestione Posizioni**
   - Tabella `app_options` per posizioni dinamiche
   - Posizioni default: "soggiorno", "cucina", "camera", "balcone", "bagno", "studio"
   - `GET /options/positions`: lista posizioni disponibili
   - `POST /options/positions`: admin può aggiungere nuove (preparazione per Fase 9)
5. **Stati e Filtri**
   - Stati pianta: `attivo`, `archiviato`, `eliminato`
   - Filtri: tipo (plant/bouquet), con_vaso (true/false), posizione
   - Query parameters: `?type=plant&status=attivo&has_vase=true`
### Deliverables
- ✅ CRUD piante completo
- ✅ Upload e storage foto operativo
- ✅ Catalogo con 20-30 specie
- ✅ Ricerca specie funzionante
- ✅ API filtri collezione
### Note Tecniche
- Limitare dimensione upload foto (10MB max)
- Validare formato immagine (JPEG, PNG, HEIC)
- Eliminare vecchie foto da MinIO quando sostituite
- Implementare paginazione per `GET /plants` (limit 50 default)
---
 
## Fase 3: Sistema Reminder e Task
**Durata:** 2-3 settimane | **Priorità:** ALTA | **Dipendenze:** Fase 2
 
### Obiettivo
Sistema automatico di generazione reminder basato su clima e gestione task giornalieri.
 
### Task Principali
 
1. **Logica Calcolo Reminder**
   - Implementare service `ReminderCalculator`
   - Frequenze base per clima: temperato (7gg annaffiatura, 30gg concime), mediterraneo (5gg, 30gg), tropicale (3gg, 21gg)
   - Modulazione per stagione (opzionale in MVP)
   - Override per specie specifiche
   - Calcolo prossima data dopo completamento
2. **Job Generazione Reminder**
   - Job BullMQ schedulato (esecuzione giornaliera 6:00 AM)
   - Logica: per ogni pianta attiva, verifica se servono nuovi task
   - Creazione task con `scheduled_date` = oggi se reminder scaduto
   - Skip se task già esistente per quella data
3. **API Task**
   - `GET /tasks/today`: task per oggi (gruppo per pianta)
   - `GET /tasks/upcoming`: task futuri (prossimi 7 giorni)
   - `POST /tasks`: creazione task manuale
   - `POST /tasks/:id/complete`: segna completato
   - `POST /tasks/:id/postpone`: rimanda +1 giorno
   - `POST /tasks/:id/skip`: segna saltato
   - `GET /tasks/:id/history`: storico task pianta
4. **Storico Azioni**
   - Tabella `action_logs`: log ogni azione (completato, rimandato, saltato)
   - Campi: user_id, plant_id, task_id, action_type, timestamp, notes
   - Query per statistiche (giorni dall'ultima annaffiatura, etc.)
5. **Prioritizzazione Task**
   - Ordinamento: sensore (se alert attivo) > calendario (più vecchi prima)
   - Badge UI per task urgenti (>2 giorni di ritardo)
6. **Calcolo Prossima Data**
   - Dopo completamento: calcola next_due_date = oggi + frequenza
   - Se rimandato: next_due_date = domani
   - Se saltato: next_due_date invariato
### Deliverables
- ✅ Sistema reminder automatico funzionante
- ✅ API task complete
- ✅ Job schedulati attivi
- ✅ Storico azioni tracciato
- ✅ Logica prioritizzazione task
### Note Tecniche
- Job resiliente: gestire piante eliminate durante esecuzione
- Transaction per completamento task + creazione action log
- Logging job esecuzioni per debug
- Considerare timezone utente (default UTC in MVP)
---
 
## Fase 4: App Mobile React Native - Base
**Durata:** 3-4 settimane | **Priorità:** ALTA | **Dipendenze:** Fase 3
 
### Obiettivo
App mobile iOS/Android con funzionalità core: autenticazione, gestione piante, task giornalieri.
 
### Task Principali
 
1. **Setup Progetto Mobile**
   - `npx create-expo-app --template blank-typescript`
   - Expo SDK 51+
   - TypeScript strict mode
   - Setup Zustand per state management globale
   - Setup Expo Router per navigazione
2. **Networking**
   - Axios con baseURL configurabile (.env)
   - Interceptor per refresh token automatico
   - Gestione errori centralizzata (toast/alert)
   - SecureStore per salvataggio token
3. **Autenticazione**
   - Screen login (`/login`)
   - Screen registrazione (`/register`)
   - Gestione stato auth con Zustand
   - Redirect automatico se authenticated
4. **Onboarding**
   - Screen selezione clima (`/onboarding`)
   - Salvataggio preferenza clima nel profilo
   - Skip onboarding se già completato
5. **Navigazione Principale**
   - Tab navigation: Collezione, Oggi, Profilo
   - Screen Collezione: lista piante (`/collection`)
   - Screen Oggi: task giornalieri (`/today`)
   - Screen Profilo: impostazioni (`/profile`)
6. **Gestione Piante**
   - Screen lista piante: FlatList con thumbnail
   - Screen dettaglio pianta (`/plants/[id]`)
   - Screen aggiungi pianta (`/plants/add`)
   - Screen modifica pianta (`/plants/[id]/edit`)
   - Ricerca specie con autocomplete
   - Upload foto: expo-image-picker (fotocamera + galleria)
   - Preview foto prima upload
7. **Task Giornalieri**
   - Screen Oggi: raggruppamento per pianta
   - Azioni inline: completa, rimanda, salta
   - Animazioni swipe per azioni rapide (react-native-gesture-handler)
   - Badge contatore task pendenti
8. **Impostazioni**
   - Modifica profilo (nome, email)
   - Cambio clima
   - Mostra/nascondi nomi scientifici
   - Eliminazione account
9. **UI/UX**
   - Design system con colori brand
   - Componenti riutilizzabili: Button, Input, Card, Avatar
   - Loading states (ActivityIndicator)
   - Empty states (collezione vuota, task vuoti)
   - Error boundaries
### Deliverables
- ✅ App funzionante su iOS e Android
- ✅ Autenticazione completa
- ✅ CRUD piante operativo
- ✅ Task giornalieri funzionanti
- ✅ UI/UX base implementata
### Note Tecniche
- Test su dispositivi reali (non solo emulatori)
- Configurare splash screen e app icon
- Gestire permission fotocamera/galleria
- Ottimizzare FlatList con `windowSize` e `removeClippedSubviews`
- Usare expo-image per caching automatico immagini
---
 
## Fase 5: Bouquet e Funzionalità Avanzate
**Durata:** 2 settimane | **Priorità:** MEDIA | **Dipendenze:** Fase 4
 
### Obiettivo
Supporto completo per bouquet e funzionalità complementari (diario fotografico, archivio).
 
### Task Principali
 
1. **Gestione Bouquet**
   - Tipo pianta: `type = 'bouquet'`
   - Checklist iniziale: acqua fresca, taglio steli, rimozione foglie basse
   - Calcolo stato: fresco (0-3gg), in_cura (4-7gg), appassendo (8-10gg), concluso (11+gg)
   - Reminder specifici: cambio acqua ogni 2 giorni
   - Screen dettaglio bouquet: mostra checklist e giorni rimasti
2. **Diario Fotografico**
   - Tabella `photo_diary`: multiple foto per pianta
   - `POST /plants/:id/diary/photo`: aggiungi foto a diario
   - `GET /plants/:id/diary`: timeline foto (ordine cronologico)
   - `DELETE /diary/:photo_id`: elimina foto
   - UI mobile: galleria con scroll orizzontale
3. **Storico Cure**
   - `GET /plants/:id/actions`: storico azioni filtrato
   - Filtri: tipo azione, range date
   - Contatori: giorni dall'ultima annaffiatura, totale annaffiature, etc.
   - Screen mobile: timeline verticale con icone
4. **Archivio Piante**
   - `POST /plants/:id/archive`: archivia pianta
   - `POST /plants/:id/restore`: ripristina da archivio
   - Schermata Archivio: lista piante archiviate
   - Empty state: suggerimenti piante da aggiungere
### Deliverables
- ✅ Gestione bouquet completa
- ✅ Diario fotografico operativo
- ✅ Storico cure con filtri
- ✅ Archivio funzionante
---
 
## Fase 6: Notifiche Push
**Durata:** 1-2 settimane | **Priorità:** MEDIA | **Dipendenze:** Fase 4
 
### Obiettivo
Sistema notifiche push per reminder e alert sensori.
 
### Task Principali
 
1. **Setup Expo Push Notifications**
   - Configurazione `app.json`: notification permissions
   - Registrazione push token nel backend
   - `POST /users/push-token`: salva token
   - Gestione token invalidi/scaduti
2. **Backend Notification Service**
   - Service `NotificationSender`
   - Invio notifiche via Expo Push API
   - Batch invio (max 100 notifiche/batch)
   - Retry automatico per fallimenti
3. **Tipi Notifiche**
   - Reminder annaffiatura: "🌱 Annaffia [Nome Pianta]"
   - Reminder concimazione: "🧪 Concima [Nome Pianta]"
   - Alert sensore umidità: "⚠️ [Nome Pianta] ha sete"
   - Vaso disconnesso: "📡 Vaso di [Nome Pianta] offline"
4. **Trigger Notifiche**
   - Job schedulato giornaliero (8:00 AM): reminder del giorno
   - Job alert sensori (real-time): trigger immediato se soglia critica
   - Worker BullMQ per invio asincrono
5. **Preferenze Notifiche**
   - Tabella `users`: campi enable_notifications, notification_time
   - `PATCH /users/notifications`: aggiorna preferenze
   - Screen mobile: toggle notifiche, selezione orario
6. **Deep Linking**
   - Notifica click: apre screen specifica (dettaglio pianta)
   - Configurare Expo Linking: `fiora://plants/:id`
   - Gestire notifiche con app chiusa
### Deliverables
- ✅ Push notifications funzionanti
- ✅ Deep linking operativo
- ✅ Preferenze configurabili
- ✅ Batch processing notifiche
---
 
## Fase 7: Integrazione Vaso Smart
**Durata:** 3-4 settimane | **Priorità:** MEDIA-ALTA | **Dipendenze:** Fase 6
 
**⚠️ Nota:** Richiede hardware vaso smart per testing. Può essere posticipata se hardware non disponibile.
 
### Obiettivo
Pairing vasi smart, raccolta telemetria MQTT, alert automatici.
 
### Task Principali
 
1. **API Pairing Vaso**
   - `POST /vases/pair`: input vase_serial_number
   - Verifica univocità serial number
   - Generazione credenziali MQTT (username, password)
   - Creazione record vaso nel DB
   - Risposta: credenziali MQTT + broker endpoint
2. **Configurazione MQTT**
   - ACL Mosquitto: un topic per ogni vaso (`devices/{vase_id}/telemetry`)
   - Auth dinamica: username = vase_id, password hashata in DB
   - TLS obbligatorio (porta 8883)
3. **Telemetria MQTT**
   - Subscriber backend: `devices/+/telemetry`
   - Payload JSON: `{moisture, temperature, battery_level, timestamp}`
   - Salvataggio in TimescaleDB (tabella `sensor_readings` come hypertable)
   - Aggregazioni automatiche: media oraria, giornaliera
4. **Alert Sensori**
   - Logica soglie: moisture <20% → alert critico
   - Logica soglie: temperature <5°C o >35°C → alert warning
   - Job check soglie (esecuzione ogni 15 minuti)
   - Worker BullMQ per invio notifiche urgenti
5. **Gestione Vaso**
   - `POST /vases/:id/associate`: associa vaso a pianta
   - `DELETE /vases/:id/disassociate`: disassocia vaso
   - `DELETE /vases/:id`: rimuovi vaso (soft delete)
   - Last Will MQTT: aggiorna stato vaso se disconnesso
6. **API Dati Sensori**
   - `GET /vases/:id/readings`: ultimi dati
   - `GET /vases/:id/readings/history`: range temporale
   - Query parameters: start_date, end_date, granularity (raw/hourly/daily)
7. **UI Mobile Sensori**
   - Badge indicatori: moisture %, temperature °C, battery %
   - Grafici storico: line chart con Recharts o Victory Native
   - Colori dinamici: verde OK, giallo warning, rosso critico
   - Alert banner se valori critici
8. **Modulazione Reminder**
   - Se vaso associato e attivo: priorità sensore > calendario
   - Se moisture OK: ritarda reminder annaffiatura
### Deliverables
- ✅ Sistema MQTT completo
- ✅ Pairing vaso funzionante
- ✅ Telemetria salvata in TimescaleDB
- ✅ Alert automatici attivi
- ✅ UI sensori nell'app
### Note Tecniche
- Testing con MQTT client (MQTT Explorer, mosquitto_pub/sub)
- Gestire riconnessione automatica MQTT backend
- Retention policy TimescaleDB: dati raw 30gg, aggregati 1 anno
- Monitorare latenza MQTT broker
---
 
## Fase 8: Sync Offline e Ottimizzazioni Mobile
**Durata:** 2 settimane | **Priorità:** MEDIA | **Dipendenze:** Fase 5
 
### Obiettivo
App funzionante offline con sincronizzazione automatica.
 
### Task Principali
 
1. **SQLite Locale**
   - Setup expo-sqlite
   - Schema mirror database backend
   - Migrations SQLite con expo-file-system
2. **Strategia Sync**
   - Write-local-first: tutte le write vanno prima su SQLite
   - Queue azioni pending: tabella `pending_actions`
   - Sync automatico al ritorno online
   - Conflict resolution: last-write-wins
3. **Indicatori Stato Sync**
   - Badge "Offline" in header
   - Badge contatore azioni pending
   - Toast conferma sync completato
4. **Ottimizzazioni Performance**
   - Query database indicizzate
   - Lazy loading liste (FlatList pagination)
   - Caching immagini con expo-image
   - Prefetch dati critici (task del giorno)
### Deliverables
- ✅ App funzionante offline
- ✅ Sync bidirezionale
- ✅ Performance migliorate
---
 
## Fase 9: Catalogo Specie Avanzato
**Durata:** 3-4 settimane (rivista al rialzo per via dell'import massivo, vedi sotto) | **Priorità:** BASSA-MEDIA | **Dipendenze:** Fase 5
 
### Obiettivo
Import completo del catalogo botanico Trefle in locale e contributi utenti con moderazione.
 
### Task Principali
 
1. **Import iniziale catalogo Trefle**
   - La tabella `species_import_raw` esiste già (rinominata da `trefle_species_raw` il 2026-07-13, vedi integrazioni §2.5; colonna `fonte` distingue `'csv'` da `'trefle'`)
   - In dev/test il catalogo esteso viene popolato via **import CSV manuale** (`fonte='csv'`, set ridotto di specie); l'import Trefle è il meccanismo di produzione
   - Implementare `trefle.service.ts`: job batch paginato che importa **l'intero catalogo Trefle** (non solo le specie cercate) con `fonte='trefle'`, salvando il payload completo in JSONB
   - Rendere il job **resumable**: salvare il progresso (es. ultima pagina) in Redis, per poter ripartire dopo crash/riavvio senza ripartire da zero
   - Rispettare il rate limit Trefle (120 req/min) — stimare e comunicare al team il tempo totale previsto prima di lanciare l'import in produzione (potenzialmente giorni, non minuti)
2. **Sync verso il catalogo applicativo**
   - Job BullMQ giornaliero `trefle-sync.job.ts`: aggiorna i record raw già importati e propaga le modifiche a `species`
   - Rispettare il flag `fonte`: non sovrascrivere mai le specie modificate manualmente (`fonte='curato'`)
   - Aggiornare `species.external_id` e `species.immagine_principale_url` durante il sync
3. **Contributi Utenti**
   - `POST /species/propose`: proposta nuova specie
   - Verifica automatica contro `species_import_raw` (non più chiamata live a Trefle, dato che il catalogo è già importato)
   - Stato: in_revisione / approvato / rifiutato
4. **Area Admin**
   - Screen web (React SPA semplice)
   - Lista specie in revisione
   - Approvazione/rifiuto con nota
   - Notifica utente su esito
   - (Opzionale) Vista stato/avanzamento dell'import Trefle, utile in fase di lancio
### Deliverables
- ✅ Catalogo Trefle importato integralmente in `species_import_raw` (`fonte='trefle'`)
- ✅ Job di sync giornaliero operativo, con rispetto delle specie curate manualmente
- ✅ Catalogo a tre livelli operativo, ricerca interamente su DB locale
- ✅ Contributi utenti abilitati
- ✅ Area admin funzionante
### Note Tecniche
- Monitorare spazio disco: l'import completo del catalogo Trefle in JSONB può occupare diversi GB — verificare lo storage disponibile sul Server DB prima di lanciare l'import in produzione
- Pianificare l'import iniziale fuori dagli orari di punta, e separatamente da un eventuale primo rilascio pubblico (può girare in background anche dopo il go-live)
### Rischio aggiuntivo (da aggiungere alla tabella Rischi e Mitigazioni)
 
| Rischio | Probabilità | Impatto | Mitigazione |
|---------|-------------|---------|--------------|
| Import Trefle interrotto a metà (crash, rate limit, manutenzione Trefle) | Media | Basso | Job resumable con checkpoint in Redis; nessun impatto sugli utenti, il catalogo curato resta sempre disponibile |
| Volume dati Trefle superiore alle stime (storage) | Bassa | Medio | Monitorare crescita tabella `species_import_raw`; valutare se servono solo le famiglie di piante rilevanti per Fiora invece del catalogo completo |
 
---
 
## Fase 10: Login Social e Completamenti
**Durata:** 2 settimane | **Priorità:** BASSA | **Dipendenze:** Fase 8
 
### Obiettivo
OAuth Google/Apple e completamento funzionalità UI/UX.
 
### Task Principali
 
1. **OAuth Google**
   - Backend: verifica ID token Google
   - Mobile: Expo AuthSession
   - Link account esistenti
2. **OAuth Apple**
   - Sign in with Apple (obbligatorio per iOS)
   - Gestione email proxy
3. **Completamenti UI**
   - Animazioni transizioni
   - Skeleton screens
   - Error boundaries
   - Impostazioni complete
### Deliverables
- ✅ Login social completo
- ✅ UI/UX rifinita
- ✅ App pronta per beta testing
---
 
## Raccomandazioni Generali
 
### Versioning e Git
- Repository Git: monorepo con `/backend` e `/mobile`
- Branching strategy: GitFlow (main, develop, feature/*)
- Commit convenzionali (Conventional Commits)
- CI/CD: GitHub Actions per lint e test
### Monitoring e Logging
- Backend: Winston per logging strutturato
- Log centralizzati: file rotazionali + eventualmente Loki
- Monitoring: Prometheus + Grafana (opzionale)
- Alerting: email/Telegram per errori critici
### Sicurezza
- Secrets in `.env` (mai committati)
- Scansione vulnerabilità: npm audit, Snyk
- HTTPS obbligatorio (Nginx SSL)
- CORS whitelist production domains
- Rate limiting aggressivo su API pubbliche
### Testing
- Unit test: Jest (>70% copertura)
- Integration test: Supertest per API
- E2E mobile: Detox (opzionale, post-MVP)
- Load testing: K6 o Artillery per API critiche
### Documentazione
- README.md dettagliato per setup
- Swagger/OpenAPI per API
- Diagrammi architettura (draw.io, C4 model)
- Wiki interno con decision log
---
 
## Milestone e Validazione
 
### MVP 1 (Fine Fase 4): Core App
- **Scopo:** Validare esperienza base
- **Features:** Autenticazione, CRUD piante, task giornalieri
- **Testing:** 5-10 beta testers interni
- **Metriche:** Retention 7 giorni, task completion rate
### MVP 2 (Fine Fase 7): Vaso Smart
- **Scopo:** Validare integrazione IoT
- **Features:** Pairing vaso, alert sensori
- **Testing:** 3-5 utenti con vaso smart
- **Metriche:** Uptime MQTT, latenza telemetria
### Beta Release (Fine Fase 10)
- **Scopo:** Validazione pre-lancio
- **Features:** App completa
- **Testing:** 20-50 beta testers
- **Metriche:** NPS, crash rate <1%, avg session >5 min
---
 
## Budget Tempo per Team Size
 
### Solo Developer (1 persona)
- **Durata:** ~7-8 mesi (29-32 settimane)
- **Note:** Sequenziale, rischio burnout
### Team 2 Persone
- **Durata:** ~5-6 mesi (20-24 settimane)
- **Split:** 1 backend + infra, 1 mobile + UI
- **Raccomandato:** Questo scenario
### Team 3+ Persone
- **Durata:** ~4 mesi (16 settimane)
- **Split:** 1 DevOps, 1 backend, 1 mobile, (1 designer opzionale)
- **Note:** Overhead comunicazione aumenta
---
 
## Rischi e Mitigazioni
 
| Rischio | Probabilità | Impatto | Mitigazione |
|---------|-------------|---------|-------------|
| Hardware vaso smart non disponibile | Alta | Medio | Posticipare Fase 7, usare mockup MQTT |
| API Trefle rate limit | Media | Basso | Cache aggressiva, fallback catalogo interno |
| Expo build issues iOS | Media | Medio | Test frequenti su dispositivi reali |
| PostgreSQL out of memory | Bassa | Alto | Monitoring RAM, query optimization |
| MQTT broker overload | Bassa | Medio | Scaling orizzontale Mosquitto |
 
---