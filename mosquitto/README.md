# Mosquitto (staging)

Broker MQTT self-hosted per staging. Config in `config/`, certificati TLS in `ssl/`
(entrambi montati read-only nel container da `docker-compose.staging.yml`).

## Sicurezza attiva

- `allow_anonymous false` + `config/passwd` (utente condiviso `fiora-vaso`).
- `config/acl`: l'utente può solo `readwrite fiora/vaso/#`.
- Listener `1883` **non pubblicato** (solo il backend, sulla rete Docker).
- Listener `8883` **TLS**, pubblico, per i vasi ESP32.

## File non versionati

- `config/passwd` — hash della credenziale MQTT (gitignored).
- `ssl/` — CA e certificato server (gitignored). `ssl/ca.key` è la chiave privata
  della CA: **custodirla**, serve per rigenerare il certificato server.

## Generare `config/passwd` (primo setup)

```bash
docker compose -f docker-compose.staging.yml up -d mosquitto
docker exec -it fiora-mosquitto-staging \
  mosquitto_passwd -b -c /mosquitto/config/passwd fiora-vaso 'PASSWORD_SCELTA'
sudo chown 1883:1883 mosquitto/config/passwd && sudo chmod 600 mosquitto/config/passwd
docker compose -f docker-compose.staging.yml restart mosquitto
```

Poi in `backend/.env.staging`: `MQTT_USERNAME=fiora-vaso`, `MQTT_PASSWORD=PASSWORD_SCELTA`,
`MQTT_PUBLIC_URL=mqtts://<IP_PUBBLICO>:8883`.

## Generare i certificati TLS (primo setup)

```bash
mkdir -p mosquitto/ssl && cd mosquitto/ssl
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 \
  -subj "/O=Fiora/CN=Fiora Staging Root CA" -out ca.crt

cat > server.ext <<'EOF'
subjectAltName = IP:<IP_PUBBLICO>, IP:127.0.0.1, DNS:mosquitto, DNS:localhost
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
EOF
openssl genrsa -out server.key 2048
openssl req -new -key server.key -subj "/O=Fiora/CN=fiora-mosquitto-staging" -out server.csr
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days 3650 -sha256 -extfile server.ext
rm -f server.csr server.ext ca.srl
cd ../.. && sudo chown -R 1883:1883 mosquitto/ssl
sudo chmod 644 mosquitto/ssl/*.crt && sudo chmod 600 mosquitto/ssl/*.key
```

`ca.crt` va incollata nella stringa `ca_cert` di `firmware/vaso/src/mqtt_handler.cpp`
(→ reflash dei vasi).

## Se cambia l'IP pubblico del server

Rigenerare **solo** il certificato server (la CA resta valida, niente reflash):
ripetere i comandi `server.*` sopra con il nuovo IP nel SAN, poi
`docker compose -f docker-compose.staging.yml restart mosquitto`.
