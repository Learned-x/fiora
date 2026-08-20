# 🌿 Fiora — Analisi approfondita: stato reale, buchi di specifica, bug, funzioni mancanti

**Audit del 2026-08-18.** Documento una tantum, non fa parte dei cinque documenti
di specifica (`fiora-specifiche-funzionali.md`, `fiora-specifiche-tecniche.md`,
`fiora-roadmap.md`, `fiora-mev.md`, `fiora-manuale-ambienti.md`) e non li sostituisce.
Le decisioni che emergono da qui vanno **recepite in quei documenti**, non mantenute
qui: questo file è una fotografia del confronto fra specifiche, roadmap/CLAUDE.md e
codice reale in un dato momento, destinata a invecchiare.

**Metodo:** lettura integrale dei 5 documenti in `/docs` e di `CLAUDE.md`, poi verifica
puntuale nel codice (backend, mobile, firmware, `schema.prisma`, `git log`) di ogni
affermazione di stato ("risolto", "completo", "testato") prima di darla per buona.
Diversi risultati sotto contraddicono direttamente quello che la documentazione dice
di sé stessa — è il punto centrale di questo audit.

---

## 0. Sintesi — le 3 cose da leggere anche se salti il resto

1. **Il firmware del vaso oggi non legge nessun sensore reale.** `sensors.cpp` genera
   dati casuali («scheda nuda, nessun sensore fisico collegato», commit `b541cfc`,
   2026-08-04). Umidità, luce, temperatura e batteria sono `random()`. Questo
   **riapre silenziosamente D5 e D6** (marcati "risolti" in `fiora-roadmap.md`) e
   rende vuoto ogni test "end-to-end su hardware reale" fatto dopo quella data per
   quanto riguarda i *valori* di sensore (la connettività BLE→WiFi→MQTT invece è
   davvero validata). Vedi [§1](#1-il-firmware-genera-dati-sensore-finti-non-più-solo-debito-d5d6-ma-una-regressione-non-tracciata).
2. **I tre documenti di specifica non sono aggiornati da 3 settimane**, mentre
   `CLAUDE.md` registra un flusso continuo di lavoro nello stesso periodo (Fase 6
   dichiarata completa, MEV-05/08/09 fatte, D12–D16 aperti e chiusi, bundle iOS
   cambiato, build TestFlight). Chi legge solo `/docs` oggi si fa un'idea del
   progetto vecchia di 3 settimane, in punti anche opposta alla realtà (es. §10
   funzionali dice ancora "mai testato su hardware reale"). Vedi [§2](#2-i-documenti-di-specifica-sono-fermi-al-2026-07-27-claudemd-no).
3. **Lo stato della Fase 6 è contraddittorio fra le fonti stesse**: la tabella
   riassuntiva di `fiora-roadmap.md` la segna ancora 🚧 *in corso*, il corpo del
   documento dice "manca la validazione su hardware reale", ma `CLAUDE.md` la
   dichiara chiusa il 2026-08-18. Nessuno dei tre documenti spiega se il punto 5
   della lista "da fare prima di chiudere la fase" (ordinamento/filtro vaso smart)
   sia stato deliberatamente rimandato oltre la chiusura o dimenticato. Vedi [§3](#3-stato-fase-6-contraddittorio-fra-le-fonti).

---

## 1. Il firmware genera dati sensore finti — non più solo debito D5/D6, ma una regressione non tracciata

**File:** `firmware/vaso/src/sensors.cpp`, `firmware/vaso/platformio.ini`

```cpp
// MODALITA' TEST SENZA SENSORI: scheda nuda, nessun sensore fisico collegato.
// Tutti i valori sono generati random (ma plausibili)...
void executeSensorCycle() {
  int soilPercent = random(20, 90);
  float lux = random(0, 20000) / 10.0f;
  float temperatura = random(150, 300) / 10.0f;
  int batteriaPercento = random(30, 100);
  ...
```

Introdotto dal commit `b541cfc` (2026-08-04, *"migra a PlatformIO, sensori in
modalità fake per test end-to-end"*) e mai revertito nei commit successivi
(`3b1a94c`, `98e2101`, `06f2fcb`, `93f7b34` — l'ultimo è del 2026-08-14). Confermato
anche da `platformio.ini`: `lib_deps` contiene solo `ArduinoJson` e `PubSubClient`,
**nessuna libreria sensore** (niente BH1750, niente Adafruit BMP280/BME280) è più
una dipendenza del progetto.

**Perché è più di un debito noto:**
- `fiora-roadmap.md` segna **D5 (batteria) e D6 (sensori non inizializzati) come
  "✅ Risolto"**, descrivendo `sensors.cpp` che legge l'ADC su GPIO34 e chiama
  `bmp.begin(0x76)`/`lightMeter.begin()`. Quel codice **è esistito** (recuperabile
  da git history, come dice il commit stesso) ma **non è quello che gira oggi**:
  è stato sostituito dalla versione fake nello stesso ramo di sviluppo, senza che
  nessun documento segnalasse la riapertura di D5/D6.
- `sensors.h` ha ancora il commento `// Inizializza I2C e i sensori (luce,
  temperatura). Blocca se il BMP280 non risponde.` — descrive il comportamento
  del file **prima** della riscrittura fake: oggi `initSensors()` fa solo
  `randomSeed(micros())`, non tocca I2C e non può bloccarsi. Commento-codice
  disallineato nello stesso file.
- Come conseguenza, **D12** ("`bmp.begin()` fallito blocca il boot") e **D13**
  (`Adafruit_BME280 bme` dichiarato e mai usato) descritti in `fiora-roadmap.md`
  **non esistono più nel codice attuale** — non perché risolti, ma perché il codice
  a cui si riferiscono è stato rimosso. La roadmap li elenca ancora come "nuovi
  problemi emersi", il che è ormai fuorviante nei due sensi opposti (D5/D6 dati per
  chiusi ma riaperti; D12/D13 dati per aperti ma inapplicabili al codice attuale).
- **Effetto pratico su MEV-08**: le soglie sensore per-pianta (umidità/luce/
  temperatura, completate e "testate" il 2026-08-18 secondo `fiora-mev.md`) sono
  state validate contro un dispositivo che **manda numeri casuali**. Il fatto che
  l'app mostri un tile verde/ambra coerente con una soglia non dimostra che la
  soglia funzioni con una lettura reale — dimostra solo che la UI legge
  correttamente qualunque numero arrivi da MQTT. Non è un problema della MEV in sé,
  ma la frase "completo e testato" andrebbe qualificata.

**Impatto:** nessun blocco per continuare lo sviluppo backend/mobile (l'obiettivo
del commit — validare BLE→WiFi→MQTT — è legittimo e riuscito). Il rischio è
**operativo**: quando arriverà l'hardware sensori vero, servirà (a) riportare
`sensors.cpp` alla versione reale da git history, (b) far tornare `lib_deps` con le
librerie sensore, (c) ri-verificare D5/D6/D12/D13 da zero, (d) ri-validare le soglie
MEV-08 con dati reali prima di considerarle davvero pronte per un alert (Fase 7).
Se questo non viene scritto da qualche parte *ora*, il prossimo che riprende il
firmware rischia di scoprirlo solo aprendo `sensors.cpp` per caso.

**Raccomandazione:** aggiungere in `fiora-roadmap.md` una voce di debito esplicita
(es. **D17 — Firmware in modalità sensori fake**, con riferimento al commit
`b541cfc` e alla nota "recuperabile da git history"), e togliere D12/D13 dalla
sezione "aperti" (non applicabili al codice attuale) mantenendoli solo come nota
storica.

---

## 2. I documenti di specifica sono fermi al 2026-07-27, CLAUDE.md no

Tutti e tre i documenti principali dichiarano `Versione 2.0/1.1 · aggiornato al
2026-07-27` in testa. `fiora-mev.md` è addirittura *Versione 1.0*, stessa data. Nel
frattempo `CLAUDE.md` registra, **dopo** quella data:

| Evento (da CLAUDE.md) | Data | Riflesso in `/docs`? |
|---|---|---|
| Bundle iOS/Android `com.fiora.app` → `app.fiora.mobile` | 2026-08-04 | ❌ non menzionato in nessuno dei 5 documenti |
| Apple Sign-In collegato lato mobile | 2026-08-04 | 🚧 parziale — `fiora-specifiche-funzionali.md` §1.4 dice ancora "bottone placeholder" |
| MEV-05 riconfigurazione WiFi, completa e testata su hardware | 2026-08-14/18 | ❌ `fiora-specifiche-funzionali.md` §10.4 dice ancora "📋 non implementato"; `fiora-specifiche-tecniche.md` §6 dice ancora "Non implementato (debito D7)" |
| D2 bug collega/scollega vaso, chiuso | 2026-08-14 | ✅ chiuso anche in `fiora-roadmap.md` (unico allineato) |
| MEV-08 step 1 (soglie per-pianta), completo e testato | 2026-08-18 | ❌ non in `fiora-specifiche-tecniche.md` §4 (schema DB) né §6 (logica soglie) |
| MEV-09 (cura manuale per pianta), completo | 2026-08-18 | 🚧 parziale — presente in `fiora-specifiche-funzionali.md` §4.2/§6.2 (qualcuno le ha aggiornate), assente in `fiora-specifiche-tecniche.md` §4 (schema) |
| D14/D15/D16 aperti e richiusi | 2026-08-18 | ✅ solo in `fiora-mev.md` (coerente) |
| Fase 9 §12.3 senza moderazione admin, specie privata al proponente | 2026-08-18 | ✅ `fiora-specifiche-funzionali.md` §12.3/§14 aggiornate; `fiora-roadmap.md` §Fase 9 aggiornata solo in una riga breve |
| Build EAS staging + Google/Apple Sign-In verificati su device reale | 2026-08-18 | ❌ non in `fiora-manuale-ambienti.md` §4 |
| Fase 6 dichiarata completa, pairing BLE testato end-to-end | 2026-08-18 | ❌ vedi [§3](#3-stato-fase-6-contraddittorio-fra-le-fonti) |

**Osservazione:** il pattern non è "tutto fermo" — `fiora-specifiche-funzionali.md`
è stato chiaramente riaperto e editato per §12.3/§14 (proposta specie) e per
§4.2/§6.2 (MEV-09), probabilmente nella stessa sessione in cui sono state
implementate. È **`fiora-specifiche-tecniche.md`** (schema DB, §6 vaso smart) e
**`fiora-roadmap.md`** (tabella di stato, sezione Fase 6) a essere rimasti indietro
in modo quasi completo dal 2026-07-27. Ha senso: le tecniche richiedono riscrivere
blocchi SQL/JSON più laboriosi di una riga di stato, ed è la parte che si salta per
prima quando si ha fretta di consegnare la funzione.

**Perché conta, oltre al principio:** `CLAUDE.md` stesso istruisce di aggiornare
`/docs` come fonte di verità del progetto ("aggiornare quello pertinente" — non
crearne altri). Oggi l'unico documento davvero aggiornato è `CLAUDE.md`, che però è
un registro cronologico di lavoro, non un documento di specifica organizzato per
argomento: non ha un indice, non è cercabile per sezione funzionale, e mescola
decisioni definitive con note di debug temporanee. Se `CLAUDE.md` dovesse essere
troncato, compattato o perso, l'unica fonte di verità su Fase 6/MEV-05/08/09
sparirebbe: `/docs` da solo oggi non basterebbe a ricostruire lo stato reale del
progetto.

**Raccomandazione:** prima di aggiungere altro lavoro, una sessione dedicata a
riportare `fiora-specifiche-tecniche.md` §4 (schema) e §6 (vaso smart) e
`fiora-roadmap.md` (tabella Fase 6, sezione debito) allo stato vero del codice.
Le sezioni analizzate in questo audit ([§4](#4-sezioni-tecniche-specifiche-da-riscrivere-elenco-puntuale)) sono un punto di partenza già pronto.

---

## 3. Stato Fase 6: contraddittorio fra le fonti

- `fiora-roadmap.md`, tabella "Quadro d'insieme" (riga Fase 6): **🚧 in corso**.
- `fiora-roadmap.md`, corpo sezione "Fase 6": *"Fase attiva. Backend e app sono
  scritti; manca la validazione su hardware reale."*
- `fiora-roadmap.md`, "Da fare prima di chiudere la fase", punto 5: *"Ordinamento
  della collezione 'per prossima azione' e filtro 'con vaso smart' (§3.1
  funzionali), rinviati qui perché richiedono l'esistenza dei vasi."* — **non
  spuntato, non discusso altrove.**
- `fiora-specifiche-funzionali.md` §10: *"Pairing BLE, lista vasi, dettaglio vaso,
  dati sensori e collega/scollega pianta sono implementati **ma mai testati
  end-to-end su hardware reale**."*
- `CLAUDE.md`, voce del 2026-08-18: *"Risolto: pairing BLE end-to-end su hardware
  reale... Fase 6 considerata completa — nessun test end-to-end pendente."*

Quattro affermazioni, tre stati diversi, nello stesso progetto, nello stesso giorno
(l'audit è del 2026-08-18, stessa data della voce CLAUDE.md che dichiara la fase
chiusa). Non è chiaro se:
1. Il punto 5 (ordinamento/filtro) sia stato deliberatamente escluso dai criteri di
   chiusura della fase (ragionevole: sono migliorie UI minori, non blocco
   tecnico) — ma allora andrebbe spostato esplicitamente in Fase 10 o in una MEV,
   non lasciato appeso in una lista "da fare prima di chiudere";
2. oppure sia stato semplicemente dimenticato nel dichiarare la fase completa.

Considerando anche il punto [§1](#1-il-firmware-genera-dati-sensore-finti-non-più-solo-debito-d5d6-ma-una-regressione-non-tracciata)
(i dati sensore sono finti), "Fase 6 completa" è vero per la parte
**connettività/provisioning/CRUD vasi**, ma non ancora vero per la parte
**telemetria con hardware sensori reale** — che è comunque nell'ambito dichiarato
della fase ("Integrazione vaso smart (MQTT → DB, schermate Vasi, pairing BLE)").

**Raccomandazione:** decidere esplicitamente (una riga in `fiora-roadmap.md`) se
Fase 6 è "chiusa per la parte firmware/connettività, sensori reali rimandati a
quando arriva l'hardware" — che sembra la lettura più onesta — invece di "chiusa"
senza qualifica.

---

## 4. Sezioni tecniche/specifiche da riscrivere (elenco puntuale)

Non un'analisi concettuale, ma le righe esatte che oggi contraddicono il codice:

| Documento | Sezione | Cosa dice oggi | Cosa dice il codice |
|---|---|---|---|
| `fiora-specifiche-tecniche.md` | §6, contratto payload BLE | *"Disallineamento aperto (debito D1, **bloccante**)"* | `ble_provisioning.cpp:35-49` legge correttamente `mqtt_user`/`mqtt_pass`/`mqtt_host`/`mqtt_port` — D1 e D9 (lato firmware) risolti |
| `fiora-specifiche-tecniche.md` | §6, riconfigurazione WiFi | *"Non implementato (debito D7)... l'app non ha una voce 'Riconfigura WiFi'"* | MEV-05 completa: `POST /vases/:id/reset-wifi`, `GET /vases/:id/reconnect-credentials` (`vase.routes.ts:223-258`), `app/vase/reconnect-wifi.tsx`, pulsante GPIO13 gestito (`wifi_manager.cpp:107-122`) |
| `fiora-specifiche-tecniche.md` | §6, frequenza campionamento | *"Il firmware pubblica ogni 3 secondi... nessuna callback (D3, D4)"* | `config.cpp:11`: `samplingInterval = 30 min`; `mqtt_handler.cpp:56-62` gestisce `"check"` e `"reset"` — D4 risolto (valore diverso da spec, 30 min vs 15), D3 parziale (manca solo `sampling_interval_seconds` da remoto) |
| `fiora-specifiche-tecniche.md` | §4, schema `plants` | Nessun campo soglia/cura | Realtà: `sogliaUmiditaMin/Max`, `sogliaLuceMin/Max`, `sogliaTempMin/Max` (MEV-08), `luceCura`/`annaffiaturaCura`/`umiditaCura` (MEV-09) su `Plant` — 9 colonne mancanti dallo schema documentato |
| `fiora-specifiche-tecniche.md` | §4, schema `smart_vases` | Nessun campo `ordine` | `SmartVase.ordine Int @default(0)` (MEV-03, backend pronto) |
| `fiora-specifiche-tecniche.md` | §4, schema `species` | `stato ... 'attivo' \| 'in_revisione'` | Fase 9 rivista 2026-08-18: sempre `'attivo'`, nessun flusso imposta più `'in_revisione'` (confermato: zero occorrenze nel codice) — anche il commento nello **schema Prisma stesso** (`schema.prisma`, model `Species`) è rimasto con la doppia opzione, non solo la doc |
| `fiora-manuale-ambienti.md` | §4.2, esempio bundle ID | `com.tangifiori.app` | Bundle reale in uso: `app.fiora.mobile` (`mobile/app.json`) — **terzo** identificatore diverso citato nel progetto dopo `com.fiora.app` (abbandonato) e quello vero; chi segue l'esempio alla lettera rischia di ripetere l'errore "Invalid string" già risolto |
| `fiora-roadmap.md` | Debito, D9 | *"Implementato 2026-07-31, non ancora testato su hardware"* | Codice conferma implementazione lato firmware; nessuna nota successiva conferma o smentisce il test — resta uno stato "a metà" che né la roadmap né CLAUDE.md chiudono esplicitamente |

---

## 5. Bug/scostamenti trovati nel firmware, non presenti in nessun elenco di debito

Questi non hanno un ID `D*` in `fiora-roadmap.md` — non risultano mai segnalati.

### 5.1 Connessione MQTT senza timeout né fallback a BLE

`fiora-specifiche-tecniche.md` §6 ("Fallimento della connessione dopo il
provisioning") prescrive: se il WiFi si connette ma **il broker MQTT non risponde
entro 30 secondi**, il vaso deve cancellare le credenziali e tornare in BLE
advertising — stessa logica del fallimento WiFi.

`mqtt_handler.cpp:65-88` (`connectMQTT()`), però:

```cpp
void connectMQTT() {
  ...
  while (!client.connected()) {
    client.setServer(cfg_mqtt_host.c_str(), cfg_mqtt_port);
    ...
    if (client.connect(...)) {
      ...
    } else {
      delay(2000);   // e ricomincia il while, all'infinito
    }
  }
}
```

Nessun timeout, nessun contatore di tentativi, nessun ritorno a
`startBLEProvisioning()`. Se `broker_host`/`broker_port` ricevuti via BLE (D9) sono
sbagliati — es. un refuso nel numero di porta, o `mqtt_port` deserializzato male da
ArduinoJson come stringa invece che intero (il punto che lo stesso D9 chiede di
verificare) — il vaso resta bloccato **per sempre** in questo ciclo, silenzioso
(nessun messaggio di stato pubblicato, perché non è mai connesso), irraggiungibile
sia da MQTT sia da BLE. È esattamente lo scenario che la sezione "Perché cancellare
le credenziali" dello stesso documento tecnico spiega essere da evitare per il caso
WiFi — ma la stessa logica non è stata applicata al caso MQTT, nonostante la specifica
la richieda esplicitamente.

**Impatto:** più alto ora che mai, proprio perché D9 rende host/porta dinamici (prima
erano hardcoded e quindi sempre corretti per costruzione). Un solo pairing con un
`broker_port` malformato produce un vaso "muto" recuperabile solo col pulsante
fisico (se il proprietario sa che esiste e a cosa serve).

### 5.2 Timeout/retry WiFi diversi da quanto documentato

`fiora-specifiche-tecniche.md` §6 descrive: tentativo di connessione WiFi con
timeout 30s, **3 tentativi totali (~90s)** prima di tornare in BLE.

`config.h:14` + `wifi_manager.cpp:56-95` (`connectWiFi()`): `WIFI_TIMEOUT_MS =
10000` (10s), **un solo tentativo** — al primo fallimento cancella subito
`ssid`/`wifi_pass` e ritorna `false` (gestito poi da un retry esterno in
`vaso-testnale.ino:64-70` che richiama `startBLEProvisioning()` in loop, quindi il
comportamento visibile all'utente — "torna in BLE se sbaglio la password" — è
comunque rispettato). Il numero non è quello scritto in specifica: non è un bug
funzionale, ma un valore diverso da quanto la doc dichiara come contratto, mai
allineato.

### 5.3 Light sleep disabilitato, nessuna nota su consumo energetico

`vaso-testnale.ino:8-21` documenta nel codice stesso che `enterLightSleep()` è
stato **sostituito con `delay()` semplice** perché rompeva la sessione MQTT (i
messaggi su `.../config` non arrivavano più). `fiora-specifiche-tecniche.md`
("Requisiti hardware") menziona la batteria come requisito ma non tratta il
risparmio energetico come sezione a sé; nessun documento registra che il consumo
energetico attuale del firmware è quello di un ESP32 sempre sveglio, non quello
previsto per un dispositivo a batteria con letture ogni 30 minuti. Per un
dispositivo IoT a batteria è una regressione silenziosa rilevante quanto quella dei
sensori fake, e come quella non ha un ID di debito.

**Raccomandazione complessiva §5:** aprire almeno due nuovi ID di debito
(**D18 — MQTT connect senza timeout/fallback**, **D19 — light sleep disabilitato,
consumo energetico non gestito**) in `fiora-roadmap.md`, oltre al D17 di [§1](#1-il-firmware-genera-dati-sensore-finti-non-più-solo-debito-d5d6-ma-una-regressione-non-tracciata).

---

## 6. La specifica OTA (§16 tecniche) è orfana

`fiora-specifiche-tecniche.md` §16 "Aggiornamento firmware OTA" è lunga quanto le
sezioni 1-5 messe insieme (~475 righe, 10 sottosezioni: modello dati, protocollo
MQTT, API backend, firmware ESP32, rollback/anti-brick, app mobile, flusso di
rilascio). È dettagliata e ben pensata. Ma:

- **Non esiste in nessuna fase** di `fiora-roadmap.md` (non nella tabella
  "Quadro d'insieme", non fra le "Fasi rimandate e future").
- **Non esiste in `fiora-mev.md`.**
- **Zero codice la implementa**: nessuna route `/vases/*/ota*` nel backend
  (`backend/src/routes/vase.routes.ts` verificato), nessun campo
  `firmware_version` in `schema.prisma`, nessun riferimento OTA nel firmware.
- Il capitolo "Requisiti del firmware" (subito prima) la cita come punto 9,
  dicendo *"vedi §16 per il protocollo completo"* — quindi i due capitoli si
  aspettano a vicenda, ma nessuno dei due ha un padre nella roadmap.

Non è necessariamente un problema — può essere semplicemente "specificato in
anticipo, non ancora pianificato" — ma così com'è, un lettore di `/docs` non ha modo
di sapere se l'OTA è: (a) prevista per dopo l'MVP, (b) accantonata, (c) refuso di
un brief scritto per un partner hardware mai coinvolto (c'è una nota in cima al
capitolo "Requisiti firmware" che dice esattamente questo per il capitolo
gemello — *"Questo capitolo nasce come brief per un partner hardware esterno"*).

**Raccomandazione:** aggiungere una riga in `fiora-roadmap.md` (anche solo
"OTA firmware — specificata in §16 tecniche, non pianificata, verificare rilevanza
prima di Fase 7") così la sezione ha un aggancio nella roadmap invece di fluttuare.

---

## 7. Funzionalità mancanti rispetto alle specifiche (già note, elenco consolidato)

Per completezza — questi sono già segnalati coerentemente nei documenti, non nuovi,
ma vale metterli in un unico posto:

| Funzione | Sezione specifica | Stato reale verificato |
|---|---|---|
| Diario fotografico (upload MinIO, ridimensionamento, timeline) | §11.3-11.4 funzionali | Non implementato, nessuna route foto nel backend, MinIO in piedi e inutilizzato (confermato) |
| Alert da sensore + task `sorgente:'sensore'` + notifiche relative | §7.1/§8/§15 funzionali, Fase 7 | Non implementato: nessun job valuta le soglie, `handleTelemetry` in `mqtt.ts` scrive solo la lettura (confermato leggendo `src/lib/mqtt.ts`, nessuna logica di alert oltre `updateVaseStatus`) |
| Storico ambientale aggregato 7/30 giorni (MEV-04) | §11.2 funzionali | Solo 24h grezze (`GET /vases/:id/readings`), nessuna continuous aggregate TimescaleDB |
| Orario promemoria libero (MEV-01) | §13.3 funzionali | Solo 3 fasce fisse, confermato in `User.orarioReminder` (default `"mattina_9"`, stringa-fascia) |
| Riordino vasi lato mobile (MEV-03) | §13.5 funzionali | Backend pronto (`ordine`, `PATCH /vases/order`), UI non esposta — in pausa dichiarata |
| Empty state con suggerimenti (MEV-06) | §2.2 funzionali | Non implementato |
| Esportazione dati utente / GDPR (MEV-07) | Nuovo, `fiora-mev.md` | Non implementato |
| Fiori nel bouquet (`fioriBouquet`) | §5 funzionali, Fase 10 | Non implementato, nessun campo nello schema |
| Import CSV specie eseguito con dati reali | Fase 9 | Script scritto (CLAUDE.md lo dice, path non verificato in questo audit — vedi [§9](#9-verifiche-non-completate-in-questo-audit)), `species_import_raw` risulta comunque vuota per import mai lanciato |
| Import massivo Trefle in produzione | Fase 9 | Non iniziato (dipende da produzione, non ancora esistente) |
| TestFlight reale / App Store submit | Fase 10, distribuzione | Non fatto — manca ancora l'account Apple Developer per la submission finale, solo build interne EAS |

---

## 8. Difetti minori di codice/naming (bassa priorità, veloci da sistemare)

- **`Species.propostoDao`** (`schema.prisma`, campo Prisma): il nome del campo
  applicativo è `propostoDao`, non `propostoDa` — sembra un refuso mai corretto
  (la colonna DB sottostante è invece corretta: `@map("proposto_da")`). Il refuso si
  è propagato in `CLAUDE.md` e in `fiora-mev.md`, che lo citano entrambi come se
  fosse la forma corretta. Rinominare il campo Prisma è una migration/refactor non
  banale a questo punto (tocca `species.service.ts`, i test, il client generato) —
  segnalo ma non è urgente: è solo un nome interno, non esposto via API in questa
  forma (l'API restituisce presumibilmente `propostoDa` in JSON, da verificare).
- **`Species.approvatoDa`**: la doc tecnica lo chiama "vestigiale... mai più
  popolato" ma la colonna resta nello schema. Coerente con la scelta esplicita di
  non forzare una migration — nessuna azione richiesta, solo nota per chi legge lo
  schema e si chiede a cosa serve un campo sempre `null`.
- **`sensors.h`** (firmware): commento della funzione `initSensors()` descrive un
  comportamento (blocco su BMP280) che il file `.cpp` non ha più — vedi [§1](#1-il-firmware-genera-dati-sensore-finti-non-più-solo-debito-d5d6-ma-una-regressione-non-tracciata).
- **`schema.prisma`**, commento su `Species.stato`: `// 'attivo' | 'in_revisione'`
  — la seconda opzione non è più raggiungibile da nessun percorso di codice dopo la
  revisione Fase 9 del 2026-08-18. Una riga di commento, ma fuorviante per chi legge
  lo schema senza conoscere la storia recente.
- **`fiora-mev.md`**, tabella riassuntiva MEV-08: la riga dice "Backend + mobile
  (+ Fase 7)" come impatto — corretto, ma la tabella di roadmap non riporta lo
  stesso collegamento a Fase 7, rendendo poco visibile a chi legge solo
  `fiora-roadmap.md` che MEV-08 step 2 e Fase 7 sono la stessa cosa (già scritto
  esplicitamente nel corpo di `fiora-mev.md`, solo non nella tabella di sintesi).

---

## 9. Verifiche non completate in questo audit

Per onestà: non tutto è stato verificato a fondo, per limiti di tempo/ambito.

- **Permessi MQTT su HiveMQ Cloud** (letto/scritto per `fiora/vaso/+/...`): non
  verificabile da codice locale, richiede accesso alla console HiveMQ. CLAUDE.md
  dichiara "verificato", preso per buono.
- **Script import CSV specie**: CLAUDE.md dice "scritto e testato", path non
  tracciato. Non ho cercato nel filesystem `backend/src/scripts` per confermarne
  l'esistenza — se serve, è una verifica di 30 secondi da fare alla prossima
  sessione prima di fare affidamento sullo script per Fase 9.
- **Test su device reale delle build EAS staging** (Google/Apple Sign-In): preso
  per buono da CLAUDE.md, non verificabile senza il device fisico.
- **Contenuto di `docs/archivio/`**: non riletto in questo audit (per definizione
  documenti superati, basso rischio di contraddire lo stato attuale).
- **Copertura test mobile**: non esiste una suite di test automatici lato mobile in
  questo progetto (solo backend, 187/187 verdi, verificato eseguendo `npm test`) —
  non è una scoperta di questo audit ma una conferma: ogni claim "testato" lato
  mobile in CLAUDE.md/mev è **sempre** test manuale su device, mai automatizzato.
  Vale la pena tenerlo a mente come rischio di regressione silenziosa lato mobile
  quando si toccano schermate condivise (es. `plantUi.ts`, `SoglieVaseModal`).

---

## 10. Raccomandazioni, in ordine di priorità

1. **Aggiornare `fiora-roadmap.md`**: tabella di stato Fase 6, sezione debito
   (chiudere/riformulare D5/D6/D9/D12/D13 secondo lo stato reale del firmware,
   aprire D17/D18/D19 per i punti di [§1](#1-il-firmware-genera-dati-sensore-finti-non-più-solo-debito-d5d6-ma-una-regressione-non-tracciata) e [§5](#5-bugscostamenti-trovati-nel-firmware-non-presenti-in-nessun-elenco-di-debito)).
2. **Aggiornare `fiora-specifiche-tecniche.md`** §4 (schema: campi soglia/cura su
   `Plant`, `ordine` su `SmartVase`, revisione Fase 9 su `Species`) e §6 (rimuovere
   le note "non implementato" per D1/D7/D9/D3/D4 ormai false, aggiungere i due bug
   di §5.1/§5.2 di questo audit).
3. **Decidere e scrivere lo stato di chiusura di Fase 6** in modo non ambiguo (vedi
   [§3](#3-stato-fase-6-contraddittorio-fra-le-fonti)), qualificandolo rispetto ai
   sensori fake.
4. **Prima di qualunque test reale delle soglie MEV-08/Fase 7**: ripristinare le
   letture sensore vere in firmware (da git history, come annotato nel commit
   stesso), o quantomeno scriverlo a chiare lettere come precondizione bloccante
   per Fase 7.
5. **Fix rapido, basso rischio**: correggere il timeout/retry MQTT (§5.1) prima del
   prossimo pairing reale — è l'unico dei bug trovati che può rendere un vaso
   fisico irraggiungibile senza intervento manuale.
6. **Aggiungere una riga di aggancio per l'OTA (§16 tecniche)** in
   `fiora-roadmap.md`, anche solo per marcarla esplicitamente "non pianificata".
7. Il resto (naming `propostoDao`, commenti stale, esempio bundle ID in
   `fiora-manuale-ambienti.md`) è cosmetico: da sistemare alla prossima occasione di
   toccare quei file, non richiede una sessione dedicata.
