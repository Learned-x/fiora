# Fiora — Manuale di Configurazione Ambienti
**Versione 1.0 — Giugno 2026**
 
---
 
## Introduzione
 
Questo documento descrive come configurare, avviare e mantenere i tre ambienti del progetto Fiora: **development** (locale), **staging** (server personale del team) e **production** (Hetzner Cloud). Ogni sezione include tutti i file di configurazione, i comandi necessari e le spiegazioni di ogni scelta tecnica.
 
### Perché tre ambienti separati
 
- **Development** consente a ogni sviluppatore di lavorare in isolamento senza rischiare di corrompere dati condivisi. Il backend gira fuori da Docker per permettere il hot reload durante lo sviluppo attivo.
- **Staging** replica la produzione il più fedelmente possibile, incluso TLS su MQTT e HTTPS, ma su hardware più piccolo e a costo zero. Ogni push su `develop` aggiorna automaticamente lo staging.
- **Production** è l'unico ambiente che vede dati reali degli utenti. Si aggiorna solo tramite tag di versione espliciti su `main`, mai direttamente.
### Panoramica rapida
 
| Ambiente | Dove gira | Branch | Trigger aggiornamento | Dominio backend |
|---|---|---|---|---|
| development | Macchina locale sviluppatore | `feature/*`, `fix/*` | Manuale | `localhost:3000` |
| staging | Server personale del team | `develop` | Push su `develop` | `api-staging.tangifiori.com` |
| production | Hetzner CX33 + CX23 | `main` | Tag `vX.Y.Z` su `main` | `api.tangifiori.com` |
 
### Struttura del repository
 
Il repository è organizzato in modo che ogni ambiente abbia i propri file di configurazione versionati, ad eccezione dei file `.env` che contengono segreti e **non vanno mai committati**:
 
```
fiora/
├── backend/
│   ├── .env.development.example    ← template sicuro da committare
│   ├── .env.staging.example
│   ├── .env.production.example
│   ├── Dockerfile
│   └── src/
├── mobile/
│   ├── .env.development
│   ├── .env.staging
│   ├── .env.production
│   ├── eas.json                    ← configurazione canali EAS
│   └── app.json
├── mosquitto/
│   └── config/
│       ├── mosquitto.dev.conf      ← no TLS, anonimo
│       └── mosquitto.conf          ← TLS, autenticazione (staging + prod)
├── nginx/
│   └── conf.d/
│       ├── fiora-staging.conf
│       └── fiora.conf              ← configurazione production
├── docker-compose.dev.yml          ← solo infrastruttura locale
├── docker-compose.staging.yml      ← tutto in un file
└── docker-compose.yml              ← server app production
```
 
> ⚠️ Aggiungere al `.gitignore`: `.env`, `.env.development`, `.env.staging`, `.env.production`, `mosquitto/ssl/`, `nginx/ssl/`
 
---
 
## 1. Ambiente Development (Locale)
 
### 1.1 Filosofia
 
In development il backend Node.js gira **direttamente sulla macchina** (non dentro Docker) per due motivi:
1. Il hot reload con `ts-node-dev` ricompila automaticamente a ogni salvataggio, eliminando il ciclo build→restart del container.
2. Il debugger di VS Code può agganciarsi direttamente al processo Node.
Solo i servizi infrastrutturali (PostgreSQL, Redis, MinIO, Mosquitto) girano in Docker, perché sono stateless dal punto di vista dello sviluppo e non richiedono hot reload.
 
### 1.2 Prerequisiti
 
Installare i seguenti strumenti sulla propria macchina prima di procedere:
 
| Software | Versione minima | Come installare |
|---|---|---|
| Docker Desktop | 4.x | https://www.docker.com/products/docker-desktop |
| Node.js | 20 LTS | https://nodejs.org o `nvm install 20` |
| npm | 10+ | Incluso con Node.js |
| Git | 2.x | https://git-scm.com |
| Expo CLI | Latest | `npm install -g expo-cli` |
| EAS CLI | Latest | `npm install -g eas-cli` |
 
Su **macOS** è consigliato usare `nvm` per gestire le versioni di Node:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```
 
### 1.3 File `docker-compose.dev.yml`
 
Questo file avvia solo i quattro servizi infrastrutturali necessari allo sviluppo locale. Tutte le porte sono esposte su `localhost` per permettere al backend di connettersi direttamente.
 
```yaml
version: '3.9'
 
services:
 
  # ─── PostgreSQL con TimescaleDB ──────────────────────────────────────────────
  postgres:
    image: timescale/timescaledb:latest-pg16
    container_name: fiora-postgres-dev
    environment:
      POSTGRES_DB: fiora_dev
      POSTGRES_USER: fiora
      POSTGRES_PASSWORD: fiora_dev_pass
    ports:
      - "5432:5432"       # esposto per Prisma Studio e client SQL locali
    volumes:
      - postgres_dev:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fiora -d fiora_dev"]
      interval: 10s
      timeout: 5s
      retries: 5
 
  # ─── Redis ───────────────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: fiora-redis-dev
    command: redis-server --requirepass dev_pass --loglevel warning
    ports:
      - "6379:6379"
    volumes:
      - redis_dev:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "dev_pass", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
 
  # ─── MinIO (Object Storage per le foto) ──────────────────────────────────────
  minio:
    image: minio/minio
    container_name: fiora-minio-dev
    command: server /data --console-address :9001
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"   # API S3
      - "9001:9001"   # Console web (accessibile su http://localhost:9001)
    volumes:
      - minio_dev:/data
 
  # ─── Mosquitto MQTT Broker ────────────────────────────────────────────────────
  mosquitto:
    image: eclipse-mosquitto:2
    container_name: fiora-mosquitto-dev
    ports:
      - "1883:1883"   # MQTT senza TLS — solo per sviluppo locale
    volumes:
      - ./mosquitto/config/mosquitto.dev.conf:/mosquitto/config/mosquitto.conf
    restart: unless-stopped
 
volumes:
  postgres_dev:
  redis_dev:
  minio_dev:
```
 
> **Superato (decisione 2026-07-24):** in development non si usa il container Mosquitto — il backend si connette a **HiveMQ Cloud** (cluster condiviso dev+staging, TLS 8883 backend / WebSocket 8884 mobile, credenziali in `.env.development`). Il servizio `mosquitto` qui sopra e la sezione 1.4 restano solo come riferimento storico. Mosquitto self-hosted è previsto unicamente in produzione.

### 1.4 Configurazione Mosquitto per development (non usata — vedi nota sopra)
 
In locale si usa MQTT senza TLS sulla porta 1883 e con autenticazione anonima. Questo elimina la necessità di gestire certificati durante lo sviluppo.
 
```conf
# mosquitto/config/mosquitto.dev.conf
listener 1883
protocol mqtt
 
# Nessuna autenticazione in dev — NON usare in staging o produzione
allow_anonymous true
 
# Nessuna persistenza — i messaggi vengono persi al riavvio del container
persistence false
 
# Log su stdout per vedere i messaggi in docker compose logs
log_dest stdout
log_type all
```
 
> ⚠️ Questa configurazione è insicura per design. Non deve mai essere usata fuori dall'ambiente locale.
 
### 1.5 File `backend/.env.development`
 
Copiare da `.env.development.example` e personalizzare dove indicato:
 
```env
# ── Server ────────────────────────────────────────────────────────────────────
NODE_ENV=development
PORT=3000
 
# ── Database ──────────────────────────────────────────────────────────────────
# Punta al container PostgreSQL locale avviato con docker-compose.dev.yml
DATABASE_URL=postgresql://fiora:fiora_dev_pass@localhost:5432/fiora_dev
 
# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=dev_pass
 
# ── JWT ───────────────────────────────────────────────────────────────────────
# Secret solo per sviluppo — non usare in staging/produzione
JWT_SECRET=dev-only-secret-non-sicuro-da-cambiare
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=30
 
# ── MQTT (senza TLS in dev) ───────────────────────────────────────────────────
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=
 
# ── MinIO ─────────────────────────────────────────────────────────────────────
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
# URL pubblico usato per costruire i link alle foto
MINIO_PUBLIC_URL=http://localhost:9000
 
# ── Trefle API ────────────────────────────────────────────────────────────────
TREFLE_API_URL=https://trefle.io/api/v1
TREFLE_API_KEY=                          # ← inserire la propria chiave API
 
# ── Expo Push Notifications ───────────────────────────────────────────────────
# Opzionale in dev — le notifiche push non funzionano su simulatore
EXPO_ACCESS_TOKEN=
 
# ── OAuth ─────────────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=                        # ← inserire le proprie credenziali
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
```
 
### 1.6 File `mobile/.env.development`
 
```env
# L'app mobile (simulatore o dispositivo fisico) non può raggiungere
# "localhost" del computer — bisogna usare l'IP della macchina sulla rete locale.
#
# Come trovare il proprio IP:
#   macOS:   ipconfig getifaddr en0
#   Linux:   hostname -I | awk '{print $1}'
#   Windows: ipconfig | findstr "IPv4"
 
EXPO_PUBLIC_API_URL=http://192.168.1.X:3000
EXPO_PUBLIC_MQTT_URL=mqtt://192.168.1.X:1883
```
 
### 1.7 Configurazione MinIO: creazione bucket
 
Al primo avvio, il bucket `fiora-photos` deve essere creato manualmente:
 
1. Aprire la console MinIO su `http://localhost:9001`
2. Login con `minioadmin` / `minioadmin`
3. Creare un bucket chiamato `fiora-photos`
4. Impostare la policy del bucket su **Public** (per permettere l'accesso diretto alle foto via URL)
In alternativa, via CLI:
```bash
# Installare il client MinIO
brew install minio/stable/mc         # macOS
# oppure: npm install -g minio
 
# Configurare il client
mc alias set local http://localhost:9000 minioadmin minioadmin
 
# Creare il bucket e renderlo pubblico
mc mb local/fiora-photos
mc anonymous set public local/fiora-photos
```
 
### 1.8 Avvio: primo setup
 
Eseguire questi comandi la prima volta dopo aver clonato il repository:
 
```bash
# 1. Clona il repository
git clone https://github.com/tuo-org/fiora.git
cd fiora
 
# 2. Copia e configura i file .env
cp backend/.env.development.example backend/.env.development
# → Aprire backend/.env.development e inserire TREFLE_API_KEY e credenziali OAuth
 
# 3. Avvia i servizi infrastrutturali
docker compose -f docker-compose.dev.yml up -d
 
# 4. Attendi che PostgreSQL sia pronto (circa 10-15 secondi)
docker compose -f docker-compose.dev.yml logs -f postgres
# Attendere il messaggio: "database system is ready to accept connections"
# Premere Ctrl+C per uscire dai log
 
# 5. Installa le dipendenze del backend
cd backend
npm install
 
# 6. Esegui le migrazioni del database
npx prisma migrate dev
# Questo comando crea tutte le tabelle e applica le migrazioni
 
# 7. (Opzionale) Popola il database con dati di test
npx prisma db seed
 
# 8. Avvia il backend in modalità sviluppo
npm run dev
# Il server è ora disponibile su http://localhost:3000
 
# 9. In un secondo terminale, avvia l'app mobile
cd ../mobile
npm install
npx expo start
```
 
### 1.9 Avvio: dal secondo setup in poi
 
```bash
# Avvia infrastruttura (se non già attiva)
docker compose -f docker-compose.dev.yml up -d
 
# Backend
cd backend && npm run dev
 
# Mobile (in un altro terminale)
cd mobile && npx expo start
```
 
### 1.10 Comandi utili in development
 
```bash
# Visualizzare i log di tutti i container
docker compose -f docker-compose.dev.yml logs -f
 
# Log di un singolo servizio
docker compose -f docker-compose.dev.yml logs -f postgres
 
# Aprire una shell interattiva su PostgreSQL
docker exec -it fiora-postgres-dev psql -U fiora -d fiora_dev
 
# Aprire Redis CLI
docker exec -it fiora-redis-dev redis-cli -a dev_pass
 
# Creare una nuova migrazione Prisma dopo aver modificato schema.prisma
cd backend && npx prisma migrate dev --name nome_della_migrazione
 
# Aprire Prisma Studio (UI visuale per il database)
cd backend && npx prisma studio
# Disponibile su http://localhost:5555
 
# Fermare tutti i container (i dati persistono nei volumi Docker)
docker compose -f docker-compose.dev.yml down
 
# Fermare e cancellare tutti i dati (reset completo)
docker compose -f docker-compose.dev.yml down -v
```
 
### 1.11 Troubleshooting frequente
 
**Problema: `Error: connect ECONNREFUSED 127.0.0.1:5432`**
Il container PostgreSQL non è ancora pronto o non è avviato.
```bash
docker compose -f docker-compose.dev.yml up -d postgres
docker compose -f docker-compose.dev.yml logs postgres
```
 
**Problema: L'app mobile non si connette all'API**
Il simulatore non raggiunge `localhost`. Verificare l'IP nella variabile `EXPO_PUBLIC_API_URL` e assicurarsi che corrisponda all'IP attuale della macchina (può cambiare cambiando rete WiFi).
 
**Problema: `prisma migrate dev` fallisce con "migration already applied"`**
```bash
npx prisma migrate reset    # ATTENZIONE: cancella tutti i dati del DB dev
```
 
**Problema: MinIO restituisce 403 sulle foto**
Il bucket non ha la policy pubblica. Rieseguire i comandi della sezione 1.7.
 
---
 
## 2. Ambiente Staging
 
### 2.1 Filosofia
 
Lo staging gira sul server personale del team ed è accessibile pubblicamente tramite HTTPS. Viene aggiornato automaticamente ad ogni push su `develop`. A differenza del development:
 
- **MQTT usa TLS** sulla porta 8883 con certificato reale
- **HTTPS** con certificato Let's Encrypt
- **Tutti i servizi girano in Docker**, incluso il backend (nessun hot reload)
- **Database separato** (`fiora_staging`) — mai condiviso con produzione
- **JWT secret diverso** da produzione — un token staging non è valido in produzione
### 2.2 Prerequisiti sul server staging
 
```bash
# Aggiornare il sistema
sudo apt update && sudo apt upgrade -y
 
# Installare Docker Engine
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Effettuare logout e login per applicare le modifiche al gruppo
 
# Verificare l'installazione
docker --version
docker compose version
 
# Installare Certbot per i certificati SSL
sudo apt install -y certbot python3-certbot-dns-cloudflare
 
# Installare Git
sudo apt install -y git
```
 
### 2.3 Configurazione DNS
 
Su Cloudflare, creare i seguenti record A:
 
| Tipo | Nome | Valore | Proxy |
|---|---|---|---|
| A | `api-staging` | `<IP del server staging>` | ✅ Proxied |
| A | `storage-staging` | `<IP del server staging>` | ✅ Proxied |
 
> ℹ️ Con Cloudflare in modalità proxy (arancione), il traffico passa attraverso Cloudflare che gestisce il caching e la protezione DDoS. Per MQTT (porta 8883), il traffico **non passa per Cloudflare** e va direttamente all'IP del server.
 
### 2.4 Struttura directory sul server
 
```bash
# Creare la struttura delle directory
sudo mkdir -p /opt/fiora-staging/{nginx/conf.d,nginx/ssl,mosquitto/config,mosquitto/ssl,mosquitto/data,mosquitto/log}
sudo chown -R $USER:$USER /opt/fiora-staging
 
# Clonare il repository
cd /opt/fiora-staging
git clone https://github.com/tuo-org/fiora.git .
```
 
### 2.5 Certificati SSL per Nginx (HTTPS)
 
```bash
# Creare il file di credenziali Cloudflare per il DNS challenge
mkdir -p ~/.cloudflare
cat > ~/.cloudflare/credentials.ini << 'EOF'
dns_cloudflare_api_token = IL_TUO_CLOUDFLARE_API_TOKEN
EOF
chmod 600 ~/.cloudflare/credentials.ini
 
# Ottenere il certificato con DNS challenge
# (funziona anche se il server è dietro firewall)
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials ~/.cloudflare/credentials.ini \
  -d api-staging.tangifiori.com \
  -d storage-staging.tangifiori.com \
  --email tuo@email.com \
  --agree-tos \
  --non-interactive
 
# Copiare i certificati nella directory Nginx
sudo cp /etc/letsencrypt/live/api-staging.tangifiori.com/fullchain.pem /opt/fiora-staging/nginx/ssl/
sudo cp /etc/letsencrypt/live/api-staging.tangifiori.com/privkey.pem /opt/fiora-staging/nginx/ssl/
sudo chown $USER:$USER /opt/fiora-staging/nginx/ssl/*.pem
 
# Configurare il rinnovo automatico (Let's Encrypt scade ogni 90 giorni)
echo "0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/api-staging.tangifiori.com/fullchain.pem /opt/fiora-staging/nginx/ssl/ && cp /etc/letsencrypt/live/api-staging.tangifiori.com/privkey.pem /opt/fiora-staging/nginx/ssl/ && docker compose -f /opt/fiora-staging/docker-compose.staging.yml restart nginx" | crontab -
```
 
> **Superato per staging (decisione 2026-07-24):** lo staging usa **HiveMQ Cloud** (stesso cluster di development), quindi niente container Mosquitto, certificati CA o file passwd sul server staging — `docker-compose.staging.yml` reale non include Mosquitto e `.env.staging` punta a HiveMQ. Le sezioni 2.6–2.7 valgono solo come procedura per la **produzione** (Mosquitto self-hosted, CA embeddata nel firmware ESP32).

### 2.6 Certificati TLS per Mosquitto MQTT (solo produzione)
 
Mosquitto richiede una propria CA (Certificate Authority) indipendente da quella di Nginx. Il certificato CA generato qui dovrà essere **embeddato nel firmware ESP32** del vaso smart.
 
```bash
cd /opt/fiora-staging/mosquitto/ssl
 
# 1. Generare la CA (Certificate Authority) privata
openssl genrsa -out ca.key 4096
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt \
  -subj "/C=IT/ST=Liguria/O=Fiora/CN=Fiora MQTT CA Staging"
 
# 2. Generare la chiave e il certificato del server Mosquitto
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr \
  -subj "/C=IT/ST=Liguria/O=Fiora/CN=api-staging.tangifiori.com"
openssl x509 -req -in server.csr \
  -CA ca.crt -CAkey ca.key -CAcreateserial \
  -days 3650 -out server.crt
 
# 3. Impostare i permessi corretti (Mosquitto li richiede)
chmod 644 ca.crt server.crt
chmod 600 server.key ca.key
 
# Il file ca.crt va consegnato al team hardware per essere embeddato nel firmware
echo "IMPORTANTE: copiare ca.crt e consegnarlo al team hardware per il firmware ESP32"
```
 
### 2.7 Configurazione Mosquitto (solo produzione)
 
```conf
# mosquitto/config/mosquitto.conf
# Solo produzione — staging usa HiveMQ Cloud (decisione 2026-07-24)
 
# Porta MQTT con TLS obbligatorio
listener 8883
protocol mqtt
 
# Certificati TLS
cafile /mosquitto/ssl/ca.crt
certfile /mosquitto/ssl/server.crt
keyfile /mosquitto/ssl/server.key
require_certificate false          # il client non deve presentare un certificato
tls_version tlsv1.2
 
# Autenticazione obbligatoria
allow_anonymous false
password_file /mosquitto/config/passwd
 
# Persistenza messaggi su disco
persistence true
persistence_location /mosquitto/data/
 
# Log su file
log_dest file /mosquitto/log/mosquitto.log
log_type error
log_type warning
log_type notice
log_type information
```
 
Creare il file password di Mosquitto:
```bash
# Creare l'utente per il backend
docker run --rm -it eclipse-mosquitto:2 \
  mosquitto_passwd -c /tmp/passwd fiora-backend
# → Inserire la password quando richiesto
 
# Il file passwd viene generato — copiarlo nella directory config
cp /tmp/passwd /opt/fiora-staging/mosquitto/config/passwd
chmod 600 /opt/fiora-staging/mosquitto/config/passwd
```
 
### 2.8 File `docker-compose.staging.yml`
 
In staging tutti i servizi girano nello stesso Docker Compose su un'unica macchina. PostgreSQL, Redis e MinIO espongono le porte **solo su localhost** (non su interfacce pubbliche).
 
```yaml
version: '3.9'
 
services:
 
  # ─── Nginx (reverse proxy + SSL termination) ──────────────────────────────
  nginx:
    image: nginx:alpine
    container_name: fiora-nginx-staging
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
    restart: unless-stopped
 
  # ─── Backend Node.js/Express ───────────────────────────────────────────────
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: fiora-api-staging
    env_file: .env.staging
    environment:
      - NODE_ENV=staging
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      mosquitto:
        condition: service_started
      minio:
        condition: service_started
    restart: unless-stopped
 
  # ─── Mosquitto MQTT Broker ──────────────────────────────────────────────────
  mosquitto:
    image: eclipse-mosquitto:2
    container_name: fiora-mosquitto-staging
    ports:
      - "8883:8883"    # esposto pubblicamente per i vasi smart e l'app mobile
    volumes:
      - ./mosquitto/config:/mosquitto/config:ro
      - ./mosquitto/ssl:/mosquitto/ssl:ro
      - ./mosquitto/data:/mosquitto/data
      - ./mosquitto/log:/mosquitto/log
    restart: unless-stopped
 
  # ─── PostgreSQL con TimescaleDB ─────────────────────────────────────────────
  postgres:
    image: timescale/timescaledb:latest-pg16
    container_name: fiora-postgres-staging
    environment:
      POSTGRES_DB: fiora_staging
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "127.0.0.1:5432:5432"    # solo localhost — non esposto pubblicamente
    volumes:
      - postgres_staging:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d fiora_staging"]
      interval: 10s
      timeout: 5s
      retries: 5
 
  # ─── Redis ──────────────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: fiora-redis-staging
    command: redis-server --requirepass ${REDIS_PASSWORD} --loglevel warning
    ports:
      - "127.0.0.1:6379:6379"    # solo localhost
    volumes:
      - redis_staging:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
 
  # ─── MinIO (Object Storage) ─────────────────────────────────────────────────
  minio:
    image: minio/minio
    container_name: fiora-minio-staging
    command: server /data --console-address :9001
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    ports:
      - "127.0.0.1:9000:9000"    # solo localhost
      - "127.0.0.1:9001:9001"    # console — accessibile solo tramite SSH tunnel
    volumes:
      - minio_staging:/data
    restart: unless-stopped
 
volumes:
  postgres_staging:
  redis_staging:
  minio_staging:
```
 
### 2.9 File `.env.staging`
 
```env
# ── Server ────────────────────────────────────────────────────────────────────
NODE_ENV=staging
PORT=3000
 
# ── Database ──────────────────────────────────────────────────────────────────
# "postgres" è il nome del servizio nel docker-compose.staging.yml
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/fiora_staging
DB_USER=fiora_staging
DB_PASSWORD=GENERARE_CON: openssl rand -base64 32
 
# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=GENERARE_CON: openssl rand -base64 32
 
# ── JWT ───────────────────────────────────────────────────────────────────────
# DEVE essere diverso dal JWT_SECRET di produzione
JWT_SECRET=GENERARE_CON: openssl rand -base64 64
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=30
 
# ── MQTT ──────────────────────────────────────────────────────────────────────
# "mosquitto" è il nome del servizio nel docker-compose
MQTT_BROKER_URL=mqtts://mosquitto:8883
MQTT_USERNAME=fiora-backend
MQTT_PASSWORD=PASSWORD_IMPOSTATA_IN_MOSQUITTO_PASSWD
 
# ── MinIO ─────────────────────────────────────────────────────────────────────
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false          # connessione interna al container, no SSL necessario
MINIO_ACCESS_KEY=GENERARE_CON: openssl rand -hex 16
MINIO_SECRET_KEY=GENERARE_CON: openssl rand -base64 32
MINIO_PUBLIC_URL=https://storage-staging.tangifiori.com
 
# ── Trefle API ────────────────────────────────────────────────────────────────
TREFLE_API_URL=https://trefle.io/api/v1
TREFLE_API_KEY=your-trefle-key
 
# ── Expo Push Notifications ───────────────────────────────────────────────────
EXPO_ACCESS_TOKEN=your-expo-token
 
# ── OAuth ─────────────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=your-google-client-id
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_PRIVATE_KEY=your-apple-private-key
```
 
### 2.10 Configurazione Nginx per staging
 
```nginx
# nginx/conf.d/fiora-staging.conf
 
# ── HTTPS API ─────────────────────────────────────────────────────────────────
server {
    listen 443 ssl;
    server_name api-staging.tangifiori.com;
 
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
 
    # Passa le richieste al container "api" sulla porta 3000
    location / {
        proxy_pass http://api:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
 
        # Timeout generosi per le operazioni lunghe (upload foto, sync)
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }
}
 
# ── Redirect HTTP → HTTPS ─────────────────────────────────────────────────────
server {
    listen 80;
    server_name api-staging.tangifiori.com storage-staging.tangifiori.com;
    return 301 https://$host$request_uri;
}
 
# ── MinIO Storage (foto pubbliche) ────────────────────────────────────────────
server {
    listen 443 ssl;
    server_name storage-staging.tangifiori.com;
 
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
 
    location / {
        proxy_pass http://minio:9000;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        # Header necessari per MinIO
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
 
### 2.11 Primo avvio su staging
 
```bash
cd /opt/fiora-staging
 
# 1. Creare il file .env.staging con tutti i segreti
cp backend/.env.staging.example .env.staging
# → Editare .env.staging con i valori reali
 
# 2. Avviare tutti i servizi
docker compose -f docker-compose.staging.yml up -d
 
# 3. Attendere che PostgreSQL sia pronto
docker compose -f docker-compose.staging.yml logs -f postgres
# Attendere "database system is ready to accept connections"
 
# 4. Eseguire le migrazioni del database
docker compose -f docker-compose.staging.yml exec api npx prisma migrate deploy
 
# 5. Creare il bucket MinIO
docker compose -f docker-compose.staging.yml exec minio \
  mc mb /data/fiora-photos
# In alternativa, aprire la console via SSH tunnel:
# ssh -L 9001:localhost:9001 user@staging-server
# poi aprire http://localhost:9001
 
# 6. Smoke test
curl -s https://api-staging.tangifiori.com/health
# Risposta attesa: {"status":"ok","version":"x.x.x"}
```
 
### 2.12 Procedura di deploy aggiornamento
 
Ogni push su `develop` dovrebbe triggerare questo script (configurabile con GitHub Actions o simile):
 
```bash
#!/bin/bash
# deploy-staging.sh
set -e
 
cd /opt/fiora-staging
 
echo "→ Pull codice aggiornato"
git pull origin develop
 
echo "→ Build nuova immagine API"
docker compose -f docker-compose.staging.yml build api
 
echo "→ Applicare migrazioni DB"
# Le migrazioni vanno PRIMA del riavvio dell'API
docker compose -f docker-compose.staging.yml run --rm api npx prisma migrate deploy
 
echo "→ Riavvio API (zero-downtime)"
docker compose -f docker-compose.staging.yml up -d --no-deps api
 
echo "→ Smoke test"
sleep 5
curl -sf https://api-staging.tangifiori.com/health || (echo "SMOKE TEST FALLITO" && exit 1)
 
echo "✓ Deploy staging completato"
```
 
### 2.13 Mobile app su staging
 
```env
# mobile/.env.staging
EXPO_PUBLIC_API_URL=https://api-staging.tangifiori.com
EXPO_PUBLIC_MQTT_URL=mqtts://api-staging.tangifiori.com:8883
```
 
Per aggiornare l'app mobile su staging tramite OTA (senza build nativa):
```bash
cd mobile
eas update --channel staging --message "Descrizione dell'aggiornamento"
```
 
Per una build nativa completa su staging:
```bash
eas build --platform all --profile staging
```
 
---
 
## 3. Ambiente Production
 
### 3.1 Filosofia
 
La produzione usa due server Hetzner separati collegati tramite rete privata. Questa separazione serve a:
 
1. **Isolamento dei carichi**: il server app gestisce traffico HTTP e MQTT; il server DB gestisce solo I/O su disco.
2. **Sicurezza**: PostgreSQL, Redis e MinIO non espongono porte su internet — sono accessibili solo sulla rete privata Hetzner.
3. **Scalabilità futura**: i due server possono essere scalati indipendentemente.
### 3.2 Infrastruttura Hetzner
 
| Server | Modello Hetzner | Ruolo | Servizi |
|---|---|---|---|
| Server App | CX33 (4 vCPU, 8 GB RAM) | Traffico pubblico | Nginx, Node.js API, Mosquitto |
| Server DB | CX23 (2 vCPU, 4 GB RAM) | Storage | PostgreSQL+TimescaleDB, Redis, MinIO |
 
**Configurazione rete privata Hetzner:**
- Creare una rete privata su Hetzner Cloud con range `10.0.0.0/24`
- Server App: IP privato `10.0.0.2`
- Server DB: IP privato `10.0.0.3`
- I due server comunicano su questa rete senza esporre porte su internet
### 3.3 Setup iniziale entrambi i server
 
```bash
# Su entrambi i server: aggiornamento e hardening base
sudo apt update && sudo apt upgrade -y
 
# Installare Docker Engine
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
 
# Configurare il firewall UFW — Server App
sudo ufw allow 22/tcp       # SSH
sudo ufw allow 80/tcp       # HTTP (redirect a HTTPS)
sudo ufw allow 443/tcp      # HTTPS
sudo ufw allow 8883/tcp     # MQTT TLS
sudo ufw enable
 
# Configurare il firewall UFW — Server DB
sudo ufw allow 22/tcp       # SSH
# Solo traffico dalla rete privata Hetzner
sudo ufw allow from 10.0.0.0/24 to any port 5432   # PostgreSQL
sudo ufw allow from 10.0.0.0/24 to any port 6379   # Redis
sudo ufw allow from 10.0.0.0/24 to any port 9000   # MinIO
sudo ufw enable
```
 
### 3.4 `docker-compose.yml` — Server App (Production)
 
```yaml
version: '3.9'
 
services:
 
  # ─── Nginx ────────────────────────────────────────────────────────────────
  nginx:
    image: nginx:alpine
    container_name: fiora-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
    restart: unless-stopped
 
  # ─── Backend ──────────────────────────────────────────────────────────────
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: fiora-api
    env_file: .env.production
    environment:
      - NODE_ENV=production
    depends_on:
      - mosquitto
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"
 
  # ─── Mosquitto ────────────────────────────────────────────────────────────
  mosquitto:
    image: eclipse-mosquitto:2
    container_name: fiora-mosquitto
    ports:
      - "8883:8883"
    volumes:
      - ./mosquitto/config:/mosquitto/config:ro
      - ./mosquitto/ssl:/mosquitto/ssl:ro
      - mosquitto_data:/mosquitto/data
      - mosquitto_log:/mosquitto/log
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "3"
 
volumes:
  mosquitto_data:
  mosquitto_log:
```
 
### 3.5 `docker-compose.yml` — Server DB (Production)
 
```yaml
version: '3.9'
 
services:
 
  # ─── PostgreSQL con TimescaleDB ───────────────────────────────────────────
  postgres:
    image: timescale/timescaledb:latest-pg16
    container_name: fiora-postgres
    environment:
      POSTGRES_DB: fiora
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      # Esposto SOLO sull'interfaccia della rete privata Hetzner
      # Sostituire 10.0.0.3 con l'IP privato del Server DB
      - "10.0.0.3:5432:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d fiora"]
      interval: 30s
      timeout: 10s
      retries: 3
 
  # ─── Redis ────────────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: fiora-redis
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
      --loglevel warning
    volumes:
      - redis_data:/data
    ports:
      - "10.0.0.3:6379:6379"
    restart: unless-stopped
 
  # ─── MinIO ────────────────────────────────────────────────────────────────
  minio:
    image: minio/minio
    container_name: fiora-minio
    command: server /data --console-address :9001
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    ports:
      - "10.0.0.3:9000:9000"
      - "10.0.0.3:9001:9001"
    restart: unless-stopped
 
volumes:
  postgres_data:
  redis_data:
  minio_data:
```
 
### 3.6 File `.env.production` — Server App
 
```env
# ── Server ────────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3000
 
# ── Database ──────────────────────────────────────────────────────────────────
# 10.0.0.3 = IP privato Hetzner del Server DB
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@10.0.0.3:5432/fiora
DB_USER=fiora_prod
DB_PASSWORD=GENERARE_CON: openssl rand -base64 32
 
# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_HOST=10.0.0.3
REDIS_PORT=6379
REDIS_PASSWORD=GENERARE_CON: openssl rand -base64 32
 
# ── JWT ───────────────────────────────────────────────────────────────────────
JWT_SECRET=GENERARE_CON: openssl rand -base64 64
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=30
 
# ── MQTT ──────────────────────────────────────────────────────────────────────
# "localhost" perché Mosquitto gira nello stesso docker-compose del Server App
MQTT_BROKER_URL=mqtts://mosquitto:8883
MQTT_USERNAME=fiora-backend
MQTT_PASSWORD=PASSWORD_DA_MOSQUITTO_PASSWD
 
# ── MinIO ─────────────────────────────────────────────────────────────────────
MINIO_ENDPOINT=10.0.0.3
MINIO_PORT=9000
MINIO_USE_SSL=false          # connessione su rete privata Hetzner, no SSL
MINIO_ACCESS_KEY=GENERARE_CON: openssl rand -hex 16
MINIO_SECRET_KEY=GENERARE_CON: openssl rand -base64 32
MINIO_PUBLIC_URL=https://storage.tangifiori.com
 
# ── Trefle API ────────────────────────────────────────────────────────────────
TREFLE_API_URL=https://trefle.io/api/v1
TREFLE_API_KEY=your-trefle-key
 
# ── Expo Push Notifications ───────────────────────────────────────────────────
EXPO_ACCESS_TOKEN=your-expo-token
 
# ── OAuth ─────────────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=your-google-client-id
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```
 
### 3.7 Configurazione Nginx per production
 
```nginx
# nginx/conf.d/fiora.conf
 
# ── HTTPS API ─────────────────────────────────────────────────────────────────
server {
    listen 443 ssl;
    server_name api.tangifiori.com;
 
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
 
    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
 
    location / {
        proxy_pass http://api:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
 
        # Limite upload per le foto
        client_max_body_size 10m;
    }
}
 
# ── Redirect HTTP → HTTPS ─────────────────────────────────────────────────────
server {
    listen 80;
    server_name api.tangifiori.com storage.tangifiori.com;
    return 301 https://$host$request_uri;
}
 
# ── MinIO Storage (foto pubbliche) ────────────────────────────────────────────
server {
    listen 443 ssl;
    server_name storage.tangifiori.com;
 
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
 
    location / {
        proxy_pass http://10.0.0.3:9000;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
 
        # Cache per le immagini
        proxy_cache_valid 200 1d;
        add_header Cache-Control "public, max-age=86400";
    }
}
```
 
### 3.8 Procedura di deploy in produzione
 
Il deploy in produzione avviene **sempre** tramite un tag di versione su `main`. Non si eseguono mai deploy diretti su `main` senza tag.
 
```bash
# ── Step 1: Preparare la release (in locale) ──────────────────────────────────
 
# Assicurarsi di essere su main con tutto aggiornato
git checkout main
git merge release/v1.4.0   # merge dal branch di release
git tag v1.4.0
git push origin main --tags
 
# Aggiornare i numeri di versione in app.json (mobile)
# "version": "1.4.0"
# "ios": { "buildNumber": "14" }
# "android": { "versionCode": 14 }
 
# ── Step 2: Deploy sul Server DB ──────────────────────────────────────────────
# (solo se ci sono modifiche ai volumi o alla configurazione DB)
# Di norma il Server DB non richiede azioni a ogni release
 
ssh user@server-db
cd /opt/fiora-db
# Nessuna azione richiesta per release standard
 
# ── Step 3: Deploy sul Server App ─────────────────────────────────────────────
ssh user@server-app
cd /opt/fiora
 
# Pull del tag specifico
git fetch --tags
git checkout v1.4.0
 
# CRITICO: migrazioni PRIMA del riavvio dell'API
# Se la migrazione fallisce, l'API vecchia continua a girare senza interruzioni
docker compose run --rm api npx prisma migrate deploy
 
# Build della nuova immagine
docker compose build api
 
# Riavvio dell'API senza downtime
# --no-deps evita di riavviare anche Nginx e Mosquitto
docker compose up -d --no-deps api
 
# Smoke test
sleep 5
curl -sf https://api.tangifiori.com/health
echo "Deploy v1.4.0 completato"
 
# ── Step 4: Deploy mobile ─────────────────────────────────────────────────────
# Da locale — OTA update per modifiche JS-only (non tocca codice nativo)
cd mobile
eas update --channel production --message "Release v1.4.0"
 
# Per una build nativa completa (necessaria se si modifica Expo SDK, dipendenze native, app.json)
eas build --platform all --profile production
# → Dopo la build, inviare agli store tramite eas submit
eas submit --platform ios
eas submit --platform android
```
 
### 3.9 Procedura di rollback
 
```bash
# ── Rollback backend ──────────────────────────────────────────────────────────
ssh user@server-app
cd /opt/fiora
 
# Tornare al tag precedente
git checkout v1.3.2
 
# Build e riavvio
docker compose build api
docker compose up -d --no-deps api
 
# Verifica
curl -sf https://api.tangifiori.com/health
 
# ── Rollback migrazione DB (SOLO se la migrazione ha modificato struttura) ────
# ATTENZIONE: operazione distruttiva — eseguire solo dopo backup
docker compose run --rm api npx prisma migrate resolve --rolled-back <nome_migrazione>
# Il nome della migrazione si trova in prisma/migrations/
 
# ── Rollback mobile (OTA) ─────────────────────────────────────────────────────
# Da locale — forzare il canale production a puntare alla versione precedente
eas update --channel production --message "Rollback a v1.3.2" --branch v1.3.2
```
 
### 3.10 Backup database
 
```bash
# Backup manuale (da eseguire PRIMA di ogni deploy con migrazioni)
ssh user@server-db
 
docker exec fiora-postgres pg_dump \
  -U fiora_prod \
  -d fiora \
  -F c \
  -f /tmp/fiora_backup_$(date +%Y%m%d_%H%M%S).dump
 
# Copiare il backup fuori dal server
scp user@server-db:/tmp/fiora_backup_*.dump ./backups/
 
# Backup automatico giornaliero (aggiungere al crontab del Server DB)
echo "0 2 * * * docker exec fiora-postgres pg_dump -U fiora_prod -d fiora -F c -f /tmp/fiora_backup_\$(date +\%Y\%m\%d).dump && find /tmp -name 'fiora_backup_*.dump' -mtime +7 -delete" | crontab -
```
 
---
 
## 4. Configurazione EAS per il Mobile
 
### 4.1 File `eas.json`
 
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "http://localhost:3000",
        "EXPO_PUBLIC_MQTT_URL": "mqtt://localhost:1883"
      }
    },
    "staging": {
      "distribution": "internal",
      "channel": "staging",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api-staging.tangifiori.com",
        "EXPO_PUBLIC_MQTT_URL": "mqtts://api-staging.tangifiori.com:8883"
      }
    },
    "production": {
      "distribution": "store",
      "channel": "production",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.tangifiori.com",
        "EXPO_PUBLIC_MQTT_URL": "mqtts://api.tangifiori.com:8883"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "tuo@email.com",
        "ascAppId": "ID_APP_SU_APP_STORE_CONNECT",
        "appleTeamId": "IL_TUO_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "production"
      }
    }
  }
}
```
 
### 4.2 Aggiornamento versione mobile
 
Prima di ogni release, aggiornare `mobile/app.json`:
 
```json
{
  "expo": {
    "name": "Fiora",
    "slug": "fiora",
    "version": "1.4.0",
    "ios": {
      "bundleIdentifier": "com.tangifiori.app",
      "buildNumber": "14"
    },
    "android": {
      "package": "com.tangifiori.app",
      "versionCode": 14
    }
  }
}
```
 
> ℹ️ `buildNumber` e `versionCode` devono essere incrementati ad ogni build inviata agli store, anche per hotfix. Non possono mai essere decrementati.
 
---
 
## 5. Riepilogo differenze tra ambienti
 
| Parametro | Development | Staging | Production |
|---|---|---|---|
| `NODE_ENV` | `development` | `staging` | `production` |
| MQTT protocollo | `mqtt://` (no TLS) | `mqtts://` (TLS) | `mqtts://` (TLS) |
| MQTT porta | 1883 | 8883 | 8883 |
| MQTT autenticazione | Anonima | Username/password | Username/password |
| Database host | `localhost` | `postgres` (container) | `10.0.0.3` (rete privata) |
| Database nome | `fiora_dev` | `fiora_staging` | `fiora` |
| MinIO URL pubblico | `http://localhost:9000` | `https://storage-staging.tangifiori.com` | `https://storage.tangifiori.com` |
| Log level | `debug` | `info` | `info` |
| Hot reload backend | ✅ Sì (`ts-node-dev`) | ❌ No | ❌ No |
| SSL/HTTPS | ❌ No | ✅ Sì | ✅ Sì |
| JWT secret | Fisso (non sicuro) | Random, diverso da prod | Random, diverso da staging |
| Expo canale OTA | — | `staging` | `production` |
| Trigger aggiornamento | Manuale | Push su `develop` | Tag `vX.Y.Z` su `main` |