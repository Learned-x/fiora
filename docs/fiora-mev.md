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
| **MEV-03** | Rinominare e riordinare i vasi | Con più vasi diventano indistinguibili | Mobile + backend minimo | 🚧 Media — rinomina fatta, riordino: backend pronto ma non esposto, UI mobile da ripianificare (vedi nota) |
| **MEV-04** | Storico ambientale a 7 e 30 giorni | Oggi solo 24 h non aggregate | Backend | Media |
| **MEV-05** | Riconfigurazione WiFi senza ri-pairing | Cambio rete o password rende il vaso muto | Firmware + mobile | ✅ completa (2026-08-14) |
| **MEV-06** | Empty state con suggerimenti | Prima schermata vuota per un utente nuovo | Mobile | Bassa |
| **MEV-07** | Esportazione dei dati utente | Obbligo GDPR alla portabilità | Backend | Bassa |

**Ordine consigliato:** MEV-02 → MEV-01 → MEV-03 → MEV-05 → MEV-04 → MEV-06 → MEV-07.
MEV-02 per prima perché è l'unica che oggi provoca una **perdita definitiva di accesso**;
MEV-01 subito dopo perché è la lamentela più probabile sulle notifiche.

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

**Stato: 🚧 parziale** (2026-08-14) · Riferimento: §13.5 funzionali

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

**Stato: ✅ completa** (2026-08-14) · Riferimento: §10.4 funzionali, §6 tecniche

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
(già presente). Non ancora testato su hardware reale end-to-end (verificare: nessuna
riga `smart_vases` duplicata dopo la riconnessione, pianta collegata e storico
letture intatti).

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

## Interventi valutati e scartati

**Notifiche push per vaso offline.** Sembra utile ma è già prevista in Fase 7 insieme
agli alert da sensore: farla prima significherebbe costruire due volte lo stesso
meccanismo di invio.

**Widget schermata home.** Rimandato: richiede sviluppo nativo separato per iOS e
Android, e il valore aggiunto rispetto alla notifica è modesto finché i promemoria
arrivano all'ora giusta (MEV-01).

**Condivisione della collezione fra utenti.** Fuori scope: cambierebbe il modello dei
permessi su tutte le risorse, che oggi assume un solo proprietario per pianta.
