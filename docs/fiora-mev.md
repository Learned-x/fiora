# 🌿 Fiora — MEV (Manutenzione Evolutiva)

**Versione 1.0 · 2026-07-27**

Interventi evolutivi da pianificare **dopo il completamento della Fase 6**, ognuno
autonomo e rilasciabile per conto proprio. Non sono nuove fasi della roadmap: sono
migliorie su funzioni già esistenti, che possono entrare in qualsiasi release senza
dipendere l'una dall'altra.

Documenti collegati:
- **`fiora-specifiche-funzionali.md`** — comportamento corrente, con lo stato di ogni funzione.
- **`fiora-specifiche-tecniche.md`** — implementazione.
- **`fiora-roadmap.md`** — fasi e debito noto (D1–D11).

**Differenza fra MEV e debito noto:** il debito (D1–D11 nella roadmap) è codice che
non fa quello che le specifiche dicono già — va allineato. Le MEV sono cambiamenti
*alle* specifiche: funzioni che oggi si comportano come previsto, ma che vogliamo
migliorare.

---

## Quadro d'insieme

| ID | Intervento | Perché | Impatto | Priorità |
|---|---|---|---|---|
| **MEV-01** | Orario promemoria libero | Le 3 fasce fisse non coprono chi si alza presto o rientra tardi | Backend + mobile | Alta |
| **MEV-02** | Email transazionali e recupero password | **Chi dimentica la password perde l'account** | Backend + infra + mobile | Alta |
| **MEV-03** | Rinominare e riordinare i vasi | Con più vasi diventano indistinguibili | Mobile + backend minimo | ⏸️ Media — in pausa (2026-08-18): rinomina fatta, riordino backend pronto ma non esposto, UI mobile da ripianificare quando si riprende |
| **MEV-04** | Storico ambientale a 7 e 30 giorni | Oggi solo 24 h non aggregate | Backend | Media |
| **MEV-05** | Riconfigurazione WiFi senza ri-pairing | Cambio rete o password rende il vaso muto | Firmware + mobile | ✅ completa e testata (2026-08-14/18) |
| **MEV-06** | Empty state con suggerimenti | Prima schermata vuota per un utente nuovo | Mobile | Bassa |
| **MEV-07** | Esportazione dei dati utente | Obbligo GDPR alla portabilità | Backend | Bassa |
| **MEV-08** | Soglie sensori personalizzabili per pianta + alert configurabili | Le soglie oggi sono fisse per specie, non per pianta/vaso reale; nessun alert esiste ancora | Backend + mobile (+ Fase 7) | 🚧 Step 1 (soglie) ✅ completo e testato (2026-08-18); step 2 (alert) da valutare |
| **MEV-09** | Dati di cura (luce/annaffiatura/umidità) manuali per pianta | Senza specie di catalogo non c'è modo di avere reminder; con specie non c'è modo di correggere un valore inadatto alla pianta reale | Backend + mobile | ✅ completo (2026-08-18), da testare su device |

**Ordine consigliato:** MEV-02 → MEV-01 → MEV-05 → MEV-08 → MEV-09 → MEV-04 → MEV-03 → MEV-06 → MEV-07.
MEV-02 per prima perché è l'unica che oggi provoca una **perdita definitiva di accesso**;
MEV-01 subito dopo perché è la lamentela più probabile sulle notifiche. MEV-03 spostata
in fondo: in pausa dal 2026-08-18 per il problema UI di riordino, non bloccante per le
altre voci.

---

## MEV-01 — Orario dei promemoria libero

**Stato: 📋 da fare** · Riferimento: §13.3 funzionali, §12 tecniche

### Situazione attuale

L'utente sceglie fra tre fasce predefinite: mattina (9:00), pomeriggio (15:00),
sera (19:00). Il valore è salvato in `User.orarioReminder` come stringa
(`'mattina_9'`, …) e un job ricorrente gira alle 9, 15 e 19; a ogni esecuzione il
worker converte l'ora corrente nella fascia corrispondente e seleziona gli utenti
che l'hanno scelta.

### Problema

Tre orari fissi non coprono le abitudini reali: chi si alza alle 6 riceve il
promemoria tre ore dopo essere uscito di casa, chi rientra alle 22 lo trova già
vecchio. Il promemoria di annaffiare vale se arriva quando la persona può farlo:
fuori da quel momento è rumore, e il rumore porta a disattivare le notifiche.

### Comportamento richiesto

1. In Impostazioni → Notifiche, l'orario si sceglie con un **selettore di orario**
   (ore e minuti), non da una lista di fasce.
2. Granularità: **5 minuti**. Al minuto esatto non serve, e una griglia più fitta
   moltiplica le esecuzioni del job senza alcun beneficio percepibile.
3. Il valore mostrato rispetta il formato orario del dispositivo (24 h o AM/PM).
4. Alla migrazione, chi aveva una fascia predefinita mantiene lo stesso orario
   (mattina → 09:00, pomeriggio → 15:00, sera → 19:00): nessuno si vede cambiare
   l'ora dei promemoria senza averlo chiesto.

### Note di implementazione

- **Modello dati:** `User.orarioReminder` passa da stringa-fascia a un campo orario
  (`TIME` o minuti-da-mezzanotte come intero). Migrazione con conversione dei tre
  valori esistenti; il vecchio campo va rimosso solo dopo la conversione.
- **Scheduling:** il job passa da 3 esecuzioni a una **ogni 5 minuti**, che seleziona
  gli utenti il cui orario coincide con lo slot corrente. Sono 288 esecuzioni al
  giorno, ognuna con una query indicizzata sull'orario: il costo è trascurabile ed
  è molto più semplice di un job schedulato per utente.
- **Fuso orario:** oggi l'orario è implicitamente quello del server. Con un orario
  libero la questione diventa visibile — un utente che viaggia riceverebbe il
  promemoria all'ora sbagliata. Va salvato il fuso del dispositivo su User e usato
  nella selezione. **Da valutare se includerlo qui o rimandarlo**: senza, la MEV
  resta corretta per utenti in un solo fuso, che è la totalità dei casi attuali.
- **Indice** sul campo orario, altrimenti ogni esecuzione fa una scansione completa
  della tabella utenti.

---

## MEV-02 — Email transazionali e recupero password

**Stato: ✅ completa** (2026-08-04) · Riferimento: §1.7 e §13.4 funzionali · **Priorità alta**
Recupero password fatto e testato end-to-end il 2026-07-31. Cambio email e
conferma eliminazione account completati il 2026-08-04 (stessa infrastruttura).

### Problema

Non esiste alcun servizio email nello stack, e la conseguenza non è una comodità
mancante: **un utente che dimentica la password perde definitivamente l'accesso al
proprio account.** L'unico endpoint disponibile (`POST /auth/change-password`)
richiede la password attuale, e non c'è nessun'altra via di recupero. Chi ha
effettuato l'accesso con Google non è esposto — non ha una password Fiora — ma chi
si è registrato con email e password sì.

Dipendono dalla stessa infrastruttura anche: la conferma di eliminazione account
(§1.7, oggi gestita solo in-app) e il cambio dell'indirizzo email (§13.4), che senza
verifica del nuovo indirizzo permetterebbe di dirottare un account su una casella
non posseduta.

### Comportamento richiesto

**Recupero password — ✅ fatto (2026-07-31):**
1. Nella schermata di accesso compare "Password dimenticata?" (`app/(auth)/forgot-password.tsx`).
2. L'utente inserisce l'email e conferma.
3. L'app mostra **sempre lo stesso messaggio**, esista o meno quell'account
   ("Se l'indirizzo è registrato, riceverai un'email con le istruzioni"): una
   risposta diversa nei due casi permetterebbe di scoprire quali indirizzi sono
   iscritti a Fiora.
4. Se l'account esiste, parte un'email con un link contenente un token di reset.
5. Il link apre l'app sulla schermata di nuova password (`app/reset-password.tsx`).
6. Impostata la nuova password, **tutti i refresh token dell'utente vengono revocati**:
   se la richiesta è nata da un accesso non autorizzato, le sessioni aperte cadono.

**Nota sul link nell'email:** senza un dominio pubblico verificato, un vero universal
link (Apple/Google) non è implementabile né verificabile. Come soluzione **realistica
e non provvisoria** — è lo stesso pattern usato in produzione come fallback quando il
sistema operativo non intercetta l'universal link — il backend serve una pagina HTML
su `GET /reset-password?token=...` (`app.ts`) che rilancia lo schema custom
`fiora://reset-password?token=...`. L'email linka questa pagina (http/https, quindi
cliccabile nei client di posta) invece dello schema nudo, che molti client — Gmail
incluso — non rendono cliccabile. Quando un dominio pubblico sarà disponibile, va
aggiunto il file di verifica (`apple-app-site-association`/`assetlinks.json`) per far
scattare l'intercettazione nativa: la pagina fallback resta comunque utile come rete
di sicurezza.

**Cambio email:**
1. L'utente inserisce il nuovo indirizzo, confermando con la password attuale.
2. Un'email di verifica parte verso il **nuovo** indirizzo; l'account continua a
   usare il vecchio finché il link non viene aperto.
3. Una notifica informativa parte verso il **vecchio** indirizzo, con le istruzioni
   nel caso il cambio non sia stato richiesto dal legittimo proprietario.

**Conferma eliminazione account:** email riepilogativa con la data di eliminazione
definitiva e il link per annullare entro i 30 giorni di grazia.

### Note di implementazione

- **Servizio:** **Resend** — ✅ integrato (`src/lib/email.ts`, SDK `resend` npm).
  Piano gratuito da 3.000 email al mese. **Senza dominio verificato**, il mittente in
  uso è la sandbox `onboarding@resend.dev`: le email arrivano solo alla casella
  dell'account Resend, non a utenti reali. Da sostituire con un mittente sul dominio
  del progetto (es. `no-reply@tangifiori.com`) non appena disponibile, con record
  **SPF, DKIM e DMARC** configurati — senza, le email finiscono in posta indesiderata
  proprio nei momenti in cui l'utente le sta aspettando.
- **Token di reset:** ✅ valore casuale 32 byte (`crypto.randomBytes`), **salvato come
  hash SHA-256** (non in chiaro), **scadenza 30 minuti**
  (`passwordResetExpiresAt`), invalidato dopo l'uso (`resetPassword` lo azzera) e alla
  generazione di uno nuovo (sovrascritto). In dev/test il token in chiaro viene
  stampato nei log del server (`NODE_ENV !== 'production'`) per poter testare via
  Postman senza dover leggere l'email — mai in staging/produzione.
- **Rate limit:** ✅ riusa `authLimiter` esistente (5 richieste/minuto per IP) su
  `/auth/forgot-password` e `/auth/reset-password`. Non ancora per-indirizzo email
  (solo per IP) — da valutare se serve un limite aggiuntivo lato email.
- **Invio asincrono:** ✅ coda BullMQ `email` (`src/lib/bullmq.ts`) + worker
  `src/jobs/email.job.ts` — un errore di Resend non fa fallire la richiesta HTTP
  dell'utente. BullMQ gestisce i retry automatici di default.
- **Template:** ✅ italiano, testo essenziale, versione HTML + solo testo.
- **Nessun dato sensibile nell'email**: ✅ rispettato, mai la password.
- **Bug trovato e corretto (2026-07-31):** il SDK Resend non lancia mai
  un'eccezione sugli errori API — restituisce `{ data, error }`. `sendEmail()` non
  controllava `error`, quindi un 403 (o qualsiasi altro rifiuto Resend, es. invio a un
  indirizzo diverso da quello dell'account durante l'uso della sandbox
  `onboarding@resend.dev`) veniva trattato come invio riuscito: il job BullMQ risultava
  `completed`, l'audit segnava `esito:'ok'`, nessun errore visibile da nessuna parte.
  Corretto: `sendEmail()` ora lancia se `error` è presente, il worker logga l'esito
  reale come evento audit dedicato (`email.sent`/`email.failed`, con messaggio Resend).
  L'evento `auth.password_reset.requested` con `esito:'ok'` è stato rinominato in
  `'accodata'` per chiarire che significa solo "job in coda", non "email consegnata".
- **Da fare:** cambio email (§13.4) e conferma eliminazione account (§1.7), stessa
  infrastruttura (coda `email`, `sendEmail()`) da riusare senza modifiche.

---

## MEV-03 — Rinominare e riordinare i vasi

**Stato: ⏸️ in pausa** (2026-08-18, parziale dal 2026-08-14) · Riferimento: §13.5 funzionali

Il nome del vaso viene assegnato al pairing (§10.1.3) con un default `Vaso 1`,
`Vaso 2`. Chi accetta il default e poi arriva a tre o quattro vasi si trova un
elenco di nomi che non dicono nulla su quale sia quale.

**Comportamento richiesto:**
- Rinomina del vaso dall'elenco e dal dettaglio, senza passare dalle impostazioni.
- Riordino manuale dell'elenco tramite trascinamento, con l'ordine salvato sul profilo.
- Nell'elenco, sotto il nome, la **pianta collegata**: è l'informazione che permette
  di riconoscere il vaso fisico più del nome stesso — già presente, non serviva
  lavoro aggiuntivo.

**Fatto (2026-08-14):**
- Rinomina: già completa da prima (dettaglio vaso), estratta in un componente
  condiviso `src/components/RenameVaseModal.tsx` riusabile anche da altre schermate.
- Backend: campo `ordine Int @default(0)` su `SmartVase`, `reorderVases()` +
  `PATCH /vases/order` (verifica che la lista contenga esattamente tutti i vasi
  dell'utente, aggiorna in transazione), `listVases` ordina per `ordine` poi
  `createdAt`. Testato via typecheck e suite backend (159/159), non ancora tramite
  test dedicati (`vase.service.test.ts` non esiste ancora — da fare insieme a MEV-04).

**Da ripianificare — riordino lato mobile:** primo tentativo con
`react-native-draggable-flatlist` scartato (non supporta griglie 2 colonne, drag si
rompe, [bug noto upstream](https://github.com/computerjazz/react-native-draggable-flatlist/issues/567)).
Secondo tentativo con `react-native-draggable-grid` (installata poi rimossa) — la
schermata `app/(tabs)/vasi.tsx` è stata **riportata alla versione originale** (griglia
`FlatList` responsive, nessun drag) su richiesta esplicita per non bloccare le altre
MEV. Il backend resta pronto e inutilizzato: alla ripresa, valutare da capo l'approccio
UI (lista a colonna singola invece di griglia 2 colonne — più compatibile con le
librerie di drag disponibili — o un'altra libreria/soluzione custom).

---

## MEV-04 — Storico ambientale a 7 e 30 giorni

**Stato: 📋 da fare** · Riferimento: §11.2 funzionali

Oggi `GET /vases/:id/readings` restituisce le letture grezze delle ultime 24 ore e
l'app mostra una sparkline dell'umidità. Le specifiche prevedono anche le finestre a
7 e 30 giorni con dati aggregati.

**Comportamento richiesto:**
- Selettore 24 h / 7 giorni / 30 giorni nel dettaglio vaso.
- Grafici a linee per umidità, luce e temperatura.
- Dati **aggregati dal backend** (media oraria per 7 giorni, giornaliera per 30):
  un mese di campioni grezzi sono decine di migliaia di punti, inutili da trasmettere
  e impossibili da leggere su un grafico da telefono.

**Note:** TimescaleDB fa l'aggregazione in modo nativo con le *continuous aggregates*,
che mantengono le medite precalcolate invece di ricalcolarle a ogni apertura della
schermata. La retention resta a 90 giorni, quindi la finestra a 30 giorni è sempre
coperta.

---

## MEV-05 — Riconfigurazione WiFi senza ri-pairing

**Stato: ✅ completa e testata su hardware reale** (2026-08-14/18) · Riferimento: §10.4 funzionali, §6 tecniche

Se l'utente cambia rete o password WiFi, il vaso restava muto e l'unica via era
rimuoverlo e rifare il pairing da zero — perdendo l'associazione con la pianta.
Il firmware già gestiva il pulsante fisico (GPIO13, chiude anche il debito **D7**);
mancava la voce app e un modo di innescare lo stesso reset da remoto.

**Fatto:**
- Firmware: nessuna modifica necessaria, il comando MQTT `"reset"` sul topic
  `config` (già esistente, stesso meccanismo del `"check"` di refresh) e il pulsante
  GPIO13 chiamano entrambi `wipeWifiCredentials()` (solo `ssid`/`wifi_pass`, non
  `device_id`/credenziali MQTT) poi rientrano in BLE advertising.
- Backend: `POST /vases/:id/reset-wifi` (richiede vaso `connesso`, pubblica `"reset"`
  via `requestVaseWifiReset()` in `src/lib/mqtt.ts`) e `GET
  /vases/:id/reconnect-credentials` (stessa shape di `startPairing()` ma **senza**
  creare una nuova riga `smart_vases` — restituisce il `device_id` del vaso
  esistente, altrimenti il firmware lo sovrascriverebbe creando un vaso duplicato
  lato app).
- Mobile: dettaglio vaso → "Riconfigura WiFi" (sezione Gestione) → conferma
  (`ActionSheet`) → `resetVaseWifi()` → nuova schermata `app/vase/reconnect-wifi.tsx`
  (scan BLE → selezione device → nuove credenziali WiFi → verifica `stato:'connesso'`,
  stesso flusso di `vase/pair.tsx` ma **nessuna cancellazione del vaso sugli errori**:
  a differenza del primo pairing, qui il vaso esiste già e non va mai perso se il BLE
  fallisce). Meccanica BLE (permessi, scan, scrittura payload, encoder base64
  UTF-8-safe, traduzione errori) estratta in `src/lib/bleProvisioning.ts`, condivisa
  tra `pair.tsx` e `reconnect-wifi.tsx`.

**Note:** dipende dal ritorno automatico in advertising descritto in §6 tecniche
(già presente). Testato su hardware reale end-to-end (2026-08-18): nessuna riga
`smart_vases` duplicata dopo la riconnessione, pianta collegata e storico letture
intatti.

---

## MEV-06 — Empty state con suggerimenti

**Stato: 📋 da fare** · Riferimento: §2.2 funzionali (già specificato, mai implementato)

Un utente che completa l'onboarding senza aggiungere nulla trova una collezione
vuota. Le specifiche prevedono già una griglia di piante comuni suggerite con un
pulsante "Aggiungi" che le inserisce con i parametri precompilati: le dieci specie
dell'elenco in §2.2 sono tutte presenti nel catalogo curato.

**Note:** puramente mobile, nessuna modifica al backend. Era già prevista in Fase 10.

---

## MEV-07 — Esportazione dei dati utente

**Stato: 📋 da fare** · Nuovo

Il GDPR riconosce il diritto alla portabilità: l'utente deve poter ottenere una copia
dei propri dati in un formato leggibile da una macchina. Fiora oggi permette di
cancellare l'account ma non di estrarne i dati.

**Comportamento richiesto:**
- In Impostazioni → Profilo, "Esporta i miei dati".
- Il backend genera un archivio con piante, task, storico cure, letture dei sensori,
  foto del diario e dati del profilo, in JSON più le immagini.
- L'archivio arriva via email con un link a scadenza (dipende da **MEV-02**).

**Note:** generazione asincrona su coda BullMQ — per un account con mesi di letture
sensori l'operazione non è istantanea. Link a scadenza breve e a uso singolo, con le
stesse cautele dei token di MEV-02.

---

## MEV-08 — Soglie sensori personalizzabili per pianta + alert configurabili

**Stato: 🚧 in corso, a step** (avviata 2026-08-18) · Riferimento: §7 tecniche (Species),
§7.1/§13.3/§14 funzionali (Fase 7 alert, non ancora costruita)

**Decisioni prese (2026-08-18):**
- Campi soglia direttamente su `Plant` (non tabella separata) — coerente con
  `statoBouquetManuale`, query più semplici.
- Tutte e 3 le metriche che il vaso invia davvero: `umidita` (%), `luce` (lux,
  già numerica dal firmware — `sensors.cpp` genera float lux, nessun mapping
  categoria da inventare), `temperatura` (°C). Batteria esclusa: è salute del
  device, non un parametro di cura della pianta.
- Soglie disponibili **solo se `plant.vasoId` è valorizzato** — senza vaso non c'è
  nessuna lettura reale con cui confrontarle, niente soglie orfane in UI o DB.
- Reminder da valori inseriti manualmente per piante **senza** vaso è un meccanismo
  diverso (soglia-vs-tempo, non soglia-vs-sensore) — tenuto fuori, vedi **MEV-09**.
- **Step 1: solo soglie per-pianta**, nessuna generazione di alert — vedi
  raccomandazione sotto, resta valida.

**Step 1 — ✅ completo e testato (2026-08-18):**
- Migration: 6 campi nullable su `Plant` — `sogliaUmiditaMin/Max` (Int, %),
  `sogliaLuceMin/Max` (Int, lux), `sogliaTempMin/Max` (**Decimal(4,1)**, °C — non
  Int come nella stima iniziale: la temperatura reale ha un decimale, es. 18,5°C,
  scoperto in test dall'utente e corretto in una seconda migration lo stesso giorno).
- `PATCH /plants/:id` accetta i 6 campi, valida min≤max e richiede
  `plant.vasoId` valorizzato (`PLANT_NO_VASE` altrimenti); scollegare il vaso
  azzera automaticamente le soglie collegate.
- Mobile: `plant/[id].tsx` → "Personalizza soglie" (solo con vaso collegato) apre
  `SoglieVaseModal` (6 campi, vuoto = default specie, validazione min≤max lato
  client, reset). Campo temperatura accetta virgola o punto (tastiera IT).
- `plantUi.ts`: `umiditaStatus/Label`, `luceSensoreStatus/Label`,
  `temperaturaStatus/Label` generalizzati a soglia min+max con fallback a cascata
  pianta → specie → default hardcoded (30-70% umidità, 200 lux minimo luce).
- Corretti in corsa due problemi UX pre-esistenti scoperti testando questa MEV
  (non causati da essa, ma toccava già gli stessi file): `SensorTile` non
  mostrava il nome della metrica sopra valore/etichetta (aggiunto `title`); area
  di tocco del bottone "Personalizza soglie" non tap-friendly (ora
  `alignSelf:'flex-start'`, `minHeight:44`, feedback al tocco).
- **Causa del primo giro di test fallito**: non un bug di codice — il server
  `npm run dev` girava da prima della migration, quindi aveva il Prisma Client
  vecchio in memoria (ts-node-dev non ricarica moduli nativi). Promemoria per il
  prossimo intervento schema: dopo `prisma migrate dev`/`generate`, riavviare
  sempre il processo dev, non solo salvare i file.

### Problema

Le soglie che oggi guidano i tile umidità/luce/temperatura in `plant/[id].tsx`
(`sogliaUmidita`, `tempMin`, `tempMax`) vivono su **`Species`**, condivise da ogni
pianta di quella specie in ogni account. Due limiti concreti:

1. **Non sono per-pianta.** Un Pothos vicino a una finestra esposta e un Pothos in
   corridoio hanno la stessa soglia perché è la stessa specie — ma le condizioni reali
   e quindi il bisogno effettivo sono diversi. L'utente che osserva la propria pianta
   nel tempo spesso sa meglio del valore di catalogo cosa va bene per lei.
2. **Non esiste alcun alert.** Le soglie oggi servono solo a colorare un tile
   (verde/ambra) quando l'utente apre la schermata — nessuna notifica, nessun task
   generato. Le specifiche (§7.1/§14) prevedono già gli alert da sensore come task di
   sorgente `sensore` con gruppo rosso in cima alla schermata Oggi e push dedicate, ma
   è tutta la Fase 7, rimandata in blocco.

Questa MEV propone di anticipare **la parte di soglie configurabili dall'utente**,
tenendola distinta dalla generazione automatica di task/alert che resta in Fase 7 —
o, in alternativa, di costruire le due cose insieme. Vedi opzioni sotto.

### Cosa richiede, in ordine di complessità crescente

**1. Soglie per-pianta (invece che per-specie) — piccolo**
- Nuovi campi opzionali su `Plant` (o tabella `plant_sensor_config` separata, 1:1):
  `sogliaUmiditaMin`, `sogliaUmiditaMax`, `tempMin`, `tempMax`, `sogliaLuceMin`,
  `sogliaLuceMax` — tutti nullable. `null` = "usa il default della specie" (fallback
  a cascata, stesso pattern già in uso lato client con `?? 30` in `plantUi.ts`).
  Occorre spostare quel fallback lato backend se lo si vuole anche nella logica di
  alert (il client non basta più, un job server deve poter valutare la soglia senza
  aprire l'app).
- **Luce non ha oggi una soglia numerica** (`Species.luce` è categoria
  bassa/media/alta, non un range). Se si vogliono alert sulla luce serve prima
  decidere un range numerico per categoria (mapping fisso, es. lux) o lasciare la
  luce fuori dagli alert configurabili in questa MEV e coprire solo umidità e
  temperatura, che hanno già soglie numeriche.
- Mobile: form nel dettaglio vaso o pianta ("Personalizza soglie"), reset a
  "predefinito specie" con un tap. Piccolo, riusa pattern form già esistenti.
- **Stima:** 1 migrazione + 1-2 endpoint PATCH + 1 schermata form. Il pezzo più
  semplice di questa MEV, indipendente dal resto.

**2. Generazione di alert (task o notifica) — la parte grossa, è sostanzialmente Fase 7**
Qui la complessità sale perché tocca decisioni architetturali già rimandate apposta:
- **Chi valuta le soglie?** Oggi `handleTelemetry` (`src/lib/mqtt.ts`) scrive solo la
  lettura. Serve un controllo soglia ad ogni messaggio telemetria (o un job periodico
  come il reminder engine) che confronti `ultimaLettura` con le soglie effettive
  (per-pianta o fallback specie) e decida se generare un alert.
- **L'alert diventa un `Task`** (`sorgente:'sensore'`, come da specifiche) o una
  **notifica separata senza riga in `Task`**? Le specifiche scelgono la prima strada
  (coerente con "Oggi" come centro unico di tutto ciò che richiede attenzione), ma
  introduce un problema che il reminder engine calendario non ha: un sensore fuori
  soglia resta fuori soglia per ore/giorni continuativi, non è un evento singolo.
  Serve una regola di **debounce/cooldown** esplicita (es. "non ricreare lo stesso
  alert se ne esiste già uno pending per quella pianta+tipo, e non ri-notificare prima
  di N ore dall'ultimo") o si rischia una task/notifica ogni 30 minuti (intervallo di
  campionamento attuale del firmware) finché la pianta non torna in soglia.
- **Push:** infrastruttura già pronta (Expo, coda BullMQ, `pushToken`), template già
  scritti in specifiche (§14, righe "Alert umidità bassa"/"Alert temperatura") — questo
  pezzo è riuso puro, non lavoro nuovo.
- **UI Oggi:** il gruppo rosso "alert da sensore" è già disegnato nelle specifiche ma
  mai costruito nella schermata reale — va aggiunto lo stato/rendering, non solo il
  toggle impostazioni.
- **Toggle "Alert sensori"** in Impostazioni: già nominato nelle specifiche come
  mancante (§13.3), da costruire insieme (`User` ha già `pushToken`, serve un flag
  booleano separato tipo le altre preferenze notifiche).

### Stima complessiva

- **Solo soglie personalizzabili (punto 1), senza alert:** piccola, 1-2 sessioni,
  nessun rischio di debounce/duplicati perché non genera nulla in automatico — resta
  solo un'informazione più precisa mostrata all'utente quando apre l'app.
- **Soglie + alert (punto 1+2):** sostanzialmente equivale a fare la Fase 7, con la
  sola differenza che le soglie sono per-pianta invece che (esclusivamente) di
  catalogo — che è comunque un miglioramento della Fase 7, non un lavoro alternativo.
  Complessità media: nessun pezzo singolo è difficile, ma sono 4-5 decisioni
  concatenate (dove valutare la soglia, debounce, task vs notifica, rendering Oggi,
  toggle impostazioni) che vanno prese in ordine per non ricostruire pezzi.

### Raccomandazione

Separare esplicitamente in due rilasci: **MEV-08 = solo soglie per-pianta** (valore
immediato, rischio basso, sblocca comunque tile più accurati anche senza alert);
**Fase 7 = alert**, quando si decide di riprenderla, **usa le soglie per-pianta di
MEV-08** invece di quelle di specie — così il lavoro di MEV-08 non va rifatto e Fase 7
parte da un dato migliore. Evita di affrontare in un colpo solo sia lo storage delle
soglie sia il debounce/generazione alert, che sono la parte davvero delicata.

---

## MEV-09 — Dati di cura manuali per pianta (luce/annaffiatura/umidità)

**Stato: ✅ completo** (2026-08-18), da testare su device · Riferimento: `Species.luce/annaffiatura/umidita`

Emersa durante la discussione di MEV-08, poi implementata subito dopo (non solo
specificata): per piante **senza** vaso smart, il reminder engine calendario
(§3, `reminder.service.ts`) dipendeva finora esclusivamente da `Species` — una
pianta senza specie di catalogo non riceveva mai promemoria di annaffiatura.
Concettualmente diversa da MEV-08 (soglia-vs-lettura-sensore-reale): qui è
soglia-vs-tempo-trascorso, stesso meccanismo del reminder esistente ma con la
fonte del dato spostata da specie a pianta quando serve.

### Comportamento implementato

- **Pianta senza specie**: `luceCura`, `annaffiaturaCura`, `umiditaCura` diventano
  **obbligatorie** in fase di creazione e modifica (stesse categorie di `Species`:
  bassa/media/alta per luce e umidità, poca/media/frequente per annaffiatura).
  Senza, l'endpoint rifiuta con `PLANT_CURA_INCOMPLETA` (422).
- **Pianta con specie**: i 3 selettori sono **sempre visibili e già compilati**
  con il valore effettivo (override se presente, altrimenti quello della
  specie) — niente toggle "Personalizza" da aprire per vedere/modificare
  (rimosso dopo test utente: nascondeva un dato che si voleva vedere subito).
  Cambiare specie dal picker ripopola i 3 selettori con i nuovi default.
  Al salvataggio: se il valore scelto coincide col default della specie viene
  inviato `null` (nessun override sporco salvato); se diverso, l'override
  esplicito. La riga `Species` non viene mai toccata in nessun caso.
- **Bottone "Rimuovi specie"**: mancava in `add-plant.tsx` (presente solo in
  `edit-plant.tsx`) — una specie selezionata durante la creazione non era più
  deselezionabile. Aggiunto, azzera anche i 3 selettori cura.
- **Reminder engine**: `generateWateringReminders` e `ricalcolaScadenzeClima`
  (`reminder.service.ts`) leggono `plant.annaffiaturaCura ?? plant.species?.annaffiatura`
  — l'override vince quando presente. La query di eleggibilità non richiede più
  `speciesId non null`, ma `speciesId non null` **oppure** `annaffiaturaCura non null`.
- **Concimazione non toccata**: `generateFertilizingReminders` resta legata solo
  a `speciesId` — fuori scope, la richiesta riguardava luce/annaffiatura/umidità.
- **"Guida alla cura"** in `plant/[id].tsx` ora mostra il valore effettivo
  (override o specie) invece di nascondersi del tutto senza specie; badge
  "Personalizzata" quando la pianta non ha una specie collegata. La riga
  "Tossicità" resta visibile solo con specie (dato solo di catalogo, nessun
  equivalente manuale — fuori scope).

### Note di implementazione

- Migration: 3 campi nullable `VARCHAR(50)` su `Plant` (`luce_cura`,
  `annaffiatura_cura`, `umidita_cura`), nessuna riga `Species` creata — deciso
  esplicitamente di non riusare `Species.fonte='utente'` (pensato per Fase 9,
  proposta specie pubbliche con moderazione): questi valori sono privati per
  pianta, non un catalogo condiviso.
- Validazione obbligatorietà lato service (`assertCuraCompleta`), non a livello
  di colonna DB — le piante esistenti create prima di questa migration restano
  valide senza backfill.
- Mobile: nuovo componente condiviso `CuraPickerRow.tsx` (etichetta + riga di
  `Chip`), riusato identico in `add-plant.tsx` ed `edit-plant.tsx`.
- Test backend: 3 nuovi/modificati in `plant.service.test.ts` (crea con cura
  completa, rifiuta senza) e 2 nuovi in `reminder.service.test.ts` (genera da
  `annaffiaturaCura` senza specie, override vince su specie). 162/162 passano.
- **Non ancora testato su device reale** (solo typecheck + suite backend) —
  verificare form add/edit-plant, generazione reminder per pianta senza specie.

---

## Interventi valutati e scartati

**Notifiche push per vaso offline.** Sembra utile ma è già prevista in Fase 7 insieme
agli alert da sensore: farla prima significherebbe costruire due volte lo stesso
meccanismo di invio.

**Widget schermata home.** Rimandato: richiede sviluppo nativo separato per iOS e
Android, e il valore aggiunto rispetto alla notifica è modesto finché i promemoria
arrivano all'ora giusta (MEV-01).

**Condivisione della collezione fra utenti.** Fuori scope: cambierebbe il modello dei
permessi su tutte le risorse, che oggi assume un solo proprietario per pianta.
