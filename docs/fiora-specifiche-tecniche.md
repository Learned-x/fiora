# 🌿 Fiora — Specifiche tecniche per lo sviluppo
 
**Versione 2.0 · aggiornato al 2026-07-27 · Software + Hardware + Mobile**
 
Documento unico dell'implementazione. Incorpora le specifiche dell'aggiornamento
firmware OTA (§16), prima in un documento separato.
 
Documenti collegati:
- **`fiora-specifiche-funzionali.md`** — cosa fa l'app, dal punto di vista dell'utente.
- **`fiora-roadmap.md`** — fasi, stato di avanzamento e debito noto.
- **`fiora-manuale-ambienti.md`** — setup di development, staging e produzione.
- **`fiora-mev.md`** — manutenzione evolutiva pianificata per le prossime versioni.
 
> **Come leggere questo documento.** Descrive l'architettura **di destinazione**.
> Dove il codice non è ancora allineato (in particolare il firmware, vedi §6 e §16)
> la differenza è segnalata da un riquadro come questo e tracciata nel debito noto
> della roadmap. Le specifiche restano il bersaglio: è il codice a doversi allineare.
 
---
 
## Indice
 
1. [Stack tecnologico](#1-stack-tecnologico)
2. [Architettura generale](#2-architettura-generale)
3. [Infrastruttura e deployment](#3-infrastruttura-e-deployment)
4. [Database — schema](#4-database--schema)
5. [Backend — API REST](#5-backend--api-rest)
6. [Integrazione vaso smart (MQTT)](#6-integrazione-vaso-smart-mqtt)
7. [Sistema di reminder e job queue](#7-sistema-di-reminder-e-job-queue)
8. [Catalogo specie](#8-catalogo-specie)
9. [Autenticazione](#9-autenticazione)
10. [App mobile — struttura](#10-app-mobile--struttura)
11. [Sincronizzazione offline](#11-sincronizzazione-offline)
12. [Notifiche push](#13-notifiche-push)
13. [Storage foto](#13-storage-foto)
14. [Variabili d'ambiente](#14-variabili-dambiente)
15. [Convenzioni di sviluppo](#15-convenzioni-di-sviluppo)
16. [Aggiornamento firmware OTA](#16-aggiornamento-firmware-ota)
---
 
## 1. Stack tecnologico
 
### Mobile
| Componente | Tecnologia | Note |
|---|---|---|
| Framework | React Native + Expo SDK 51+ | iOS + Android da un unico codebase |
| Linguaggio | TypeScript | Strict mode abilitato |
| State management | Zustand | Leggero, semplice, senza boilerplate |
| Storage locale | Expo SQLite | Per funzionamento offline |
| Navigazione | Expo Router | File-based routing |
| Notifiche push | Expo Notifications | Wrapper su APNs e FCM |
| HTTP client | Axios | Con interceptor per refresh token |
| MQTT client | mqtt.js | Per connessione diretta al broker dal mobile |
| BLE provisioning | react-native-ble-plx | Modulo nativo per WiFi provisioning del vaso smart |
 
### Backend
| Componente | Tecnologia | Note |
|---|---|---|
| Runtime | Node.js 20 LTS | |
| Framework | Express 4 | REST API |
| Linguaggio | TypeScript | Strict mode abilitato |
| ORM | Prisma | Con PostgreSQL adapter |
| Job queue | BullMQ (gratuito) | Basato su Redis |
| MQTT broker | HiveMQ Cloud (dev+staging) / Mosquitto 2.x (produzione) | Decisione 2026-07-24: dev e staging usano il cluster condiviso HiveMQ Cloud; Mosquitto self-hosted solo in produzione |
| MQTT client | mqtt.js (Node) | Per comunicazione broker ↔ backend |
| Reverse proxy | Nginx | SSL termination, static files |
 
### Database e storage
| Componente | Tecnologia | Note |
|---|---|---|
| Database principale | PostgreSQL 16 | Con estensione TimescaleDB per dati sensori |
| Cache e code | Redis 7 | Usato da BullMQ e per cache Trefle |
| Object storage | MinIO | Self-hosted, compatibile S3, per le foto |
 
### Infrastruttura
| Componente | Tecnologia | Note |
|---|---|---|
| Containerizzazione | Docker + Docker Compose | Tutti i servizi containerizzati |
| Server app | Hetzner Cloud CX33 | 4 vCPU, 8 GB RAM, Ubuntu 24.04 |
| Server DB | Hetzner Cloud CX23 | 2 vCPU, 4 GB RAM, Ubuntu 24.04 |
| DNS + SSL + CDN | Cloudflare | Piano gratuito |
| Rete interna | Hetzner Private Network | Connessione server app ↔ server DB |
 
---
 
## 2. Architettura generale
 
```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                             │
└──────────┬──────────────────────────────┬───────────────────┘
           │ HTTPS (443)                  │ MQTT/TLS (8883)
           ▼                              ▼
    ┌─────────────┐               ┌──────────────┐
    │  Cloudflare │               │  Vaso smart  │
    │  DNS + SSL  │               │  (sensori)   │
    └──────┬──────┘               └──────┬───────┘
           │                             │
           ▼                             ▼
┌──────────────────────────────────────────────────────────────┐
│  SERVER APP — Hetzner CX33                                   │
│                                                              │
│  ┌─────────┐   ┌──────────────┐   ┌────────────────────┐    │
│  │  Nginx  │──▶│ Node.js API  │   │ Mosquitto (MQTT)   │    │
│  │  :443   │   │ Express :3000│◀──│ broker :8883       │    │
│  └─────────┘   └──────┬───────┘   └────────────────────┘    │
│                       │                                      │
│               ┌───────┴──────┐                               │
│               │  BullMQ      │                               │
│               │  (Redis jobs)│                               │
│               └──────────────┘                               │
└───────────────────────────┬──────────────────────────────────┘
                            │ Rete privata Hetzner
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  SERVER DB — Hetzner CX23                                    │
│                                                              │
│  ┌──────────────────┐   ┌────────┐   ┌────────────────────┐ │
│  │ PostgreSQL 16    │   │ Redis  │   │ MinIO              │ │
│  │ + TimescaleDB    │   │ :6379  │   │ :9000              │ │
│  └──────────────────┘   └────────┘   └────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```
 
### Principio architetturale — separazione responsabilità
 
**Il backend è l'unico responsabile di tutta la logica di business e trasformazione dati.** L'app mobile è uno strato di presentazione puro: riceve dati già elaborati e li mostra, senza eseguire calcoli, conversioni o logica applicativa.
 
Questo significa che:
 
- Le soglie dei sensori vengono valutate **nel backend**, non nell'app
- La traduzione dei valori grezzi in etichette leggibili (`42% umidità → "Terreno umido"`) avviene **nel backend**
- Il calcolo della prossima data di reminder avviene **nel backend**
- La priorità e l'ordinamento dei task nella schermata Oggi vengono decisi **dal backend**
- Lo stato sintetico del bouquet (Fresco / In cura / Appassendo) viene calcolato **dal backend**
- La modulazione delle frequenze per clima avviene **nel backend**
L'app mobile riceve sempre dati pronti per essere mostrati: stringhe già tradotte, stati già calcolati, liste già ordinate. Non contiene logica condizionale sul dominio applicativo.
 
**Benefici:**
- Un bug nella logica si corregge in un posto solo (backend), senza aggiornare l'app
- La logica è testabile con test unitari puri sul backend
- Se in futuro si aggiunge un client web, eredita tutta la logica senza duplicarla
```
App mobile ──HTTPS──▶ Nginx ──▶ Node.js/Express ──▶ PostgreSQL
                                      │
                                      ├──▶ Redis (cache, job queue)
                                      └──▶ MinIO (foto)
 
Vaso smart ──MQTT/TLS──▶ Mosquitto ──▶ Node.js (subscriber)
                                            │
                                            ├──▶ PostgreSQL (storico sensori)
                                            └──▶ BullMQ (trigger alert/reminder)
```
 
---
 
## 3. Infrastruttura e deployment
 
### Docker Compose — Server app
 
```yaml
# /opt/fiora/docker-compose.yml (server app)
version: '3.9'
 
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - api
 
  api:
    build: ./backend
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
      - MQTT_BROKER_URL=${MQTT_BROKER_URL}
      - MINIO_ENDPOINT=${MINIO_ENDPOINT}
    depends_on:
      - mosquitto
    restart: unless-stopped
 
  mosquitto:
    image: eclipse-mosquitto:2
    ports:
      - "8883:8883"
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - ./mosquitto/data:/mosquitto/data
      - ./mosquitto/log:/mosquitto/log
      - ./mosquitto/ssl:/mosquitto/ssl
    restart: unless-stopped
```
 
### Docker Compose — Server DB
 
```yaml
# /opt/fiora-db/docker-compose.yml (server db)
version: '3.9'
 
services:
  postgres:
    image: timescale/timescaledb:latest-pg16
    environment:
      - POSTGRES_DB=fiora
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"  # solo rete privata
    restart: unless-stopped
 
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "127.0.0.1:6379:6379"  # solo rete privata
    restart: unless-stopped
 
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=${MINIO_USER}
      - MINIO_ROOT_PASSWORD=${MINIO_PASSWORD}
    volumes:
      - minio_data:/data
    ports:
      - "127.0.0.1:9000:9000"
      - "127.0.0.1:9001:9001"
    restart: unless-stopped
 
volumes:
  postgres_data:
  redis_data:
  minio_data:
```
 
### Broker MQTT per ambiente (decisione 2026-07-24)

| Ambiente | Broker | Note |
|---|---|---|
| Development | HiveMQ Cloud (cluster condiviso) | TLS 8883 (backend), WebSocket 8884 (mobile) |
| Staging | HiveMQ Cloud (stesso cluster) | Nessun container Mosquitto in `docker-compose.staging.yml` |
| Produzione | Mosquitto 2.x self-hosted | ACL per-vaso, CA propria embeddata nel firmware ESP32 |

La configurazione Mosquitto qui sotto vale **solo per la produzione**. In dev/staging le credenziali device si creano manualmente nella console HiveMQ Cloud (il piano gratuito non espone API di gestione credenziali) — l'automazione del pairing (`mosquitto_passwd`/ACL dinamiche, Fase 6) è implementabile solo contro Mosquitto e in dev/test va simulata con credenziali pre-create.

### Configurazione Mosquitto (solo produzione)
 
```conf
# /mosquitto/config/mosquitto.conf
listener 8883
protocol mqtt
 
cafile /mosquitto/ssl/ca.crt
certfile /mosquitto/ssl/server.crt
keyfile /mosquitto/ssl/server.key
require_certificate false
tls_version tlsv1.2
 
allow_anonymous false
password_file /mosquitto/config/passwd
 
persistence true
persistence_location /mosquitto/data/
log_dest file /mosquitto/log/mosquitto.log
```
 
### Struttura topic MQTT
 
```
fiora/vaso/{device_id}/telemetry    ← il vaso pubblica qui
fiora/vaso/{device_id}/status       ← stato connessione (Last Will)
fiora/vaso/{device_id}/config       ← il backend invia configurazioni
```
 
**Payload telemetry (JSON):**
```json
{
  "device_id": "vaso-abc123",
  "timestamp": "2024-03-15T10:30:00Z",
  "umidita": 42,
  "luce": 850,
  "temperatura": 21.5,
  "batteria": 87
}
```
 
**Last Will message** (inviato automaticamente da Mosquitto se il vaso si disconnette):
```json
{
  "device_id": "vaso-abc123",
  "status": "offline",
  "timestamp": "2024-03-15T10:30:00Z"
}
```
 
### Nginx — configurazione base
 
```nginx
# /nginx/conf.d/fiora.conf
server {
    listen 443 ssl;
    server_name api.tangifiori.com;
 
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
 
    location / {
        proxy_pass http://api:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
 
server {
    listen 80;
    server_name api.tangifiori.com;
    return 301 https://$host$request_uri;
}
```
 
---
 
## 4. Database — schema
 
### Tabelle principali
 
```sql
-- Utenti
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),             -- null se login social
  provider      VARCHAR(50),              -- 'email' | 'google' | 'apple'
  provider_id   VARCHAR(255),             -- ID dal provider OAuth
  clima         VARCHAR(50) NOT NULL DEFAULT 'temperato',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ              -- soft delete con periodo di grazia
);
 
-- Piante (include bouquet come tipo)
CREATE TABLE plants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome            VARCHAR(255) NOT NULL,
  tipo            VARCHAR(50) NOT NULL,   -- 'pianta' | 'bouquet'
  species_id      UUID REFERENCES species(id),
  posizione       VARCHAR(255),
  foto_url        VARCHAR(500),
  stato           VARCHAR(50) NOT NULL DEFAULT 'attivo',  -- 'attivo' | 'archiviato' | 'eliminato'
  stato_bouquet   VARCHAR(50),            -- 'fresco' | 'in_cura' | 'appassendo' | 'concluso'
  data_ricezione  DATE,                   -- per i bouquet
  vaso_id         UUID REFERENCES smart_vases(id),
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
 
-- Catalogo botanico grezzo importato da fonti esterne (rinominata da trefle_species_raw il 2026-07-13,
-- vedi §8): CSV manuale in dev/test, Trefle in produzione.
-- Creata PRIMA di species, perché species.external_id referenzia questa tabella
CREATE TABLE species_import_raw (
  external_id        INTEGER PRIMARY KEY,        -- ID numerico della fonte (ID Trefle o ID assegnato nel CSV)
  fonte              VARCHAR(50) NOT NULL DEFAULT 'csv',  -- 'csv' | 'trefle'
  slug               TEXT NOT NULL,              -- slug (es. monstera-deliciosa)
  scientific_name    TEXT NOT NULL,              -- nome scientifico ufficiale
  common_name        TEXT,                       -- nome comune principale (se presente)
  family             TEXT,
  family_common_name TEXT,
  genus              TEXT,
  rank               TEXT,                       -- species, ssp, var, etc.
  status             TEXT,                       -- accepted, unknown...
  data               JSONB NOT NULL,             -- payload completo della fonte (growth, specifications, images, distributions, ecc.)
  updated_at_source  TIMESTAMPTZ,                -- ultima data di update vista sulla fonte (se disponibile)
  synced_at          TIMESTAMPTZ DEFAULT NOW()   -- ultima sincronizzazione riuscita
);
 
-- Indici di ricerca sui dati raw (usati dal job di import/sync, non dalla ricerca utente)
CREATE INDEX idx_species_import_raw_scientific_name ON species_import_raw (scientific_name);
CREATE INDEX idx_species_import_raw_common_name     ON species_import_raw (common_name);
CREATE INDEX idx_species_import_raw_family          ON species_import_raw (family);
 
-- Specie botaniche (catalogo a tre livelli)
CREATE TABLE species (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_comune      VARCHAR(255) NOT NULL,
  nome_scientifico VARCHAR(255),
  categoria        VARCHAR(100),          -- 'interno' | 'succulenta' | 'tropicale' | 'aromatica' | 'altro'
  luce             VARCHAR(50) NOT NULL,  -- 'bassa' | 'media' | 'alta'
  annaffiatura     VARCHAR(50) NOT NULL,  -- 'poca' | 'media' | 'frequente'
  umidita          VARCHAR(50),           -- 'bassa' | 'media' | 'alta'
  temp_min         INTEGER,               -- °C
  temp_max         INTEGER,               -- °C
  tossicita        BOOLEAN,
  note_cura        TEXT,
  soglia_umidita   INTEGER,               -- % sotto cui il vaso smart attiva alert
  fonte            VARCHAR(50) NOT NULL,  -- 'curato' | 'trefle' | 'utente'
  stato            VARCHAR(50) NOT NULL DEFAULT 'attivo',  -- 'attivo' | 'in_revisione'
  external_id          INTEGER REFERENCES species_import_raw(external_id),  -- collegamento al payload raw importato (CSV o Trefle)
  immagine_principale_url VARCHAR(500),   -- shortcut all'immagine principale, evita di rileggere il JSONB per le liste
  proposto_da      UUID REFERENCES users(id),  -- solo per fonte='utente'
  approvato_da     UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
 
-- Vasi smart
CREATE TABLE smart_vases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id   VARCHAR(255) UNIQUE NOT NULL,  -- ID hardware del vaso
  nome        VARCHAR(255),
  stato       VARCHAR(50) DEFAULT 'disconnesso',  -- 'connesso' | 'disconnesso' | 'batteria_scarica'
  batteria    INTEGER,                            -- % batteria
  last_seen   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
 
-- Task e reminder
CREATE TABLE tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id     UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo         VARCHAR(100) NOT NULL,  -- 'annaffiatura' | 'concimazione' | 'nebulizzazione' | ...
  sorgente     VARCHAR(50) NOT NULL,   -- 'calendario' | 'sensore' | 'manuale'
  stato        VARCHAR(50) DEFAULT 'pending',  -- 'pending' | 'completato' | 'rimandato' | 'saltato'
  scadenza     TIMESTAMPTZ NOT NULL,
  completato_a TIMESTAMPTZ,
  nota         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
 
-- Storico azioni (log immutabile)
CREATE TABLE action_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id   UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo       VARCHAR(100) NOT NULL,
  nota       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
 
-- Diario fotografico
CREATE TABLE photo_diary (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id   UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  foto_url   VARCHAR(500) NOT NULL,
  nota       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
 
-- Refresh token (per autenticazione JWT)
CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
 
### Tabella TimescaleDB per dati sensori
 
```sql
-- Dati ambientali dal vaso smart (hypertable TimescaleDB)
CREATE TABLE sensor_readings (
  time        TIMESTAMPTZ NOT NULL,
  vaso_id     UUID NOT NULL REFERENCES smart_vases(id) ON DELETE CASCADE,
  plant_id    UUID REFERENCES plants(id),
  umidita     SMALLINT,     -- %
  luce        INTEGER,      -- lux
  temperatura NUMERIC(4,1), -- °C
  batteria    SMALLINT      -- %
);
 
-- Converte in hypertable (ottimizzata per serie temporali)
SELECT create_hypertable('sensor_readings', 'time');
 
-- Indice per query per vaso
CREATE INDEX ON sensor_readings (vaso_id, time DESC);
 
-- Retention policy: mantieni dati grezzi per 90 giorni
SELECT add_retention_policy('sensor_readings', INTERVAL '90 days');
```
 
### Indici principali
 
```sql
CREATE INDEX idx_plants_user_stato ON plants(user_id, stato);
CREATE INDEX idx_tasks_user_scadenza ON tasks(user_id, scadenza) WHERE stato = 'pending';
CREATE INDEX idx_action_logs_plant ON action_logs(plant_id, created_at DESC);
CREATE INDEX idx_species_nome ON species USING gin(to_tsvector('simple', nome_comune));
-- Sostituisce il precedente idx_species_trefle su nome_scientifico: ora il collegamento
-- al catalogo raw passa per external_id (chiave numerica stabile), non più per il nome scientifico.
CREATE UNIQUE INDEX idx_species_external_id ON species(external_id) WHERE external_id IS NOT NULL;
```
 
> **species**
> Rappresenta il **catalogo specie usato da Fiora** (dati già normalizzati per il dominio: luce, annaffiatura, soglie, note). Il campo `external_id` collega, quando presente, la specie al record raw in `species_import_raw`. `fonte` indica da dove nasce la specie:
> - `trefle`: derivata automaticamente dal catalogo Trefle (ma comunque salvata e modificabile localmente)
> - `curato`: modificata o creata a mano dallo staff Fiora
> - `utente`: proposta dagli utenti tramite flusso "proponi nuova specie"
>
> Quando una specie viene modificata manualmente da un admin, la sua `fonte` passa da `trefle` a `curato` e non viene più sovrascritta automaticamente dal job di sync (vedi sezione 8).
 
> **species_import_raw** (rinominata da `trefle_species_raw` il 2026-07-13, vedi §8)
> Contiene **i dati grezzi importati da fonti esterne** per ogni specie, in formato JSONB nel campo `data`, con la colonna `fonte` a distinguere l'origine (`csv` per l'import manuale in dev/test, `trefle` per l'import massivo in produzione). È la sorgente dati "grezza" da cui deriva il catalogo interno `species`. In questo modo, se in futuro servono nuovi campi (es. `growth.*`, `specifications.*`, immagini, distribuzioni) sono già disponibili senza dover richiamare di nuovo l'API o cambiare schema. In produzione il catalogo Trefle viene importato **integralmente** da un job batch (sezione 8), non popolato in modo incrementale durante la ricerca utente.
 
---
 
## 5. Backend — API REST
 
### Struttura progetto backend
 
```
backend/
├── src/
│   ├── index.ts               # entry point
│   ├── app.ts                 # Express setup
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── plants.ts
│   │   ├── tasks.ts
│   │   ├── species.ts
│   │   ├── vases.ts
│   │   └── photos.ts
│   ├── controllers/
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── reminder.service.ts
│   │   ├── mqtt.service.ts
│   │   ├── trefle.service.ts
│   │   └── notification.service.ts
│   ├── jobs/                  # BullMQ workers
│   │   ├── reminder.job.ts
│   │   └── alert.job.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   └── validate.middleware.ts
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── redis.ts
│   │   ├── bullmq.ts
│   │   └── minio.ts
│   └── types/
├── prisma/
│   └── schema.prisma
├── Dockerfile
└── package.json
```
 
### Endpoint API
 
#### Auth
 
```
POST   /auth/register          Registrazione con email + password
POST   /auth/login             Login con email + password
POST   /auth/oauth/google      Login con token Google
POST   /auth/oauth/apple       Login con token Apple
POST   /auth/refresh           Rinnova access token con refresh token
POST   /auth/logout            Revoca refresh token
POST   /auth/change-password   Cambio password (richiede password attuale)
GET    /auth/me                Profilo dell'utente autenticato
DELETE /auth/account           Richiesta eliminazione account (avvia periodo di grazia)
```
 
#### Utente e opzioni
 
```
PATCH  /users/me               Aggiorna name, clima, mostraNomiScientifici,
                               orarioReminder, pushToken
GET    /options                Tutte le opzioni dinamiche, raggruppate per categoria
GET    /options/:categoria     Opzioni attive di una categoria
```
 
#### Piante
 
```
GET    /plants                 Lista piante attive dell'utente
POST   /plants                 Crea nuova pianta o bouquet
GET    /plants/:id             Dettaglio pianta
PATCH  /plants/:id             Modifica pianta (include vasoId per collegare
                               o scollegare un vaso smart)
DELETE /plants/:id             Eliminazione definitiva (con conferma)
PATCH  /plants/:id/archive     Archivia pianta
PATCH  /plants/:id/restore     Ripristina dall'archivio
GET    /plants/archived        Lista piante archiviate
GET    /plants/:id/actions     Storico cure paginato (filtri: tipo, periodo)
```
 
`PATCH /plants/:id` con `vasoId` verifica che il vaso appartenga all'utente e che non
sia già collegato a un'altra pianta, altrimenti risponde `VASE_ALREADY_LINKED`.
Passare `vasoId: null` scollega il vaso.
 
#### Task e reminder
 
```
GET    /tasks/today            Task di oggi per tutti gli elementi
GET    /tasks?plant_id=:id     Task per una pianta specifica
POST   /tasks                  Crea task manuale
PATCH  /tasks/:id/complete     Segna come completato
PATCH  /tasks/:id/snooze       Rimanda (body: { ore: number })
PATCH  /tasks/:id/skip         Salta task
```
 
#### Specie
 
```
GET    /species?q=:query       Cerca specie nel catalogo (livello 1 + 2)
GET    /species/:id            Dettaglio specie
POST   /species/propose        Proponi nuova specie (livello 3)
GET    /species/pending        [admin] Lista specie in revisione
PATCH  /species/:id/approve    [admin] Approva specie proposta
PATCH  /species/:id/reject     [admin] Rifiuta con nota
```
 
#### Vasi smart
 
```
GET    /vases                  Lista vasi dell'utente
POST   /vases/pair             Avvia pairing (genera device_id, restituisce
                               le credenziali MQTT da inviare al vaso via BLE)
GET    /vases/:id              Stato e dati vaso, con pianta collegata
                               e ultima lettura sensori
PATCH  /vases/:id              Modifica nome vaso
DELETE /vases/:id              Rimuovi vaso
GET    /vases/:id/readings     Letture delle ultime 24 ore (non aggregate)
```
 
Tutte le rotte `/vases` richiedono autenticazione e operano solo sui vasi dell'utente.
 
#### Foto e diario
 
```
POST   /plants/:id/photos      Carica foto (multipart, salvata su MinIO)
GET    /plants/:id/photos      Timeline foto della pianta
DELETE /photos/:id             Elimina foto
```
 
#### Storico
 
```
GET    /plants/:id/logs        Storico azioni della pianta
```
 
### Formato risposta standard
 
Il backend restituisce sempre dati pronti per la visualizzazione. L'app non deve mai trasformare, calcolare o interpretare i valori ricevuti.
 
```typescript
// Successo
{
  success: true,
  data: { ... },
  meta?: { page, limit, total }  // per liste paginate
}
 
// Errore
{
  success: false,
  error: {
    code: 'PLANT_NOT_FOUND',  // codice leggibile
    message: 'La pianta richiesta non esiste'
  }
}
```
 
**Esempio — risposta dettaglio pianta con vaso smart:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "nome": "La mia Monstera",
    "specie": "Monstera deliciosa",
    "vaso": {
      "connesso": true,
      "batteria": 87,
      "sensori": {
        "umidita": {
          "valore": 42,
          "etichetta": "Terreno umido",
          "stato": "ok"
        },
        "luce": {
          "valore": 850,
          "etichetta": "Luce sufficiente",
          "stato": "ok"
        },
        "temperatura": {
          "valore": 21.5,
          "etichetta": "Temperatura ottimale",
          "stato": "ok"
        }
      }
    },
    "prossimo_task": {
      "tipo": "annaffiatura",
      "etichetta": "Annaffia oggi",
      "urgente": false,
      "scadenza_relativa": "tra 2 giorni"
    }
  }
}
```
 
L'app legge `etichetta`, `stato` e `scadenza_relativa` direttamente senza alcuna elaborazione.
 
### Codici errore principali
 
```
AUTH_INVALID_CREDENTIALS
AUTH_TOKEN_EXPIRED
AUTH_TOKEN_INVALID
AUTH_INSUFFICIENT_PERMISSIONS
PLANT_NOT_FOUND
PLANT_NOT_OWNED
SPECIES_NOT_FOUND
VASE_ALREADY_PAIRED
VASE_NOT_FOUND
VALIDATION_ERROR
TREFLE_UNAVAILABLE
STORAGE_ERROR
```
 
---
 
## 6. Integrazione vaso smart (MQTT)
 
### Hardware
 
Il vaso smart è basato su **ESP32** con modulo WiFi integrato e Bluetooth Low Energy (BLE). Il firmware utilizza:
 
- **Servizio BLE custom** (libreria Arduino `BLEDevice`, già nel core ESP32) per la
  configurazione WiFi iniziale — vedi la decisione qui sotto
- **ArduinoJson** per il parsing del payload di provisioning
- **PubSubClient** per la connessione MQTT su TLS
- **Preferences** (NVS) per la persistenza di credenziali e `device_id` in flash
- Certificato CA per la verifica TLS: CA pubblica di HiveMQ in dev e staging,
  CA propria di Mosquitto embeddata nel firmware in produzione
 
> **BLE custom invece di ESP-IDF WiFi Provisioning (decisione 2026-07-24).**
> Il protocollo standard Espressif (protobuf, handshake di sicurezza) richiedeva un
> tempo di implementazione sproporzionato per questa fase. È stato scelto un servizio
> BLE semplice con una sola characteristic in scrittura che riceve un JSON. È **meno
> sicuro** — il payload BLE non è cifrato — ma sufficiente per un MVP locale.
> Da rivalutare prima di un rilascio con utenti reali.
### Frequenza di campionamento
 
| Condizione | Frequenza invio | Note |
|---|---|---|
| Normale | ogni 15 minuti | Condizione di default |
| Soglia critica vicina (umidità < 35%) | ogni 5 minuti | Modalità alert attiva |
| Configurabile via topic `config` | variabile | Il backend può modificare la frequenza |
 
La frequenza è configurabile dal backend in tempo reale pubblicando sul topic `fiora/vaso/{device_id}/config`:
 
```json
{
  "sampling_interval_seconds": 300
}
```
 
> **Non ancora implementato (debito D3, D4).** Il firmware pubblica ogni 3 secondi
> anziché ogni 15 minuti, e pur essendo iscritto al topic `config` non registra
> alcuna callback: i comandi di `sampling_interval_seconds` vengono ignorati.
> Lato backend `publishToVase()` esiste ma nessun endpoint la richiama.
 
### Flusso di provisioning WiFi (BLE — prima configurazione)
 
Il primo avvio del vaso richiede la configurazione delle credenziali WiFi via Bluetooth
Low Energy, con il servizio BLE custom descritto sopra.
 
```
PRIMO AVVIO — flusso completo
 
1. L'utente accende il vaso per la prima volta.
2. L'ESP32 si avvia in modalità BLE advertising con nome
   "Fiora-XXXX" (ultime 4 cifre del MAC address).
3. L'app (tramite react-native-ble-plx) scansiona i
   dispositivi BLE nelle vicinanze e mostra quelli con
   prefisso "Fiora-".
4. L'utente seleziona il proprio vaso nell'app.
5. L'app invia via BLE il payload JSON di provisioning
   (contratto definito qui sotto).
6. L'ESP32 salva le credenziali in NVS (flash non volatile),
   si riavvia e tenta la connessione WiFi.
7. Se la connessione WiFi riesce, l'ESP32 si connette a
   Mosquitto e pubblica il primo messaggio su:
     fiora/vaso/{device_id}/status → { "status": "online" }
8. Il backend riceve il messaggio, conferma il pairing
   e associa il vaso all'account utente.
9. L'app riceve conferma via polling su GET /vases/{id}
   e mostra il vaso come connesso.
```
 
#### Contratto del payload BLE
 
Servizio BLE `6e400001-b5a3-f393-e0a9-e50e24dcca9e`, characteristic in scrittura
`6e400002-b5a3-f393-e0a9-e50e24dcca9e`. Il valore scritto è un JSON con questi campi —
**i nomi sono normativi**, app e firmware devono usare esattamente questi:
 
```json
{
  "ssid":        "NomeRete",
  "password":    "passwordWiFi",
  "device_id":   "uuid-generato-dal-backend",
  "mqtt_user":   "username-mqtt",
  "mqtt_pass":   "password-mqtt",
  "broker_host": "xxxxx.s1.eu.hivemq.cloud",
  "broker_port": 8883
}
```
 
> **Disallineamento aperto (debito D1, bloccante).** L'app invia `mqtt_user` e
> `mqtt_pass`; il firmware legge `mqtt_username` e `mqtt_password`, quindi non li
> trova e resta senza credenziali MQTT. **Il firmware va allineato ai nomi qui sopra**
> prima del primo test su hardware reale.
>
> **Debito D9:** `broker_host` e `broker_port` sono parte del contratto ma oggi l'app
> non li invia e il firmware ha host e porta hardcoded. Vanno implementati: senza,
> la migrazione a Mosquitto in produzione richiederebbe il reflash di ogni vaso.
 
**Codifica:** il payload va codificato in **base64 UTF-8-safe**. `btoa` non basta —
SSID e password italiani possono contenere caratteri accentati fuori dal range Latin1,
che verrebbero corrotti silenziosamente.
 
### Flusso di pairing backend (lato API)
 
```
1. App chiama POST /vases/pair
   → Backend genera device_id univoco (UUID) e
     credenziali MQTT dedicate per quel vaso
     (username: vaso-{device_id}, password: random 32 byte)
   → Aggiunge l'utente Mosquitto con adduser
   → Restituisce all'app:
       { device_id, mqtt_username, mqtt_password,
         broker_url, broker_port }
 
2. L'app trasferisce queste credenziali al vaso via BLE
   (step 5 del flusso sopra).
 
3. Alla ricezione del primo messaggio MQTT dal vaso,
   il backend segna il pairing come completato:
     smart_vases.stato = 'connesso'
     smart_vases.last_seen = NOW()
```

> **Credenziali MQTT per ambiente (decisione 2026-07-24).** Lo step "aggiunge l'utente
> Mosquitto" vale **solo in produzione**, dove ogni vaso ha credenziali proprie
> (`vaso-{device_id}`) e ACL per topic.
>
> In **dev e staging** il broker è HiveMQ Cloud nel piano gratuito, che non espone API
> di gestione utenti: tutti i vasi condividono le stesse credenziali del backend, e
> `POST /vases/pair` restituisce quelle già esistenti invece di crearne di nuove.
> Restano comunque **trasmesse via BLE a ogni pairing** anziché essere scritte nel
> firmware, così cambiarle non richiede un reflash.
>
> Conseguenze: la revoca per singolo vaso alla rimozione (§10.5 funzionali) è possibile
> solo in produzione; il `device_id` è comunque sempre generato dal backend. In dev e
> test la verifica TLS usa la CA pubblica di HiveMQ (Let's Encrypt), non quella di Mosquitto.
 
### Riconfigurazione WiFi (rete cambiata)
 
Se l'utente cambia rete WiFi, il vaso deve essere riconfigurato. Il flusso è identico al primo avvio: tenere premuto il pulsante di reset sul vaso per 5 secondi per riportarlo in modalità BLE advertising. Le credenziali MQTT e il `device_id` rimangono invariati — solo il WiFi viene riconfigurato.
 
> **Non implementato (debito D7).** Il firmware non gestisce il pulsante fisico e
> l'app non ha una voce "Riconfigura WiFi": oggi un vaso che perde la rete va rimosso
> e ri-appaiato da zero.
 
### Fallimento della connessione dopo il provisioning
 
Se il vaso, riavviato con le credenziali appena ricevute, **non riesce a connettersi**,
deve tornare da solo in modalità BLE advertising invece di restare in un ciclo di
tentativi infinito:
 
```
1. Tentativo di connessione WiFi, timeout 30 secondi.
2. Se fallisce → ritenta ancora 2 volte (totale 3 tentativi, ~90 s).
3. Se falliscono tutti → cancella le credenziali appena salvate,
   riavvia in modalità BLE advertising `Fiora-XXXX`.
4. Se il WiFi si connette ma il broker MQTT non risponde entro
   30 secondi → stessa procedura: le credenziali MQTT o
   l'host potrebbero essere sbagliati.
```
 
**Perché cancellare le credenziali.** Un vaso che le conserva e continua a ritentare
resta invisibile: non è più raggiungibile via BLE (non fa advertising) e non parla col
backend (non ha rete). Sarebbe recuperabile solo col pulsante fisico di reset, che oggi
il firmware non gestisce (debito D7): un solo errore di battitura nella password
renderebbe il vaso inutilizzabile.
 
Le credenziali salvate da un provisioning **andato a buon fine** non vanno invece mai
cancellate per una disconnessione successiva: in quel caso il vaso ritenta
indefinitamente, perché una rete che cade e torna è normale e non deve richiedere
un nuovo pairing. La distinzione è fra *credenziali mai validate* e *credenziali che
hanno già funzionato almeno una volta*, da tracciare con un flag in NVS.
 
> **Non implementato.** Il firmware attuale non ha questa logica di ritorno in
> advertising. È il requisito che rende possibile il "Riprova" dell'app (§10.1.2 funzionali).
 
### Lato app mobile — flusso BLE provisioning
 
```typescript
// app/vase/pair.tsx (flusso semplificato)
import { BleManager } from 'react-native-ble-plx';
 
const manager = new BleManager();
 
// Ordine scan-first: prima si scopre e si sceglie il vaso,
// solo dopo si chiedono le credenziali WiFi (vedi §6).
 
// 1. Scansiona i dispositivi BLE con prefisso "Fiora-" e
//    mostrali in lista; l'utente sceglie il proprio vaso.
manager.startDeviceScan(null, null, (error, device) => {
  if (device?.name?.startsWith('Fiora-')) aggiungiAllaLista(device);
});
 
// 2. Dopo la scelta del vaso e l'inserimento delle credenziali WiFi:
async function provisiona(device, wifiSSID, wifiPassword) {
  // 3. Il backend genera device_id e restituisce le credenziali MQTT
  const { device_id, mqtt_user, mqtt_pass, broker_host, broker_port } =
    await api.post('/vases/pair');
 
  const connected = await device.connect();
  await connected.discoverAllServicesAndCharacteristics();
 
  const payload = JSON.stringify({
    ssid: wifiSSID,
    password: wifiPassword,
    device_id,
    mqtt_user,      // nomi normativi: vedi il contratto in §6
    mqtt_pass,
    broker_host,
    broker_port,
  });
 
  await connected.writeCharacteristicWithResponseForService(
    FIORA_PROV_SERVICE_UUID,  // 6e400001-b5a3-f393-e0a9-e50e24dcca9e
    FIORA_PROV_CHAR_UUID,     // 6e400002-b5a3-f393-e0a9-e50e24dcca9e
    utf8ToBase64(payload)     // non btoa: SSID/password possono avere accenti
  );
 
  // 4. Verifica dello stato reale: polling su GET /vases/:id fino a 45 s,
  //    finché stato === 'connesso'. Una scrittura BLE riuscita non basta.
  await attendiVasoConnesso(device_id, { timeoutMs: 45_000 });
}
```
 
### Gestione disconnessioni post-pairing
 
Dopo il pairing, se il vaso si disconnette da MQTT il broker pubblica il Last Will
Message configurato dal dispositivo. Il backend:
 
1. Segna `smart_vases.stato = 'disconnesso'` ✅
2. Mette in coda una notifica push all'utente — 📋 Fase 7
3. Passa ai reminder da calendario per quella pianta — 📋 Fase 7
4. Quando il vaso torna online, ripristina i reminder da sensore — 📋 Fase 7
 
Oggi è implementato solo il punto 1: finché gli alert da sensore non esistono (Fase 7),
i reminder sono comunque sempre da calendario e non c'è nulla da commutare.
### Servizio MQTT nel backend
 
```typescript
// src/services/mqtt.service.ts
 
import mqtt from 'mqtt';
import { Queue } from 'bullmq';
 
const alertQueue = new Queue('alerts', { connection: redisConnection });
 
const client = mqtt.connect(process.env.MQTT_BROKER_URL, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  protocol: 'mqtts',
});
 
client.on('connect', () => {
  // Sottoscrizione a tutti i vasi
  client.subscribe('fiora/vaso/+/telemetry');
  client.subscribe('fiora/vaso/+/status');
});
 
client.on('message', async (topic, payload) => {
  const data = JSON.parse(payload.toString());
  const [, , deviceId, type] = topic.split('/');
 
  if (type === 'telemetry') {
    await handleTelemetry(deviceId, data);
  } else if (type === 'status') {
    await handleStatus(deviceId, data);
  }
});
 
async function handleTelemetry(deviceId: string, data: SensorPayload) {
  // 1. Salva lettura su TimescaleDB
  await saveSensorReading(deviceId, data);
 
  // 2. Aggiorna stato vaso (last_seen, batteria)
  await updateVaseStatus(deviceId, data);
 
  // 3. Verifica soglie e aggiungi job di alert se necessario
  const plant = await getPlantByVaseDeviceId(deviceId);
  if (!plant?.species) return;
 
  const soglia = plant.species.soglia_umidita ?? 30;
  if (data.umidita < soglia) {
    await alertQueue.add('soil-alert', {
      plant_id: plant.id,
      user_id: plant.user_id,
      tipo: 'annaffiatura',
      trigger: 'sensore',
      valore: data.umidita,
      soglia,
    }, {
      // Deduplica: non aggiungere se esiste già un alert simile nelle ultime 4h
      jobId: `soil-alert-${plant.id}-${Math.floor(Date.now() / (4 * 3600000))}`,
    });
  }
}
```
 
### Logica soglie sensori (backend only)
 
Tutta la valutazione delle soglie e la traduzione dei valori avviene nel backend. L'app riceve solo le etichette già pronte.
 
| Sensore | Valore grezzo | Etichetta restituita | Campo `stato` |
|---|---|---|---|
| Umidità | < `soglia_umidita` specie | "Terreno asciutto" | `warning` |
| Umidità | `soglia_umidita`–70% | "Terreno umido" | `ok` |
| Umidità | > 70% | "Terreno saturo" | `warning` |
| Luce | < 200 lux | "Luce scarsa" | dipende da specie |
| Luce | 200–1000 lux | "Luce sufficiente" | `ok` |
| Luce | > 1000 lux | "Luce intensa" | dipende da specie |
| Temperatura | < `temp_min` specie | "Troppo freddo" | `warning` |
| Temperatura | tra `temp_min` e `temp_max` | "Temperatura ottimale" | `ok` |
| Temperatura | > `temp_max` specie | "Troppo caldo" | `warning` |
 
Il campo `stato` può essere `ok`, `warning` o `critical`. L'app usa questo campo per scegliere il colore dell'indicatore visivo, senza conoscere i valori numerici di soglia.
 
---
 
## 7. Sistema di reminder e job queue
 
### Setup BullMQ
 
```typescript
// src/lib/bullmq.ts
import { Queue, Worker, QueueScheduler } from 'bullmq';
 
export const redisConnection = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
};
 
// Code disponibili
export const reminderQueue = new Queue('reminders', { connection: redisConnection });
export const alertQueue    = new Queue('alerts',    { connection: redisConnection });
export const notifQueue    = new Queue('notifications', { connection: redisConnection });
```
 
### Worker reminder (calendario)
 
```typescript
// src/jobs/reminder.job.ts
const reminderWorker = new Worker('reminders', async (job) => {
  const { plant_id, user_id, tipo } = job.data;
 
  // 1. Crea task nel DB
  await prisma.tasks.create({
    data: { plant_id, user_id, tipo, sorgente: 'calendario',
            scadenza: new Date(), stato: 'pending' }
  });
 
  // 2. Invia notifica push
  await notifQueue.add('push', {
    user_id,
    title: 'Cura in scadenza',
    body: `È ora di ${tipo} per la tua pianta`,
    data: { plant_id, tipo }
  });
 
  // 3. Pianifica prossimo reminder in base a specie + clima
  const interval = await getReminderInterval(plant_id, tipo);
  await reminderQueue.add(tipo, job.data, { delay: interval });
 
}, { connection: redisConnection });
```
 
### Worker alert (sensori)
 
```typescript
// src/jobs/alert.job.ts
const alertWorker = new Worker('alerts', async (job) => {
  const { plant_id, user_id, tipo } = job.data;
 
  // Crea task urgente con priorità alta
  await prisma.tasks.create({
    data: { plant_id, user_id, tipo, sorgente: 'sensore',
            scadenza: new Date(), stato: 'pending' }
  });
 
  // Notifica push immediata
  await notifQueue.add('push', {
    user_id,
    title: 'La tua pianta ha bisogno di te',
    body: 'Il terreno è troppo asciutto — annaffia ora',
    data: { plant_id, tipo, priority: 'high' }
  });
 
}, { connection: redisConnection });
```
 
### Frequenze reminder per clima (in ore)
 
```typescript
const REMINDER_INTERVALS = {
  annaffiatura: {
    poca:      { temperato: 168, mediterraneo: 144, tropicale: 120, freddo: 192, appartamento: 168 },
    media:     { temperato: 72,  mediterraneo: 60,  tropicale: 48,  freddo: 96,  appartamento: 72  },
    frequente: { temperato: 48,  mediterraneo: 36,  tropicale: 24,  freddo: 60,  appartamento: 48  },
  },
  concimazione: {
    // Ogni 2-4 settimane in base alla specie, invariante per clima
    default: 336  // 14 giorni
  },
  nebulizzazione: {
    alta:  24,   // ogni giorno
    media: 48,
    bassa: 168,
  }
};
```
 
---
 
## 8. Catalogo specie
 
### Sorgente dati botanici — Trefle (prod) / CSV (dev-test)
 
Fiora utilizza **Trefle** come sorgente principale per i dati botanici in produzione (tassonomia, crescita, distribuzione, immagini). A differenza di un fallback "live" al momento della ricerca, l'intero catalogo Trefle accessibile dalla chiave API viene **importato una volta in `species_import_raw`** (con `fonte='trefle'`) tramite un job batch, e da lì sincronizzato verso `species`. La ricerca utente (sezione "Flusso ricerca specie" sotto) lavora quindi sempre su dati già presenti in PostgreSQL, mai su chiamate dirette a Trefle in tempo reale.
 
In **dev e test** la stessa tabella viene popolata manualmente **via import CSV** (`fonte='csv'`) con un set ridotto di specie, senza dipendere da Trefle.
 
> ⚠️ **Nota sui tempi e i volumi**: Trefle espone centinaia di migliaia di specie, con un rate limit di **120 richieste/minuto**. L'import completo richiede quindi ore o giorni, non minuti. Il job di import va progettato come **resumable**: deve salvare il progresso (es. ultima pagina importata) e poter ripartire da dove si era interrotto in caso di crash, riavvio del backend o superamento di una sessione di rate limit, senza ripartire da zero.
 
### Job di import iniziale (`trefle.service.ts`)
 
```typescript
// src/services/trefle.service.ts
//
// Job batch (eseguito una tantum al primo deploy, poi solo per nuove pagine
// se Trefle aggiunge specie) che importa l'intero catalogo Trefle in
// species_import_raw (fonte='trefle'). Paginato e resumable: salva l'ultima
// pagina completata in Redis per poter ripartire in caso di interruzione.
 
const TREFLE_PAGE_SIZE = 200;
const RATE_LIMIT_DELAY_MS = 60_000 / 120; // rispetta i 120 req/min
 
async function importFullTrefleCatalog() {
  let page = Number(await redis.get('trefle:import:last_page')) || 1;
 
  while (true) {
    const response = await fetchTreflePage(page, TREFLE_PAGE_SIZE);
    if (response.data.length === 0) break; // fine catalogo
 
    await prisma.$transaction(
      response.data.map((item) =>
        prisma.species_import_raw.upsert({
          where: { external_id: item.id },
          create: mapTrefleRawRecord(item),
          update: mapTrefleRawRecord(item),
        })
      )
    );
 
    await redis.set('trefle:import:last_page', page);
    page += 1;
    await sleep(RATE_LIMIT_DELAY_MS);
  }
 
  await redis.del('trefle:import:last_page');
  logger.info({ type: 'trefle_import', event: 'completed', pages: page });
}
 
function mapTrefleRawRecord(item: TrefleApiSpecies) {
  return {
    external_id: item.id,
    fonte: 'trefle',
    slug: item.slug,
    scientific_name: item.scientific_name,
    common_name: item.common_name,
    family: item.family,
    family_common_name: item.family_common_name,
    genus: item.genus,
    rank: item.rank,
    status: item.status,
    data: item, // payload completo, salvato così com'è
    updated_at_source: item.updated_at ? new Date(item.updated_at) : null,
  };
}
```
 
### Job di sync giornaliero (refresh + mappatura verso `species`)
 
```typescript
// src/jobs/trefle-sync.job.ts
//
// Eseguito giornalmente (BullMQ, cron). NON re-importa tutto il catalogo:
// aggiorna solo i record raw già presenti (per tenerli freschi) e propaga
// le modifiche verso `species`, rispettando le specie con fonte='curato'
// (mai sovrascritte automaticamente).
 
const trefleSyncWorker = new Worker('trefle-sync', async () => {
  const rawRecords = await prisma.species_import_raw.findMany({ where: { fonte: 'trefle' } });
 
  for (const raw of rawRecords) {
    await prisma.species.upsert({
      where: { external_id: raw.external_id },
      create: mapTrefleRawToSpecies(raw),
      update: {
        // Aggiorna solo le specie ancora marcate fonte='trefle':
        // se un admin ha modificato manualmente (fonte='curato'), non si tocca.
        ...mapTrefleRawToSpecies(raw),
      },
    });
  }
}, {
  connection: redisConnection,
  // Esegui solo sulle righe con fonte ancora 'trefle' — il filtro va applicato
  // nella query upsert/update reale (omesso qui per brevità)
});
```
 
### Flusso ricerca specie
 
Con il catalogo Trefle già importato in `species`, la ricerca diventa una semplice query sul catalogo interno — non serve più alcun fallback a runtime:
 
```typescript
// src/services/species.service.ts
 
async function searchSpecies(query: string) {
  return prisma.species.findMany({
    where: {
      OR: [
        { nome_comune: { contains: query, mode: 'insensitive' } },
        { nome_scientifico: { contains: query, mode: 'insensitive' } },
      ],
      stato: 'attivo',
    },
    orderBy: [
      { fonte: 'asc' }, // 'curato' prima di 'trefle' a parità di rilevanza
    ],
    take: 20,
  });
}
```
 
### Mappatura dati Trefle → schema interno
 
```typescript
function mapTrefleRawToSpecies(raw: SpeciesImportRaw): Partial<Species> {
  const trefleSpecies = raw.data as TrefleApiSpecies;
  return {
    external_id:      raw.external_id,
    nome_comune:      trefleSpecies.common_name ?? trefleSpecies.scientific_name,
    nome_scientifico: trefleSpecies.scientific_name,
    categoria:        mapCategoria(trefleSpecies.family),
    luce:             mapLuce(trefleSpecies.growth?.light),
    annaffiatura:     mapAnnaffiatura(trefleSpecies.growth?.moisture_use),
    umidita:          mapUmidita(trefleSpecies.growth?.atmospheric_humidity),
    temp_min:         trefleSpecies.growth?.minimum_temperature?.deg_c ?? null,
    temp_max:         trefleSpecies.growth?.maximum_temperature?.deg_c ?? null,
    tossicita:        null,  // Trefle non ha questo dato
    note_cura:        '',
    soglia_umidita:   null,  // impostata manualmente per le specie curate
    immagine_principale_url: trefleSpecies.image_url ?? null,
    fonte:            'trefle',
    stato:            'attivo',
  };
}
 
function mapLuce(value?: number): 'bassa' | 'media' | 'alta' {
  if (!value) return 'media';
  if (value <= 3) return 'bassa';
  if (value <= 7) return 'media';
  return 'alta';
}
 
function mapAnnaffiatura(value?: string): 'poca' | 'media' | 'frequente' {
  if (!value) return 'media';
  if (['Low', 'Xeric'].includes(value)) return 'poca';
  if (['Moderate'].includes(value)) return 'media';
  return 'frequente';
}
```
 
---
 
## 9. Autenticazione
 
### Strategia JWT
 
- **Access token**: JWT, scadenza 15 minuti, firmato con `JWT_SECRET`
- **Refresh token**: stringa random (64 byte hex), scadenza 30 giorni, salvato su DB
- Il refresh token viene ruotato ad ogni utilizzo (rotation)
- Login social (Google/Apple): verifica il token ID sul backend, crea o recupera l'utente
### Middleware autenticazione
 
```typescript
// src/middleware/auth.middleware.ts
import jwt from 'jsonwebtoken';
 
export const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'AUTH_TOKEN_MISSING' });
 
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
    req.userId = payload.sub;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'AUTH_TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'AUTH_TOKEN_INVALID' });
  }
};
```
 
### Eliminazione account — periodo di grazia
 
```typescript
// DELETE /auth/account
// 1. Imposta deleted_at = NOW() + 30 giorni
// 2. Manda email di conferma con link per annullare
// 3. Job schedulato (BullMQ) elimina definitivamente i dati dopo 30 giorni
// 4. Prima dell'eliminazione: elimina foto da MinIO, dati sensori, poi utente
```
 
---
 
## 10. App mobile — struttura
 
### Struttura progetto mobile
 
```
mobile/
├── app/
│   ├── (auth)/
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── onboarding.tsx
│   ├── (tabs)/
│   │   ├── index.tsx          # Schermata Oggi
│   │   ├── collection.tsx     # Collezione piante
│   │   └── settings.tsx       # Impostazioni
│   ├── plant/
│   │   ├── [id].tsx           # Dettaglio pianta
│   │   ├── add.tsx            # Aggiunta pianta
│   │   └── edit/[id].tsx
│   └── vase/
│       └── pair.tsx           # Flusso pairing vaso
├── components/
│   ├── PlantCard.tsx
│   ├── TaskItem.tsx
│   ├── SensorBadge.tsx        # Indicatore stato sensore
│   ├── SensorChart.tsx        # Grafico storico sensori
│   └── VasePairingFlow.tsx
├── store/
│   ├── auth.store.ts
│   ├── plants.store.ts
│   ├── tasks.store.ts
│   └── sync.store.ts          # Gestione sync offline
├── services/
│   ├── api.ts                 # Axios instance con interceptor
│   ├── mqtt.ts                # Client MQTT mobile
│   └── notifications.ts
├── hooks/
│   ├── usePlants.ts
│   ├── useTasks.ts
│   └── useSensorData.ts
└── lib/
    ├── db.ts                  # SQLite locale (Expo SQLite)
    └── storage.ts             # SecureStore per token
```
 
### Schermate e navigazione
 
```
Onboarding (una tantum)
  └── Scelta contenuto → Selezione clima → Auth → [Pairing vaso opzionale]
 
Tab principale
  ├── Oggi         — task del giorno + alert sensori
  ├── Collezione   — lista piante/bouquet con filtri
  └── Impostazioni — profilo, clima, notifiche
 
Stack pianta
  ├── Dettaglio pianta
  │   ├── Tab: Cure (task + storico)
  │   ├── Tab: Dati sensore (se vaso connesso)
  │   └── Tab: Diario foto
  └── Modifica pianta
 
Stack bouquet
  └── Dettaglio bouquet
 
Stack vaso
  └── Pairing guidato
```
 
### Store Zustand — plants
 
L'app non contiene logica di dominio. Gli store gestiscono solo stato UI e chiamate API.
 
```typescript
// store/plants.store.ts
interface PlantsStore {
  plants: Plant[];           // dati già elaborati dal backend
  isLoading: boolean;
  fetchPlants: () => Promise<void>;
  addPlant: (data: CreatePlantDto) => Promise<Plant>;
  updatePlant: (id: string, data: Partial<Plant>) => Promise<void>;
  archivePlant: (id: string) => Promise<void>;
  deletePlant: (id: string) => Promise<void>;
  // Aggiornamento real-time: riceve dati già tradotti dal backend
  updateSensorData: (vaseId: string, reading: SensorReadingElaborated) => void;
}
 
// SensorReadingElaborated — quello che arriva dal backend, pronto per la UI
interface SensorReadingElaborated {
  umidita: { valore: number; etichetta: string; stato: 'ok' | 'warning' | 'critical' };
  luce:    { valore: number; etichetta: string; stato: 'ok' | 'warning' | 'critical' };
  temperatura: { valore: number; etichetta: string; stato: 'ok' | 'warning' | 'critical' };
  batteria: number;
  connesso: boolean;
}
```
 
---
 
## 11. Sincronizzazione offline
 
### Strategia
 
L'app usa SQLite locale come cache primaria. Tutte le operazioni scrivono prima su SQLite, poi vengono sincronizzate con il server quando la connessione è disponibile.
 
```typescript
// lib/db.ts — schema SQLite locale (subset del DB server)
const LOCAL_SCHEMA = `
  CREATE TABLE IF NOT EXISTS plants_local (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,       -- JSON serializzato
    updated_at TEXT NOT NULL,
    synced INTEGER DEFAULT 0  -- 0 = da sincronizzare
  );
 
  CREATE TABLE IF NOT EXISTS tasks_local (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    synced INTEGER DEFAULT 0
  );
 
  CREATE TABLE IF NOT EXISTS pending_actions (
    id TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL,   -- es. '/tasks/abc/complete'
    method TEXT NOT NULL,     -- 'PATCH' | 'POST' | 'DELETE'
    body TEXT,
    created_at TEXT NOT NULL
  );
`;
```
 
### Sync al ritorno online
 
```typescript
// store/sync.store.ts
async function syncPendingActions() {
  const pending = await db.getAllPendingActions();
  for (const action of pending) {
    try {
      await api[action.method.toLowerCase()](action.endpoint, action.body);
      await db.deletePendingAction(action.id);
    } catch (err) {
      if (err.status !== 409) break; // stop su errori non-conflict
    }
  }
  // Poi scarica dati aggiornati dal server
  await fetchPlants();
  await fetchTodayTasks();
}
```
 
### Conflitti
 
In caso di conflitto (stessa risorsa modificata su due dispositivi), **prevale la versione con `updated_at` più recente**. Il backend confronta i timestamp e risponde con `409 Conflict` + la versione corrente se il client ha dati più vecchi.
 
---
 
## 12. Notifiche push
 
### Setup Expo + backend
 
```typescript
// src/services/notification.service.ts
import { Expo } from 'expo-server-sdk';
 
const expo = new Expo();
 
async function sendPushNotification(userId: string, notification: PushNotification) {
  const tokens = await getPushTokensForUser(userId);
 
  const messages = tokens
    .filter(token => Expo.isExpoPushToken(token))
    .map(token => ({
      to: token,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      priority: notification.priority ?? 'normal',
      sound: 'default',
    }));
 
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    await expo.sendPushNotificationsAsync(chunk);
  }
}
```
 
### Tipi di notifica
 
| Tipo | Trigger | Priorità |
|---|---|---|
| Alert sensore (umidità) | Soglia superata dal vaso | Alta |
| Reminder annaffiatura | Job schedulato | Normale |
| Reminder concimazione | Job schedulato | Normale |
| Vaso disconnesso | Last Will MQTT | Normale |
| Batteria vaso scarica | Lettura sensore < 20% | Normale |
| Specie approvata | Admin approva proposta | Bassa |
 
---
 
## 13. Storage foto
 
### Flusso upload
 
```typescript
// POST /plants/:id/photos
// 1. Riceve multipart/form-data con il file immagine
// 2. Ridimensiona a max 1200x1200px (sharp)
// 3. Converte in WebP per ridurre peso
// 4. Carica su MinIO nel bucket 'fiora-photos'
// 5. Salva URL nel DB (photo_diary)
// 6. Restituisce URL pubblico
 
import sharp from 'sharp';
import { minioClient } from '../lib/minio';
 
async function uploadPhoto(file: Express.Multer.File, plantId: string, userId: string) {
  const processed = await sharp(file.buffer)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
 
  const filename = `${userId}/${plantId}/${Date.now()}.webp`;
  await minioClient.putObject('fiora-photos', filename, processed, {
    'Content-Type': 'image/webp',
  });
 
  return `${process.env.MINIO_PUBLIC_URL}/fiora-photos/${filename}`;
}
```
 
### Bucket MinIO
 
```
fiora-photos/
  {user_id}/
    {plant_id}/
      {timestamp}.webp
```
 
---
 
## 14. Variabili d'ambiente
 
### Backend `.env`
 
```env
# Server
NODE_ENV=production
PORT=3000
 
# Logging (vedi §14.5) — LOG_DIR iniettato da docker-compose in staging/prod
LOG_LEVEL=info
LOG_DIR=/app/logs
 
# Database
DATABASE_URL=postgresql://user:password@db-server-ip:5432/fiora
 
# Redis
REDIS_HOST=db-server-ip
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
 
# JWT
JWT_SECRET=your-256-bit-secret-minimum
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=30
 
# MQTT
MQTT_BROKER_URL=mqtts://localhost:8883
MQTT_USERNAME=fiora-backend
MQTT_PASSWORD=your-mqtt-password
 
# MinIO
MINIO_ENDPOINT=db-server-ip
MINIO_PORT=9000
MINIO_ACCESS_KEY=your-minio-access-key
MINIO_SECRET_KEY=your-minio-secret-key
MINIO_PUBLIC_URL=https://storage.tangifiori.com
 
# Trefle API
TREFLE_API_URL=https://trefle.io/api/v1
TREFLE_API_KEY=your-trefle-key
 
# Expo (notifiche push)
EXPO_ACCESS_TOKEN=your-expo-token
 
# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_PRIVATE_KEY=your-apple-private-key
```
 
### Mobile `.env`
 
```env
EXPO_PUBLIC_API_URL=https://api.tangifiori.com
EXPO_PUBLIC_MQTT_URL=mqtts://api.tangifiori.com:8883
```
 
---

## 14.5. Logging e audit (backend)

Libreria: **Pino** (JSON strutturato). Istanze in `src/lib/logger.ts` (applicativo) e `src/lib/audit.ts` (audit sicurezza), separate perché hanno retention e scopo diversi.

### Log applicativo (`logger`)
- Un modulo importa `logger` e crea un child logger con `logger.child({ module: 'nome' })` per contestualizzare (usato in `mqtt.ts`, `redis.ts`, jobs, `notification.service.ts`).
- Livello controllato da `LOG_LEVEL` (`trace|debug|info|warn|error|fatal`), default `debug` in dev, `info` in produzione.
- Multistream in base ad ambiente:
  - **Dev**: console `pino-pretty` colorata + file.
  - **Produzione/staging**: stdout JSON puro (catturato anche da `docker logs`) + file.
  - **Test** (`NODE_ENV=test`): tutto silenziato, nessun file scritto.
- File generati in `LOG_DIR` (default `./logs`, in staging montato da Docker su `/app/logs`), rotazione **giornaliera** via `pino-roll`:
  - `combined-YYYY-MM-DD.log` — tutti i livelli, 14 giorni conservati
  - `error-YYYY-MM-DD.log` — solo `error`/`fatal`, 30 giorni conservati
- Request logging HTTP via `pino-http` in `app.ts`: ogni richiesta logga metodo/path/status/durata/`requestId` (propagato o generato, esposto in header `x-request-id`) e `userId` se autenticato. Redatti `authorization` header e i campi password dal body.
- `src/index.ts` intercetta anche `uncaughtException`/`unhandledRejection` (livello `fatal`).

### Audit log (`audit` in `src/lib/audit.ts`)
Traccia eventi di sicurezza e azioni sensibili, separato dal log applicativo perché va conservato più a lungo (**90 giorni**, file `audit-YYYY-MM-DD.log`) e serve a ricostruire "chi ha fatto cosa" indipendentemente dal rumore applicativo.

Eventi coperti oggi (`AuditEvent` in `audit.ts`):
- `auth.register`, `auth.login.success`, `auth.login.failure` (email/password **e** OAuth Google/Apple), `auth.logout`, `auth.refresh`
- `auth.change_password` (logga anche il tentativo fallito per password attuale errata)
- `auth.account_deletion.requested`, `auth.account_deletion.cancelled`
- `vase.pairing.started`, `vase.deleted`
- `plant.vase_link.changed` (collega/scollega vaso↔pianta da `PATCH /plants/:id`)

Ogni voce include `userId`/`email` (quando noti), `ip` (da `req.ip`, passato esplicitamente dalle route ai service — non c'è middleware automatico), `targetId` (risorsa toccata) e `meta` libero per dettagli evento-specifici.

Non è ancora coperto: cambio ruolo utente (nessun endpoint lo espone oggi, solo modifica manuale via Prisma Studio/seed).

### Accesso ai log in staging
```bash
# Sul server Ubuntu, dentro il repo
tail -f logs/staging/combined-$(date +%F).log | jq .
tail -f logs/staging/error-$(date +%F).log | jq .
tail -f logs/staging/audit-$(date +%F).log | jq .
```
Bind mount definito in `docker-compose.staging.yml` (`./logs/staging:/app/logs`), cartella esclusa da git (`.gitignore` root e `backend/.gitignore`).

---
 
## 15. Convenzioni di sviluppo
 
### Branching
 
```
main          → produzione
develop       → integrazione
feature/*     → nuove funzioni
fix/*         → bug fix
release/*     → preparazione release
```
 
### Commit (Conventional Commits)
 
```
feat(plants): aggiunge archiviazione piante
fix(mqtt): corregge gestione disconnessione vaso
chore(deps): aggiorna expo sdk a 51.1
docs(api): aggiorna documentazione endpoint task
```
 
### TypeScript — regole principali
 
- Strict mode abilitato in `tsconfig.json`
- Nessun `any` esplicito — usare `unknown` e type guard
- Tutti gli endpoint API tipizzati con interfacce condivise
- Zod per validazione input a runtime
### Gestione errori backend
 
```typescript
// Tutti i controller usano questo pattern
export const createPlant = async (req: Request, res: Response) => {
  try {
    const data = CreatePlantSchema.parse(req.body);  // Zod validation
    const plant = await plantsService.create(req.userId, data);
    res.status(201).json({ success: true, data: plant });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: err.errors } });
    }
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
    }
    logger.error(err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR' } });
  }
};
```
 
### Testing
 
- **Backend**: Jest + Supertest per integration test degli endpoint
- **Mobile**: Jest + React Native Testing Library per componenti
- **Coverage minima**: 70% per servizi core (auth, reminder, mqtt)
### Logging
 
#### Libreria e formato
 
Usare `pino` su Node.js per logging strutturato in JSON. Ogni riga di log è un oggetto JSON su una singola riga, leggibile da strumenti di analisi.
 
```typescript
// src/lib/logger.ts
import pino from 'pino';
 
export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  base: { service: 'fiora-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    // Non loggare mai questi campi per privacy e sicurezza
    paths: ['*.password', '*.password_hash', '*.token', '*.authorization'],
    censor: '[REDACTED]',
  },
});
```
 
#### Livelli di log
 
| Livello | Quando usarlo | Retention |
|---|---|---|
| `error` | Eccezioni non gestite, errori DB, servizi non raggiungibili | 30 giorni |
| `warn` | Errori gestiti ma anomali (es. Trefle non risponde, vaso disconnesso) | 30 giorni |
| `info` | Ogni richiesta HTTP, ogni messaggio MQTT ricevuto, job completati | 7 giorni |
| `debug` | Dettagli interni, query SQL, payload completi | 7 giorni (solo dev) |
 
#### Cosa loggare
 
**Ogni richiesta HTTP** — tramite middleware automatico:
```typescript
// src/middleware/request-logger.middleware.ts
import { logger } from '../lib/logger';
 
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const level = res.statusCode >= 500 ? 'error'
                : res.statusCode >= 400 ? 'warn'
                : 'info';
    logger[level]({
      type: 'http',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Date.now() - start,
      user_id: req.userId ?? null,
      ip: req.ip,
    });
  });
  next();
};
```
 
**Ogni messaggio MQTT ricevuto:**
```typescript
logger.info({
  type: 'mqtt',
  topic,
  device_id: deviceId,
  umidita: data.umidita,
  luce: data.luce,
  temperatura: data.temperatura,
  batteria: data.batteria,
});
```
 
**Alert sensore scattato:**
```typescript
logger.warn({
  type: 'sensor_alert',
  device_id: deviceId,
  plant_id: plant.id,
  user_id: plant.user_id,
  sensore: 'umidita',
  valore: data.umidita,
  soglia: soglia,
  azione: 'annaffiatura',
});
```
 
**Job BullMQ completato o fallito:**
```typescript
// Nel worker
logger.info({ type: 'job_completed', queue: 'reminders', job_id: job.id, plant_id: job.data.plant_id });
logger.error({ type: 'job_failed', queue: 'reminders', job_id: job.id, error: err.message });
```
 
**Errori non gestiti:**
```typescript
logger.error({
  type: 'unhandled_error',
  error: err.message,
  stack: err.stack,
  user_id: req.userId ?? null,
  path: req.path,
});
```
 
**Eventi di autenticazione:**
```typescript
logger.info({ type: 'auth', event: 'login',    user_id, provider: 'email' });
logger.info({ type: 'auth', event: 'logout',   user_id });
logger.warn({ type: 'auth', event: 'login_failed', email, ip: req.ip });
logger.warn({ type: 'auth', event: 'token_expired', user_id });
```
 
**Eventi di audit (modifiche sensibili):**
```typescript
logger.info({ type: 'audit', event: 'account_delete_requested', user_id, grace_until });
logger.info({ type: 'audit', event: 'account_deleted',          user_id });
logger.info({ type: 'audit', event: 'species_approved',         species_id, admin_id });
logger.info({ type: 'audit', event: 'species_rejected',         species_id, admin_id, motivo });
logger.info({ type: 'audit', event: 'vase_paired',              vase_id, user_id, device_id });
logger.warn({ type: 'audit', event: 'vase_disconnected',        vase_id, user_id, device_id });
```
 
#### File di log e rotazione
 
I log vengono scritti su file separati per livello, configurati con `pino` + `pino-roll` (rotazione automatica) o `logrotate` di sistema.
 
```
/var/log/fiora/
  app-info.log       ← livelli info + debug   → retention 7 giorni
  app-error.log      ← livelli error + warn   → retention 30 giorni
  mqtt.log           ← solo eventi MQTT        → retention 7 giorni
  audit.log          ← solo eventi audit       → retention 30 giorni
```
 
Configurazione `logrotate` (`/etc/logrotate.d/fiora`):
 
```
/var/log/fiora/app-info.log /var/log/fiora/mqtt.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    copytruncate
}
 
/var/log/fiora/app-error.log /var/log/fiora/audit.log {
    daily
    rotate 30
    compress
    missingok
    notifempty
    copytruncate
}
```
 
#### Log Mosquitto
 
Mosquitto scrive i propri log in `/var/log/fiora/mosquitto.log` con gli eventi di connessione e disconnessione dei vasi. Retention: 7 giorni (30 per gli errori di connessione).
 
```conf
# in mosquitto.conf — già configurato nella sezione 3
log_dest file /mosquitto/log/mosquitto.log
log_type error
log_type warning
log_type notice
log_type information
log_timestamp true
```
 
#### Cosa NON loggare mai
 
- Password, hash di password, token JWT, refresh token
- Credenziali MQTT dei vasi
- Dati personali oltre a `user_id` (no email, no nome)
- Payload completi delle richieste HTTP in produzione (solo in debug)
---
 
## Requisiti del firmware del vaso smart
 
> **Nota storica.** Questo capitolo nasce come brief per un partner hardware esterno.
> Il firmware è oggi **nel monorepo** (`firmware/vaso/vaso.ino`) e mantenuto insieme al
> resto del progetto: va letto come l'elenco dei requisiti che il firmware deve
> soddisfare, non come una consegna a terzi.
>
> **Il contratto normativo del payload di provisioning è quello in §6**, non l'esempio
> qui sotto, che riporta i nomi dei campi in una forma superata (`mqtt_username`,
> `broker_url`). In caso di divergenza vale §6.
>
> Diversi requisiti di questo capitolo non sono ancora implementati: buffer offline (D8),
> segnalazione batteria (D5), reset fisico (D7), frequenza di campionamento (D4).
> Vedi il debito noto nella roadmap.
 
### Hardware di riferimento
 
- **MCU**: ESP32 (dual-core, WiFi + BLE integrati)
- **Sensori**: umidità suolo, luce ambientale (lux), temperatura
- **Alimentazione**: batteria con segnalazione livello
### Requisiti firmware
 
**1. WiFi Provisioning via BLE (primo avvio)**
 
Al primo avvio (o dopo un reset prolungato) il dispositivo si avvia in modalità BLE advertising con nome `Fiora-{ultimi4MAC}`, esponendo il servizio BLE custom descritto in §6 (non il protocollo ESP-IDF WiFi Provisioning: vedi la motivazione della scelta in §6).
 
Il payload di provisioning ricevuto via BLE contiene:
```json
{
  "ssid": "NomeReteWiFi",
  "password": "PasswordWiFi",
  "device_id": "uuid-generato-dal-backend",
  "mqtt_username": "vaso-{device_id}",
  "mqtt_password": "password-random-32byte",
  "broker_url": "api.tangifiori.com",
  "broker_port": 8883
}
```
 
Tutte le credenziali vanno salvate in **NVS** (Non-Volatile Storage) e persistono anche dopo riavvii.
 
**2. Connessione MQTT su TLS**
 
- Porta: `8883`
- TLS: obbligatorio (TLS 1.2 minimo)
- Il certificato CA di Mosquitto va embeddato nel firmware
- Username e password: quelli ricevuti al provisioning
- QoS 1 per tutti i messaggi
**3. Pubblicazione telemetry**
 
Topic: `fiora/vaso/{device_id}/telemetry`
 
Frequenza default: **ogni 15 minuti**. Se umidità < 35%: **ogni 5 minuti**.
 
```json
{
  "device_id": "vaso-abc123",
  "timestamp": "2024-03-15T10:30:00Z",
  "umidita": 42,
  "luce": 850,
  "temperatura": 21.5,
  "batteria": 87
}
```
 
**4. Last Will Message**
 
Configurato al momento della connessione MQTT, QoS 1:
- Topic: `fiora/vaso/{device_id}/status`
- Payload: `{"device_id": "vaso-abc123", "status": "offline"}`
Al momento della connessione, pubblicare anche:
- Payload: `{"device_id": "vaso-abc123", "status": "online"}`
**5. Sottoscrizione topic config**
 
Topic: `fiora/vaso/{device_id}/config`
 
Il vaso deve reagire ai messaggi di configurazione inviati dal backend:
```json
{
  "sampling_interval_seconds": 300
}
```
 
**6. Buffer locale offline**
 
Quando il WiFi non è disponibile, i dati dei sensori vanno bufferizzati localmente (in NVS o SPIFFS). Al ripristino della connessione, i dati bufferizzati vengono trasmessi con i timestamp originali, nell'ordine di acquisizione.
 
**7. Segnalazione batteria scarica**
 
Quando `batteria < 20`, includere nel payload un campo aggiuntivo:
```json
{ ..., "batteria": 18, "batteria_scarica": true }
```
 
**8. Reset e riconfigurazione**
 
Tenere premuto il pulsante fisico per 5 secondi cancella le credenziali WiFi da NVS e riavvia in modalità BLE provisioning. Le credenziali MQTT e il `device_id` rimangono invariati.
 
**9. Aggiornamento firmware over-the-air**
 
Il firmware deve poter essere aggiornato via OTA, senza cavo: vedi §16 per il protocollo
completo. Sostituisce l'assunto originale di questo capitolo, per cui firmware e OTA
sarebbero rimasti responsabilità di un partner esterno — non è più così.
---

## 16. Aggiornamento firmware OTA

**Stato: 📋 non implementato.** Specifica di progetto, prevista dopo il completamento
della Fase 6 (pairing BLE). Il firmware è nel monorepo (`firmware/vaso/vaso.ino`),
quindi l'OTA è responsabilità di Fiora e non di un partner esterno.

### 16.1 Perché serve

Senza OTA ogni correzione al firmware richiede di smontare il vaso, collegarlo
via USB a un Mac con Arduino IDE e riflasharlo. Con un solo prototipo è
fastidioso; con vasi in mano a utenti è impossibile. Casi concreti già presenti
nel progetto:

- Il mismatch `mqtt_username`/`mqtt_user` del payload BLE (debito D1, vedi §6):
  un fix di due righe che oggi richiede il cavo.
- Cambio delle credenziali MQTT condivise o migrazione da HiveMQ a Mosquitto in
  produzione (broker host oggi hardcoded nello sketch).
- Calibrazione del sensore di umidità (`soilDry`/`soilWet`).
- Frequenza di campionamento, buffer offline, gestione batteria — tutte
  funzionalità firmware ancora da scrivere.

---

### 16.2 Decisioni di progetto

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

### 16.3 Modello dati

#### 16.3.1 Nuova tabella `firmware_releases`

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

#### 16.3.2 Nuove colonne su `smart_vases`

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

### 16.4 Protocollo MQTT

#### 16.4.1 Topic nuovi

| Topic | Direzione | QoS | Retained | Payload |
|---|---|---|---|---|
| `fiora/vaso/{device_id}/ota` | backend → vaso | 1 | no | comando di aggiornamento |
| `fiora/vaso/{device_id}/ota/status` | vaso → backend | 1 | no | avanzamento ed esito |

> ⚠️ La sottoscrizione esistente `fiora/vaso/+/status` **non** intercetta
> `fiora/vaso/{id}/ota/status`: il wildcard `+` copre un solo livello. Va
> aggiunta una `subscribe('fiora/vaso/+/ota/status')` in `connectMqtt()`, e
> `routeMessage()` va aggiornato perché oggi fa match sull'ultimo segmento del
> topic (`ota/status` finirebbe in "topic non gestito").

#### 16.4.2 Comando (backend → vaso)

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

#### 16.4.3 Stato (vaso → backend)

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

#### 16.4.4 Versione firmware riportata dal vaso

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

### 16.5 API backend

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

**Nuovi codici errore** (da aggiungere alla lista di §5):
`FIRMWARE_NOT_FOUND`, `FIRMWARE_UP_TO_DATE`, `FIRMWARE_UPDATE_IN_PROGRESS`,
`FIRMWARE_BATTERY_LOW`, `FIRMWARE_UPDATE_FAILED`, `VASE_OFFLINE`.

---

### 16.6 Firmware ESP32

#### 16.6.1 Prerequisito: tabella delle partizioni con OTA

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

#### 16.6.2 Costante di versione

```cpp
#define FW_VERSION "1.1.0"   // SemVer, allineata al tag git firmware-v1.1.0
```

Da includere nel payload `status` e nei messaggi `ota/status`.

#### 16.6.3 Handler MQTT (oggi mancante)

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

#### 16.6.4 Download e scrittura

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

### 16.7 Rollback e protezione dal brick

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

### 16.8 App mobile

#### 16.8.1 Dove vive la funzione

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

#### 16.8.2 Conferma e polling

Prima di avviare, un `ActionSheet` (lo stesso componente già usato in questa
schermata) spiega cosa succede: "L'aggiornamento richiede circa 2 minuti. Il
vaso si riavvierà e non invierà dati durante l'operazione. Tienilo alimentato."

Durante l'OTA l'app fa polling su `GET /vases/:id/firmware` **ogni 3 secondi,
per un massimo di 5 minuti** — stessa filosofia del pairing (vedi §6,
"Verifica pairing = stato reale"): il successo si dichiara solo quando
`versioneCorrente` è diventata quella nuova e il vaso è tornato `connesso`, non
quando il comando MQTT è stato pubblicato.

Alla scadenza dei 5 minuti senza esito: "Non siamo riusciti a confermare
l'aggiornamento. Controlla che il vaso sia acceso e riprova tra qualche minuto"
— senza dichiarare fallimento, perché il vaso potrebbe essere ancora in
riavvio.

#### 16.8.3 Notifica push

Fuori scope di questa versione. Se in futuro si vuole avvisare gli utenti di un
firmware obbligatorio, riusare l'infrastruttura di Fase 8
(`notification.service.ts`) con un nuovo tipo di messaggio e deep link
`/vase/{id}`.

---

### 16.9 Flusso di rilascio (per lo sviluppatore)

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

### 16.10 Ordine di implementazione consigliato

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

