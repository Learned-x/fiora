# 🌿 Fiora — Specifiche tecniche per lo sviluppo

**Versione 1.4 · Fase 1 · Software + Hardware · Mobile**

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
| MQTT broker | Mosquitto 2.x | Self-hosted su Docker |
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

### Configurazione Mosquitto

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
CREATE UNIQUE INDEX idx_species_trefle ON species(nome_scientifico) WHERE fonte = 'trefle';
```

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
DELETE /auth/account           Richiesta eliminazione account (avvia periodo di grazia)
```

#### Piante

```
GET    /plants                 Lista piante attive dell'utente
POST   /plants                 Crea nuova pianta o bouquet
GET    /plants/:id             Dettaglio pianta
PATCH  /plants/:id             Modifica pianta
DELETE /plants/:id             Eliminazione definitiva (con conferma)
PATCH  /plants/:id/archive     Archivia pianta
PATCH  /plants/:id/restore     Ripristina dall'archivio
GET    /plants/archived        Lista piante archiviate
```

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
POST   /vases/pair             Avvia pairing nuovo vaso (genera token)
GET    /vases/:id              Stato e dati vaso
PATCH  /vases/:id              Modifica nome vaso
DELETE /vases/:id              Rimuovi vaso
GET    /vases/:id/readings     Storico dati sensori (con range temporale)
```

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

- **ESP-IDF WiFi Provisioning** per la configurazione WiFi iniziale via BLE
- **PubSubClient** o **AsyncMqttClient** per la connessione MQTT su TLS
- Certificato CA Mosquitto embeddato nel firmware per la verifica TLS

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

### Flusso di provisioning WiFi (BLE — prima configurazione)

Il primo avvio del vaso richiede la configurazione delle credenziali WiFi tramite Bluetooth Low Energy, usando il protocollo ESP-IDF WiFi Provisioning.

```
PRIMO AVVIO — flusso completo

1. L'utente accende il vaso per la prima volta.
2. L'ESP32 si avvia in modalità BLE advertising con nome
   "Fiora-XXXX" (ultime 4 cifre del MAC address).
3. L'app (tramite react-native-ble-plx) scansiona i
   dispositivi BLE nelle vicinanze e mostra quelli con
   prefisso "Fiora-".
4. L'utente seleziona il proprio vaso nell'app.
5. L'app invia via BLE:
     - SSID della rete WiFi dell'utente
     - Password WiFi
     - device_id generato dal backend (vedi sotto)
     - MQTT credentials (username + password)
     - Broker URL e porta
6. L'ESP32 salva le credenziali in NVS (flash non volatile)
   e tenta la connessione WiFi.
7. Se la connessione WiFi riesce, l'ESP32 si connette a
   Mosquitto e pubblica il primo messaggio su:
     fiora/vaso/{device_id}/status → { "status": "online" }
8. Il backend riceve il messaggio, conferma il pairing
   e associa il vaso all'account utente.
9. L'app riceve conferma via polling su GET /vases/{id}
   e mostra il vaso come connesso.
```

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

### Riconfigurazione WiFi (rete cambiata)

Se l'utente cambia rete WiFi, il vaso deve essere riconfigurato. Il flusso è identico al primo avvio: tenere premuto il pulsante di reset sul vaso per 5 secondi per riportarlo in modalità BLE advertising. Le credenziali MQTT rimangono invariate — solo il WiFi viene riconfigurato.

### Lato app mobile — flusso BLE provisioning

```typescript
// app/vase/pair.tsx (flusso semplificato)
import { BleManager } from 'react-native-ble-plx';

const manager = new BleManager();

async function startProvisioning() {
  // 1. Chiedi credenziali pairing al backend
  const { device_id, mqtt_username, mqtt_password, broker_url } =
    await api.post('/vases/pair');

  // 2. Scansiona dispositivi BLE con prefisso "Fiora-"
  manager.startDeviceScan(null, null, async (error, device) => {
    if (device?.name?.startsWith('Fiora-')) {
      manager.stopDeviceScan();

      // 3. Connetti e invia credenziali via BLE
      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();

      const payload = JSON.stringify({
        ssid: wifiSSID,
        password: wifiPassword,
        device_id,
        mqtt_username,
        mqtt_password,
        broker_url: 'api.tangifiori.com',
        broker_port: 8883,
      });

      // Scrivi sulla caratteristica di provisioning ESP-IDF
      await connected.writeCharacteristicWithResponseForService(
        ESP_PROV_SERVICE_UUID,
        ESP_PROV_CHAR_UUID,
        btoa(payload)
      );

      // 4. Polling per conferma pairing completato
      await pollVaseStatus(device_id);
    }
  });
}
```

### Gestione disconnessioni post-pairing

Dopo il pairing, se il vaso si disconnette da MQTT, Mosquitto invia automaticamente il Last Will Message. Il backend:

1. Segna `smart_vases.stato = 'disconnesso'`
2. Mette in coda una notifica push all'utente
3. Passa ai reminder calendar-based per quella pianta
4. Quando il vaso torna online, ripristina automaticamente i reminder da sensore

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

### Flusso ricerca specie

```typescript
// src/services/species.service.ts

async function searchSpecies(query: string, userId: string) {
  // 1. Cerca nel catalogo curato (livello 1) — sempre offline
  const curated = await prisma.species.findMany({
    where: {
      OR: [
        { nome_comune: { contains: query, mode: 'insensitive' } },
        { nome_scientifico: { contains: query, mode: 'insensitive' } },
      ],
      fonte: 'curato',
      stato: 'attivo',
    },
    take: 10,
  });

  if (curated.length >= 5) return curated;

  // 2. Fallback su Trefle API (livello 2) — solo se risultati insufficienti
  const cached = await redis.get(`trefle:${query}`);
  if (cached) return [...curated, ...JSON.parse(cached)];

  try {
    const trefleResults = await fetchFromTrefle(query);
    const mapped = trefleResults.map(mapTrefleToInternal);
    await redis.setex(`trefle:${query}`, 86400, JSON.stringify(mapped)); // cache 24h
    return [...curated, ...mapped];
  } catch {
    // 3. Trefle non disponibile: restituisce solo risultati curati
    return curated;
  }
}
```

### Mappatura dati Trefle → schema interno

```typescript
function mapTrefleToInternal(trefleSpecies: TrefleSpecies): Species {
  return {
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

## Note per il partner hardware (vaso smart)

### Hardware di riferimento

- **MCU**: ESP32 (dual-core, WiFi + BLE integrati)
- **Sensori**: umidità suolo, luce ambientale (lux), temperatura
- **Alimentazione**: batteria con segnalazione livello

### Requisiti firmware

**1. WiFi Provisioning via BLE (primo avvio)**

Implementare il protocollo **ESP-IDF WiFi Provisioning** in modalità BLE. Al primo avvio (o dopo reset a lungo), il dispositivo si avvia in modalità BLE advertising con nome `Fiora-{ultimi4MAC}`.

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

Tenere premuto il pulsante fisico per 5 secondi cancella le credenziali WiFi da NVS e riavvia in modalità BLE provisioning. Le credenziali MQTT rimangono invariate.

---

Il backend Fiora non gestisce firmware né OTA update — questi restano responsabilità del partner esterno.
