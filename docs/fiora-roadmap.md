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

1. **Test end-to-end su hardware reale.** Nessun pairing è mai stato completato su un
   ESP32 fisico: finora ha girato solo la versione precedente del firmware, con le
   credenziali hardcoded. Include il test su device Android reale (il BLE non funziona
   né su simulatore iOS né su emulatore Android).
2. **Allineare i nomi dei campi nel payload BLE** (vedi debito D1) — bloccante per il punto 1.
3. **Verificare i permessi dell'utente MQTT** su HiveMQ Cloud per publish e subscribe
   sui topic `fiora/vaso/+/...`.
4. **Investigare il bug collega/scollega pianta** (vedi debito D2).
5. Ordinamento della collezione "per prossima azione" e filtro "con vaso smart"
   (§3.1 funzionali), rinviati qui perché richiedono l'esistenza dei vasi.

---

## Debito noto

Raccolto nell'audit del 2026-07-27 confrontando documentazione e codice. Ordinato
per priorità. Le voci **D3–D8 e D11** riguardano il firmware, che è **indietro rispetto
alle specifiche**: le specifiche restano il bersaglio, è il firmware a doversi allineare.

### Bloccanti per la Fase 6

**D1 — Nomi dei campi nel payload BLE disallineati.**
L'app invia `mqtt_user` e `mqtt_pass`; il firmware legge `mqtt_username` e
`mqtt_password`. Al primo pairing reale il vaso non troverebbe le credenziali e
riceverebbe valori nulli. Da correggere prima di qualsiasi test su hardware.

**D2 — Collega/scollega pianta dal dettaglio vaso non affidabile.**
Le azioni "Cambia pianta" e "Scollega" restituiscono "Operazione non riuscita"
nell'app, ma lo stesso payload via `curl` riceve 200 dal backend. Il fallimento
coincideva con un episodio di corruzione I/O di Docker Desktop, risolto; non è stato
riverificato dopo. Indagare prima lato client (stato React non aggiornato, richiesta
inviata prima che il vaso sia caricato) che lato backend.

### Firmware — funzioni specificate e non implementate

**D3 — Handler dei messaggi `config` assente.** Lo sketch si iscrive al topic
`fiora/vaso/{id}/config` ma non registra alcuna callback: i comandi di
`sampling_interval_seconds` vengono ignorati. Anche lato backend `publishToVase()`
esiste ma nessun endpoint la richiama.

**D4 — Frequenza di campionamento.** Le specifiche prevedono 15 minuti (5 in allerta);
il firmware pubblica ogni 3 secondi. A regime è un carico inutile sul broker gratuito
e sull'hypertable.

**D5 — Batteria mai inviata.** `publishTelemetry()` viene chiamata con `batteria = -1`,
quindi il campo non arriva mai e lo stato `batteria_scarica` non si attiva. Blocca
anche la condizione sulla batteria prevista per l'OTA.

**D6 — Sensori non inizializzati.** `lightMeter.begin()` e `bme.begin()` sono
commentati nel `setup()`: luce e temperatura vengono lette da periferiche mai avviate.

**D7 — Reset fisico di 5 secondi.** Nessuna gestione del pulsante nello sketch.
Di conseguenza la riconfigurazione WiFi (§10.4 funzionali) non è realizzabile
end-to-end e in app non esiste la voce che la avvia. Il flusso completo lato utente
è **MEV-05**; qui resta la sola gestione del pulsante nel firmware.

**D11 — Il vaso non torna in advertising se la connessione fallisce.** Se le
credenziali ricevute via BLE non funzionano (password errata, rete 5 GHz, broker
irraggiungibile), il firmware le conserva e continua a ritentare: il vaso resta
irraggiungibile sia via BLE sia via MQTT, recuperabile solo col pulsante fisico —
che per D7 non esiste. Un errore di battitura nella password basta a rendere il vaso
inutilizzabile. Comportamento richiesto in §6 tecniche ("Fallimento della connessione
dopo il provisioning"); è il presupposto del "Riprova" descritto in §10.1.2 funzionali.

**D8 — Buffer offline.** Non implementato: i dati raccolti senza WiFi sono persi.

### Altro

**D9 — Endpoint del broker non trasmessi nel pairing.** Host e porta MQTT sono
hardcoded nel firmware e l'app non li invia. Andrebbero aggiunti al payload BLE:
servono per la migrazione a Mosquitto in produzione senza reflash dei vasi.

**D10 — Suite di test del backend non eseguibile.** `npm test` fallisce con
"Preset ts-jest not found relative to rootDir" nonostante `ts-jest` sia presente e
risolvibile. Verificato con `git stash` che il problema esiste anche sul codice
pristine, quindi preesistente e non causato dalla Fase 6. Da risolvere prima di
poter tornare a fidarsi dei test.

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
| MEV-02 | Email transazionali e recupero password | Alta |
| MEV-03 | Rinominare e riordinare i vasi | Media |
| MEV-04 | Storico ambientale a 7 e 30 giorni | Media |
| MEV-05 | Riconfigurazione WiFi senza ri-pairing (copre il debito D7) | Media |
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
