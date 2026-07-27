# 🌿 Fiora — Specifiche funzionali
 
**Versione 2.0 · aggiornato al 2026-07-27**
 
Documento unico del comportamento funzionale dell'app. Incorpora le "Integrazioni
alle specifiche" del 2026-07-08 e le decisioni prese fino al 2026-07-27; il documento
delta separato non esiste più.
 
Documenti collegati:
- **`fiora-specifiche-tecniche.md`** — come è implementato (schema DB, API, MQTT, firmware).
- **`fiora-roadmap.md`** — fasi di sviluppo, stato di avanzamento e debito noto.
- **`fiora-manuale-ambienti.md`** — setup di development, staging e produzione.
- **`fiora-mev.md`** — manutenzione evolutiva pianificata per le prossime versioni.
- **`archivio/fiora-plant-spec.md`** — visione futura del catalogo botanico (non pianificata).
 
### Come leggere lo stato delle funzioni
 
Ogni sezione riporta un marcatore di stato:
 
| Marcatore | Significato |
|---|---|
| ✅ | Implementato e funzionante |
| 🚧 | Implementato parzialmente — le differenze sono indicate nella sezione |
| 📋 | Specificato, non ancora implementato (fase indicata) |
 
Il marcatore descrive **lo stato del codice**, non la validità della specifica: una
sezione 📋 resta il comportamento atteso a cui il codice dovrà conformarsi.
 
---
 
## Indice
 
1. [Autenticazione e account](#1-autenticazione-e-account)
2. [Onboarding](#2-onboarding)
3. [Collezione — schermata principale](#3-collezione--schermata-principale)
4. [Aggiunta pianta](#4-aggiunta-pianta)
5. [Aggiunta bouquet](#5-aggiunta-bouquet)
6. [Dettaglio pianta](#6-dettaglio-pianta)
7. [Dettaglio bouquet](#7-dettaglio-bouquet)
8. [Schermata Oggi](#8-schermata-oggi)
9. [Gestione task](#9-gestione-task)
10. [Vaso smart — pairing e gestione](#10-vaso-smart--pairing-e-gestione)
11. [Storico cure e diario fotografico](#11-storico-cure-e-diario-fotografico)
12. [Catalogo specie](#12-catalogo-specie)
13. [Impostazioni](#13-impostazioni)
14. [Area admin — moderazione specie](#14-area-admin--moderazione-specie)
15. [Notifiche](#15-notifiche)
16. [Gestione stati e ciclo di vita](#16-gestione-stati-e-ciclo-di-vita)
---
 
## Convenzioni
 
Ogni funzione è descritta con:
 
- **Descrizione** — cosa fa
- **Attori** — chi la usa
- **Precondizioni** — cosa deve essere vero prima che la funzione possa essere eseguita
- **Flusso principale** — il percorso normale
- **Flussi alternativi** — varianti e casi limite
- **Postcondizioni** — cosa è vero dopo l'esecuzione
- **Errori** — cosa succede se qualcosa va storto
- **Note** — dettagli implementativi rilevanti
---
 
## 1. Autenticazione e account
 
**Stato: ✅** — email/password, Google e grace period implementati. Apple Sign-In è
pronto lato backend ma il bottone mobile è un placeholder: mancano le credenziali
Apple Developer (§1.4, rinviato a Fase 10).
 
### 1.1 Registrazione con email e password
 
**Descrizione:** L'utente crea un nuovo account Fiora con email e password.
 
**Attori:** Utente non autenticato.
 
**Precondizioni:** L'utente non ha già un account con la stessa email.
 
**Flusso principale:**
1. L'utente inserisce email e password.
2. Il backend valida il formato email e la lunghezza minima della password (8 caratteri).
3. Il backend verifica che l'email non sia già registrata.
4. Il backend salva l'utente con password hashata (bcrypt, cost factor 12).
5. Il backend genera access token (JWT, 15 min) e refresh token (30 giorni).
6. L'app salva i token in SecureStore e porta l'utente all'onboarding.
**Flussi alternativi:**
- Email già registrata → errore `AUTH_EMAIL_ALREADY_EXISTS`, suggerisce login.
- Email con formato non valido → errore di validazione inline sul campo.
- Password troppo corta → errore di validazione inline sul campo.
**Postcondizioni:** Utente creato nel DB, autenticato, portato all'onboarding.
 
**Errori:** `AUTH_EMAIL_ALREADY_EXISTS`, `VALIDATION_ERROR`.
 
---
 
### 1.2 Login con email e password
 
**Descrizione:** L'utente accede al proprio account esistente.
 
**Attori:** Utente non autenticato.
 
**Precondizioni:** L'utente ha già un account con email e password.
 
**Flusso principale:**
1. L'utente inserisce email e password.
2. Il backend cerca l'utente per email.
3. Il backend verifica la password con bcrypt.
4. Il backend genera nuovi access token e refresh token.
5. L'app salva i token e porta l'utente alla schermata principale.
**Flussi alternativi:**
- Email non trovata o password errata → errore generico `AUTH_INVALID_CREDENTIALS` (non specificare quale dei due è sbagliato).
- **Account in periodo di grazia** (eliminazione richiesta) → **il login riesce comunque**.
  La risposta include un oggetto `graceperiod { active, deletedAt, giorniRimanenti }`
  e l'app mostra un banner con l'azione "Annulla eliminazione".
  Il codice di errore `AUTH_ACCOUNT_DELETED` è stato rimosso: bloccare il login
  impediva all'utente proprio l'azione di recupero che il periodo di grazia esiste per offrire.
**Postcondizioni:** Utente autenticato, token salvati.
 
**Errori:** `AUTH_INVALID_CREDENTIALS`.
 
**Note:** Dopo 5 tentativi falliti consecutivi dalla stessa IP, aggiungere un delay di 30 secondi prima di accettare nuovi tentativi (rate limiting).
 
---
 
### 1.3 Login con Google
 
**Descrizione:** L'utente accede o si registra tramite account Google.
 
**Attori:** Utente non autenticato.
 
**Flusso principale:**
1. L'app avvia il flusso OAuth Google tramite Expo AuthSession.
2. Google restituisce un ID token all'app.
3. L'app invia l'ID token al backend (`POST /auth/oauth/google`).
4. Il backend verifica il token con le API Google.
5. Se l'utente non esiste: viene creato con `provider=google`.
6. Se l'utente esiste: viene aggiornato `last_login`.
7. Il backend genera access token e refresh token.
8. Se è il primo accesso → onboarding. Altrimenti → schermata principale.
**Flussi alternativi:**
- Token Google non valido o scaduto → errore `AUTH_OAUTH_FAILED`.
- L'utente ha già un account email con la stessa email Google → collega i due account, avvisa l'utente.
**Postcondizioni:** Utente autenticato, eventualmente creato.
 
**Errori:** `AUTH_OAUTH_FAILED`.
 
---
 
### 1.4 Login con Apple
 
**Descrizione:** L'utente accede o si registra tramite Apple ID. Obbligatorio per App Store iOS.
 
**Attori:** Utente non autenticato.
 
**Flusso principale:**
1. L'app avvia il flusso Sign in with Apple tramite Expo Apple Authentication.
2. Apple restituisce un authorization code e un identity token.
3. L'app invia i dati al backend (`POST /auth/oauth/apple`).
4. Il backend verifica il token con i certificati Apple.
5. Se è il primo accesso: Apple fornisce nome ed email (solo la prima volta).
6. Utente creato o recuperato, token generati, flusso identico al 1.3.
**Flussi alternativi:**
- Apple può nascondere l'email reale → usare la email proxy fornita da Apple, salvata normalmente.
- Token non valido → errore `AUTH_OAUTH_FAILED`.
**Note:** Apple fornisce nome ed email solo al primo login. Salvarli immediatamente perché non saranno più disponibili nelle chiamate successive.
 
---
 
### 1.5 Rinnovo access token
 
**Descrizione:** L'app rinnova automaticamente l'access token scaduto usando il refresh token.
 
**Attori:** App mobile (automatico, invisibile all'utente).
 
**Precondizioni:** L'utente ha un refresh token valido e non scaduto.
 
**Flusso principale:**
1. Una richiesta API fallisce con `401 AUTH_TOKEN_EXPIRED`.
2. L'interceptor Axios intercetta l'errore.
3. L'app chiama `POST /auth/refresh` con il refresh token.
4. Il backend verifica il refresh token, lo invalida e ne genera uno nuovo.
5. Il backend genera un nuovo access token.
6. L'interceptor ripete la richiesta originale con il nuovo access token.
**Flussi alternativi:**
- Refresh token scaduto o non valido → logout forzato, utente portato alla schermata di login.
- Più richieste falliscono contemporaneamente → una sola chiamata di refresh (queue delle richieste in attesa).
**Postcondizioni:** Nuovi token salvati, richiesta originale completata.
 
**Errori:** `AUTH_REFRESH_TOKEN_INVALID`, `AUTH_REFRESH_TOKEN_EXPIRED`.
 
---
 
### 1.6 Logout
 
**Descrizione:** L'utente termina la sessione corrente.
 
**Attori:** Utente autenticato.
 
**Flusso principale:**
1. L'utente tocca "Esci" nelle impostazioni.
2. L'app chiama `POST /auth/logout` con il refresh token.
3. Il backend invalida il refresh token nel DB.
4. L'app cancella i token da SecureStore.
5. L'app porta l'utente alla schermata di login.
**Postcondizioni:** Refresh token invalidato, sessione terminata.
 
---
 
### 1.7 Eliminazione account
 
**Descrizione:** L'utente richiede la cancellazione definitiva del proprio account e di tutti i dati.
 
**Attori:** Utente autenticato.
 
**Flusso principale:**
1. L'utente tocca "Elimina account" nelle impostazioni.
2. L'app mostra una schermata di conferma con spiegazione del periodo di grazia (30 giorni).
3. L'utente conferma digitando "ELIMINA".
4. Il backend imposta `deleted_at = NOW() + 30 giorni`.
5. Il backend schedula un job BullMQ per l'eliminazione definitiva.
6. L'utente viene disconnesso.
**Flusso alternativo — annullamento entro 30 giorni:**
1. L'utente accede di nuovo all'app (il login non è bloccato, vedi §1.2).
2. L'app rileva `graceperiod.active` e mostra un banner di recupero.
3. L'utente tocca "Annulla eliminazione".
4. Il backend azzera `deleted_at` e cancella il job schedulato.
**Job di eliminazione definitiva (dopo 30 giorni):**
1. Elimina tutte le foto da MinIO.
2. Elimina i dati sensori da TimescaleDB.
3. Elimina piante, task, storico, diario.
4. Elimina l'utente dal DB (cascade).
5. Revoca le credenziali MQTT di tutti i vasi associati (**solo produzione** — in dev
   e staging le credenziali MQTT sono condivise fra tutti i vasi e non sono revocabili
   singolarmente, vedi specifiche tecniche §6).
**Postcondizioni:** Account e tutti i dati eliminati irreversibilmente.
 
**Note — email transazionali:** la versione 1.0 di questo documento prevedeva un'email
di conferma con link di annullamento. Nessun servizio email è presente nello stack:
il recupero è interamente in-app tramite il banner al login. Le email transazionali
sono rinviate a post-MVP (Resend o SES + job BullMQ dedicato).
 
---
 
## 2. Onboarding
 
**Stato: ✅** (ordine invertito il 2026-07-13) — l'empty state con suggerimenti (§2.2) è 📋, Fase 10.
 
### 2.1 Flusso onboarding primo accesso
 
**Descrizione:** Sequenza guidata per configurare l'app al primo utilizzo.
 
**Attori:** Utente al primo avvio dell'app.
 
**Precondizioni:** È il primo accesso dell'utente (`onboardingDone = false`).
 
**Flusso principale:**
1. **Step 1 — Intro:** 3 slide di presentazione pre-autenticazione (`app/(auth)/index.tsx`).
2. **Step 2 — Autenticazione:** L'utente sceglie il metodo di accesso (email, Google) o si registra.
3. **Step 3 — Clima:** *dopo* l'autenticazione, l'utente seleziona il proprio clima tra le
   opzioni caricate dinamicamente dal DB, mostrate con nome e descrizione geografica di esempio.
   La scelta viene salvata subito sul backend (`PATCH /users/me`), non tenuta in stato locale.
4. **Step 4 — Permessi notifiche:** viene richiesto il permesso push a fine onboarding.
5. **Step 5 — Prima pianta:** L'app propone di aggiungere subito la prima pianta o il primo bouquet. L'utente può anche saltare.
**Flussi alternativi:**
- L'utente salta tutto → va alla schermata principale con empty state.
- L'utente ha un vaso smart → dopo lo step 5, viene proposto il flusso di pairing (opzionale, può essere fatto dopo).
**Postcondizioni:** Preferenze utente salvate, onboarding marcato come completato (`onboardingDone = true`).
 
**Ordine clima ↔ autenticazione (decisione 2026-07-13):** nella versione 1.0 il clima veniva
chiesto *prima* del login e tenuto in uno stato locale `pendingClima` in attesa di un utente
a cui associarlo. L'ordine è stato invertito — prima si autentica, poi si configura — così la
preferenza ha sempre un profilo su cui essere salvata e `pendingClima` è stato eliminato.
 
**Note:**
- Il tipo di elemento (pianta o bouquet) viene scelto al momento dell'aggiunta, non durante l'onboarding.
- L'onboarding non viene mai riproposto dopo il completamento, anche se l'utente non ha aggiunto nulla.
- Gli utenti registrati prima di questa modifica hanno `onboardingDone = false` e vedono
  la schermata clima una sola volta al login successivo.
- Il gate su `onboardingDone` è **soft**: se il profilo non è caricabile (es. offline)
  l'utente entra comunque nell'app invece di restare bloccato sull'onboarding.
 
---
 
### 2.2 Empty state — primo accesso senza piante
 
**Descrizione:** Se l'utente non aggiunge nulla durante l'onboarding, la schermata principale mostra suggerimenti rapidi invece di essere vuota.
 
**Flusso:**
1. La schermata principale rileva che non ci sono piante attive.
2. Mostra una griglia di piante comuni suggerite, attinte dal catalogo curato interno.
3. Ogni card mostra foto, nome comune e un pulsante "Aggiungi".
4. Toccando "Aggiungi", la pianta viene aggiunta alla collezione con parametri precompilati.
5. L'utente può anche toccare "Aggiungi manualmente" per inserire una pianta personalizzata.
**Piante suggerite nell'empty state:**
- Pothos (Epipremnum aureum)
- Sansevieria (Dracaena trifasciata)
- Monstera deliciosa
- Orchidea Phalaenopsis
- Ficus benjamina
- Aloe vera
- Calathea
- Zamioculcas
- Edera (Hedera helix)
- Lavanda (solo se clima esterno/balcone)
---
 
## 3. Collezione — schermata principale
 
**Stato: 🚧** — griglia, filtri tipo/stato e badge prossimo task ✅. Mancano:
ordinamento "per prossima azione" e filtro "con vaso smart" (📋 Fase 6, richiedono i vasi).
La cache locale SQLite è fuori scope MVP (vedi nota a fine §3.1).
 
### 3.1 Visualizzazione collezione
 
**Descrizione:** Schermata principale che mostra tutte le piante e i bouquet attivi dell'utente.
 
**Attori:** Utente autenticato.
 
**Precondizioni:** L'utente ha almeno una pianta o bouquet attivo.
 
**Flusso principale:**
1. L'app carica le piante attive dell'utente dal backend.
2. Le mostra come griglia di card, ognuna con:
   - Foto (o placeholder se non presente)
   - Nome personalizzato
   - Specie (se associata)
   - Prossimo task in scadenza (etichetta già elaborata dal backend)
   - Indicatore stato vaso smart se connesso (icona colorata in base allo stato `ok`/`warning`/`critical`)
3. In cima alla schermata, un banner mostra il numero di task da completare oggi se > 0.
**Filtri disponibili (elaborati dal backend):**
- Tutti (default)
- Solo piante
- Solo bouquet
- Con vaso smart
**Ordinamento disponibile:**
- Per prossima azione (default)
- Per nome A→Z
**Flussi alternativi:**
- Nessuna pianta attiva → empty state (sezione 2.2).
- Errore di rete → messaggio di errore con pull-to-refresh per riprovare.
**Postcondizioni:** Lista aggiornata mostrata all'utente.
 
**Nota — cache offline (decisione 2026-07-08):** la versione 1.0 prevedeva una cache
locale SQLite con banner "Dati non aggiornati" qui e in §8.1. È **fuori scope MVP**:
per il prototipo bastano pull-to-refresh e messaggi di errore di rete. Se rientrerà,
sarà con `expo-sqlite` e strategia stale-while-revalidate in una fase dedicata post-MVP.
 
---
 
### 3.2 Accesso all'archivio
 
**Descrizione:** L'utente visualizza le piante e i bouquet archiviati.
 
**Flusso principale:**
1. L'utente tocca "Archivio" nella collezione (link o tab secondario).
2. L'app carica la lista delle piante archiviate.
3. Ogni elemento mostra nome, specie e data di archiviazione.
4. Dall'archivio è possibile ripristinare o eliminare definitivamente.
---
 
## 4. Aggiunta pianta
 
**Stato: 🚧** — creazione con specie, posizione e parametri manuali ✅.
La foto è 📋 (Fase 5, MinIO): il campo esiste nello schema ma l'upload non è implementato.
 
### 4.1 Aggiunta pianta con specie dal catalogo
 
**Descrizione:** L'utente aggiunge una nuova pianta associandola a una specie del catalogo.
 
**Attori:** Utente autenticato.
 
**Precondizioni:** Nessuna.
 
**Flusso principale:**
1. L'utente tocca "+" nella collezione.
2. Sceglie il tipo: **Pianta** (singola) o **Bouquet** (può contenere più piante/fiori).
3. Inserisce un nome libero (es. "La mia Monstera").
4. Cerca e seleziona la specie dal catalogo. I nomi vengono mostrati con:
   - **Nome principale:** nome comune in italiano
   - **Sottotitolo:** nome scientifico in latino (visibile se abilitato nelle impostazioni — default: visibile)
5. Il backend precompila i parametri di cura in base alla specie e al clima dell'utente.
6. L'utente indica la posizione in casa, scelta da una lista dinamica caricata dal DB (es. Soggiorno, Camera, Cucina, Balcone, Studio…).
7. L'utente opzionalmente:
   - Aggiunge una foto (dalla galleria o fotocamera)
   - Associa un vaso smart (avvia pairing se non già configurato)
8. L'utente tocca "Salva".
9. Il backend crea la pianta, genera i reminder iniziali in base a specie e clima.
10. L'app torna alla collezione con la nuova pianta visibile.
**Flussi alternativi:**
- Specie non trovata nel catalogo → offre "Aggiungi specie mancante" (sezione 12.3) o continua con pianta generica.
- Foto non aggiunta → la pianta usa un'immagine placeholder in base alla categoria.
**Postcondizioni:** Pianta creata nel DB, reminder pianificati, pianta visibile nella collezione.
 
**Errori:** `VALIDATION_ERROR` (nome mancante), `SPECIES_NOT_FOUND`, `STORAGE_ERROR` (upload foto fallito).
 
#### Intervallo di annaffiatura — specie × clima
 
L'intervallo base deriva dal campo `annaffiatura` della specie e viene moltiplicato
per il fattore del clima dell'utente:
 
| `Species.annaffiatura` | Intervallo base |
|---|---|
| frequente | 2 giorni |
| media | 5 giorni |
| poca | 10 giorni |
 
| Clima utente | Fattore |
|---|---|
| freddo | ×1,3 |
| temperato | ×1,0 |
| appartamento | ×1,0 |
| mediterraneo | ×0,8 |
| tropicale | ×0,7 |
 
Risultato arrotondato, **minimo 1 giorno**. Al cambio del clima in Impostazioni le
scadenze pending vengono ricalcolate (§13.1).
 
Questi valori non erano definiti in nessun documento della v1.0 e sono stati adottati
il 2026-07-08: vanno considerati **parametri di prodotto tarabili**, non costanti
definitive. Vivono come costanti nel backend e non in `app_options` — quella tabella
serve a popolare le tendine dell'interfaccia, non a guidare la logica dei reminder.
 
---
 
### 4.2 Aggiunta pianta generica (senza specie)
 
**Descrizione:** L'utente aggiunge una pianta senza associarla a una specie del catalogo, impostando i parametri manualmente.
 
**Flusso principale:**
1. Flusso identico a 4.1 fino allo step 4.
2. L'utente salta la selezione specie o tocca "Pianta generica".
3. Vengono mostrati i campi manuali:
   - Luce consigliata (bassa / media / alta)
   - Frequenza annaffiatura (poca / media / frequente)
   - Note di cura libere
4. Il backend genera reminder con frequenze di default basate sui parametri inseriti.
**Postcondizioni:** Pianta generica creata, reminder pianificati con parametri manuali.
 
---
 
## 5. Aggiunta bouquet
 
**Stato: ✅** — creazione, checkbox "già in acqua", reminder ricorrenti e stato automatico
implementati in Fase 4.5. I "fiori nel bouquet" (chips con i nomi dei fiori contenuti)
sono 📋 Fase 10: previsti dal wireframe, mai specificati nella v1.0 e assenti dallo schema.
Se entreranno, come campo `fioriBouquet String[]` su Plant (lista di nomi liberi).
 
### 5.1 Aggiunta bouquet
 
**Descrizione:** L'utente aggiunge un bouquet ricevuto per tracciarne la cura.
 
**Attori:** Utente autenticato.
 
**Flusso principale:**
1. L'utente tocca "+" nella collezione e sceglie "Bouquet".
2. Inserisce un nome (es. "Bouquet compleanno").
3. Inserisce la data di ricezione (default: oggi).
4. Aggiunge opzionalmente una foto.
5. Conferma che il bouquet è già in acqua (checkbox).
6. Tocca "Salva".
7. L'app mostra immediatamente una **checklist iniziale** con le azioni consigliate:
   - Tagliare gli steli in diagonale
   - Rimuovere le foglie sotto il livello dell'acqua
   - Aggiungere il nutrimento se disponibile
   - Tenere lontano da fonti di calore e luce diretta
8. L'utente completa o ignora la checklist.
9. Il backend genera i reminder ricorrenti: cambio acqua ogni 2 giorni, controllo stato ogni giorno.
10. Il bouquet appare nella collezione con stato "Fresco".
**Flussi alternativi:**
- Bouquet non ancora in acqua (checkbox non spuntato) → il primo reminder è immediato: "Metti il bouquet in acqua".
**Postcondizioni:** Bouquet creato, checklist iniziale mostrata, reminder pianificati.
 
---
 
## 6. Dettaglio pianta
 
**Stato: 🚧** — header, guida specie, task, storico cure, sezione "Vaso smart" con i tre
valori ambientali e la sparkline umidità 24h sono ✅. Il **diario foto** è 📋 Fase 5.
 
### 6.1 Visualizzazione scheda dettaglio pianta
 
**Descrizione:** Schermata completa con tutte le informazioni e le azioni disponibili per una pianta.
 
**Attori:** Utente autenticato, proprietario della pianta.
 
**Flusso principale:**
1. L'utente tocca una card nella collezione.
2. L'app carica il dettaglio della pianta dal backend.
3. La schermata mostra:
   **Header:**
   - Foto pianta (o placeholder)
   - Nome personalizzato
   - Specie (nome comune + nome scientifico se disponibile)
   - Stato connessione vaso smart (se associato)
   **Sezione dati ambientali (solo se vaso smart connesso):**
   - Umidità suolo: valore + etichetta + indicatore colorato
   - Luce ambientale: valore + etichetta + indicatore colorato
   - Temperatura: valore + etichetta + indicatore colorato
   - Livello batteria vaso
   - Timestamp ultima lettura
   **Sezione cure:**
   - Prossimo task in scadenza con etichetta leggibile (es. "Annaffia tra 2 giorni")
   - Lista task pendenti per questa pianta
   - Accesso allo storico cure
   **Sezione guida specie:**
   - Luce consigliata (etichetta)
   - Frequenza annaffiatura (etichetta, modulata per clima o sensore)
   - Indicazioni concime
   - Temperatura da evitare
   - Tossicità (se disponibile)
   **Diario foto:**
   - Ultime 3 foto con data
   - Link a timeline completa
4. Azioni disponibili dal menu contestuale:
   - Modifica pianta
   - Aggiungi foto
   - Associa/dissocia vaso smart
   - Archivia
   - Elimina
**Flussi alternativi:**
- Vaso smart disconnesso → sezione dati ambientali mostra "Vaso disconnesso" e l'ultima lettura disponibile con timestamp.
- Specie generica (senza catalogo) → sezione guida mostra solo i parametri inseriti manualmente.
---
 
### 6.2 Modifica pianta
 
**Descrizione:** L'utente modifica i dati di una pianta esistente.
 
**Flusso principale:**
1. L'utente tocca "Modifica" dal dettaglio pianta.
2. Vengono mostrati i campi editabili: nome, foto, posizione, specie, parametri manuali (se generica).
3. L'utente modifica e salva.
4. Il backend aggiorna la pianta e, se la specie è cambiata, ricalcola i reminder.
**Note:** La modifica della specie ricalcola le frequenze dei reminder futuri ma non modifica i task già esistenti e completati.
 
---
 
## 7. Dettaglio bouquet
 
### 7.1 Visualizzazione scheda dettaglio bouquet
 
**Descrizione:** Schermata con le informazioni e le azioni per un bouquet.
 
**Flusso principale:**
1. L'utente tocca un bouquet nella collezione.
2. La schermata mostra:
   **Header:**
   - Foto bouquet
   - Nome
   - Data ricezione
   - Giorni trascorsi dalla ricezione (calcolati dal backend)
   - Stato sintetico: Fresco / In cura / Appassendo / Concluso
   **Sezione task:**
   - Prossimo task (es. "Cambia l'acqua oggi")
   - Lista task pendenti
   **Guida pratica:**
   - Come tagliare gli steli
   - Quando cambiare l'acqua
   - Dove tenere il bouquet
   - Cosa evitare
3. Azioni disponibili:
   - Aggiorna stato sintetico manualmente
   - Aggiungi foto
   - Archivia / Elimina
**Stato sintetico automatico (calcolato dal backend in base ai giorni trascorsi):**
 
| Giorni | Stato suggerito |
|---|---|
| 0–2 | Fresco |
| 3–6 | In cura |
| 7–10 | Appassendo |
| > 10 | Concluso |
 
L'utente può sempre sovrascrivere lo stato manualmente. In quel caso viene alzato il
flag `statoBouquetManuale` e **il calcolo automatico si ferma definitivamente** per quel
bouquet: da lì in poi lo stato è solo quello scelto dall'utente. Non esiste un modo per
riattivare l'automatismo (fuori scope: la scelta esplicita dell'utente ha la precedenza
e il bouquet ha comunque vita breve).
 
**Flusso "Concluso":**
Quando il bouquet viene marcato come Concluso (manualmente o automaticamente), l'app propone: "Vuoi archiviare o eliminare questo bouquet?" con due pulsanti. L'utente sceglie o rimanda.
 
---
 
## 8. Schermata Oggi
 
**Stato: 🚧** — lista task, raggruppamento, azioni rapide e indicatore "in ritardo" ✅.
Il **primo gruppo (alert da sensore)** è 📋 Fase 7: la schermata lo prevede già come
gruppo rosso, ma nessun task di sorgente `sensore` viene ancora generato.
 
### 8.1 Visualizzazione task del giorno
 
**Descrizione:** Centro operativo dell'app. Mostra tutti i task da completare oggi, raggruppati per pianta, con priorità agli alert da sensore.
 
**Attori:** Utente autenticato.
 
**Flusso principale:**
1. L'utente apre la schermata "Oggi".
2. Il backend restituisce la lista dei task del giorno, già ordinata e prioritizzata:
   - **Primo gruppo:** Alert da sensore (urgenti, indicatore rosso) — es. "Pothos: terreno troppo asciutto"
   - **Secondo gruppo:** Task in scadenza oggi da calendario
   - **Terzo gruppo:** Task rimandati da giorni precedenti
3. Ogni task mostra:
   - Nome della pianta
   - Tipo di azione (etichetta leggibile)
   - Sorgente (sensore o calendario — icona diversa)
   - Tre azioni rapide: Completa ✓ / Rimanda ⏱ / Salta ✗
4. Se non ci sono task → messaggio positivo "Tutto a posto oggi!"
**Flussi alternativi:**
- Notifiche push disabilitate → i task sono comunque tutti visibili qui.
- Alert da sensore senza app aperta → mostrati come badge o banner all'apertura.
- Nessuna connessione → messaggio di errore con pull-to-refresh (vedi nota cache offline in §3.1).
**Postcondizioni:** Nessuna modifica di stato fino a quando l'utente non agisce su un task.
 
**Flag "in ritardo":** un task `pending` con scadenza superata da più di 3 giorni viene
marcato in ritardo e mostrato con indicatore arancione. È un **campo derivato** calcolato
dal backend e presente in ogni risposta task, non un nuovo stato salvato sul record.
 
---
 
## 9. Gestione task
 
**Stato: ✅** — completa/rimanda/salta con action log implementati.
 
**Tipi di task (`TASK_TYPES`):** `annaffiatura`, `concimazione`, `nebulizzazione`,
`rinvaso`, `rotazione`, `pulizia_foglie`, `cambio_acqua`, `taglio_steli`, `controllo_stato`.
Il tipo `controllo` della v1.0 è **deprecato** in favore di `controllo_stato`.
 
### 9.1 Completamento task
 
**Descrizione:** L'utente segna un task come completato.
 
**Flusso principale:**
1. L'utente tocca ✓ su un task.
2. Il task scompare dalla schermata Oggi con animazione.
3. Il backend aggiorna `stato = 'completato'`, `completato_a = NOW()`.
4. Il backend aggiunge una voce al log azioni della pianta.
5. Il backend pianifica il prossimo reminder per lo stesso tipo di task.
**Postcondizioni:** Task completato, storico aggiornato, prossimo reminder pianificato.
 
---
 
### 9.2 Rimanda task
 
**Descrizione:** L'utente posticipa un task che non riesce a completare ora.
 
**Flusso principale:**
1. L'utente tocca ⏱ su un task.
2. L'app mostra le opzioni: "Tra 2 ore", "Domani", "Tra 2 giorni".
3. L'utente sceglie.
4. Il backend valida la nuova scadenza e aggiorna la `scadenza` del task.
5. Il task scompare dalla schermata Oggi e riapparirà alla nuova scadenza.
**Flussi alternativi:**
- Scadenza richiesta nel passato → il backend rifiuta con `TASK_SCADENZA_PASSATA`.
  Rimandare a ieri non ha significato e riporterebbe il task in "Oggi" già in ritardo.
**Note:** Un task pending con scadenza superata da più di 3 giorni viene marcato come
"in ritardo" e mostrato con indicatore arancione (vedi §8.1).
 
---
 
### 9.3 Salta task
 
**Descrizione:** L'utente ignora un task senza completarlo.
 
**Flusso principale:**
1. L'utente tocca ✗ su un task.
2. Il backend aggiorna `stato = 'saltato'`.
3. Il backend pianifica il prossimo reminder normalmente (come se fosse stato completato).
4. Il task viene rimosso dalla schermata Oggi.
**Note:** I task saltati sono visibili nello storico con indicatore diverso dai completati.
 
---
 
### 9.4 Aggiunta task manuale
 
**Descrizione:** L'utente aggiunge un task personalizzato per una pianta.
 
**Flusso principale:**
1. L'utente va nel dettaglio pianta e tocca "Aggiungi cura".
2. Sceglie il tipo di task dall'elenco o inserisce un testo libero.
3. Imposta la data/ora.
4. Salva.
5. Il task appare nella schermata Oggi alla data impostata.
---
 
### 9.5 Generazione automatica dei task (reminder engine)
 
**Descrizione:** Regole con cui il backend genera da solo i task ricorrenti. Gira una
volta al giorno (job schedulato alle 6:00) e non richiede nessuna azione dell'utente.
 
**Regole per tipo:**
 
| Tipo | Quando viene generato | A chi si applica |
|---|---|---|
| `annaffiatura` | Intervallo specie × fattore clima (§4.1) | Piante attive **con specie collegata** |
| `concimazione` | Ogni 30 giorni, **solo da marzo a ottobre** | Piante attive con specie |
| `cambio_acqua` | Ogni 2 giorni | Bouquet attivi |
| `controllo_stato` | Ogni giorno | Bouquet attivi |
 
**Riferimento per il calcolo della scadenza:** `completatoA ?? createdAt` dell'ultimo task
dello stesso tipo; se non esiste storico, `plant.createdAt`. Se esiste già un task pending
dello stesso tipo **non ne viene creato un altro** (nessun duplicato in coda).
 
**Esclusioni:**
- Piante **senza specie collegata**: non hanno parametri da cui derivare un intervallo.
- Piante e bouquet **archiviati o eliminati**: la generazione è sospesa (§16.1).
- La concimazione è **sospesa nei mesi invernali** (novembre–febbraio): la pianta è in riposo vegetativo.
 
**Bouquet — stato automatico:** allo stesso giro il backend aggiorna lo stato sintetico
del bouquet dai giorni trascorsi dalla ricezione (tabella in §7.1), a meno che l'utente
non l'abbia impostato a mano (`statoBouquetManuale`). Al passaggio a *Concluso* la
generazione dei task si ferma e l'app propone archivia/elimina.
 
**Bouquet — task iniziale:** alla creazione, se la checkbox "già in acqua" **non** è
spuntata, viene creato subito un task `cambio_acqua` ("Metti il bouquet in acqua").
 
**Alert da sensore:** 📋 Fase 7. I task di sorgente `sensore` non sono ancora generati;
oggi tutti i task hanno sorgente `calendario` o `manuale`.
 
---
 
## 10. Vaso smart — pairing e gestione
 
**Stato: 🚧 Fase 6 in corso.** Pairing BLE, lista vasi, dettaglio vaso, dati sensori e
collega/scollega pianta sono implementati **ma mai testati end-to-end su hardware reale**.
La riconfigurazione WiFi (§10.4) è 📋: dipende dal pulsante fisico, non gestito nel firmware.
 
> **Credenziali MQTT — dev/staging vs produzione.** Questo capitolo descrive credenziali
> dedicate per vaso (`vaso-{device_id}`), che restano il modello di **produzione** con
> Mosquitto self-hosted. In **dev e staging** il broker è HiveMQ Cloud nel piano gratuito,
> che non espone API di gestione utenti: tutti i vasi condividono le stesse credenziali
> del backend. Restano comunque trasmesse via BLE a ogni pairing anziché essere scritte
> nel firmware, così cambiarle non richiede un reflash. Conseguenza: la revoca per singolo
> vaso (§10.5) è possibile solo in produzione.
 
### 10.1 Pairing primo vaso smart (BLE provisioning)
 
**Descrizione:** L'utente collega per la prima volta un vaso smart all'app tramite Bluetooth.
 
**Attori:** Utente autenticato con vaso smart fisico acceso per la prima volta.
 
**Precondizioni:** Il vaso è acceso e in modalità BLE advertising (LED lampeggiante).
Il pairing richiede un **dispositivo fisico**: il simulatore iOS non ha stack Bluetooth.
 
**Flusso principale (scan-first):**
1. L'utente tocca "Aggiungi vaso smart" (dal dettaglio pianta o dalle impostazioni).
2. L'app richiede il permesso Bluetooth (se non già concesso).
3. L'app avvia **subito** la scansione BLE e mostra i dispositivi con prefisso `Fiora-` nelle vicinanze.
4. L'utente seleziona il proprio vaso dalla lista.
5. **Solo a questo punto** l'app chiede la rete WiFi: mostra l'**elenco delle reti
   rilevate** e l'utente sceglie la propria invece di digitarne il nome (vedi §10.1.1).
6. L'utente inserisce la password della rete scelta.
7. L'app chiama `POST /vases/pair` → il backend genera il `device_id` (UUID) e restituisce le credenziali MQTT.
8. L'app invia via BLE al vaso: rete e password WiFi + credenziali MQTT + `device_id`.
9. Il vaso salva i dati in flash, si riavvia, si connette al WiFi e poi al broker MQTT.
10. Il vaso pubblica `status: online`; il backend segna il vaso come connesso.
11. L'app **verifica lo stato reale**: interroga `GET /vases/:id` fino a 45 secondi
    finché non trova `stato: 'connesso'` (vedi §10.1.2 per gli esiti negativi).
12. A connessione riuscita l'app chiede all'utente **come chiamare il vaso**, proponendo
    un nome di default già compilato (vedi §10.1.3).
13. L'app mostra "Vaso connesso!" e associa il vaso alla pianta selezionata.
**Postcondizioni:** Vaso registrato nel DB con un nome, associato alla pianta, dati sensori in arrivo.
 
**Errori:** `VASE_ALREADY_PAIRED`, `VASE_PAIRING_TIMEOUT`, `BLE_PERMISSION_DENIED`.
 
---
 
#### 10.1.1 Scelta della rete WiFi
 
**Descrizione:** L'utente sceglie la rete a cui collegare il vaso da un elenco, invece
di digitarne il nome a mano.
 
Digitare l'SSID a mano è la parte più fragile del pairing: un errore di battitura non è
distinguibile da una password sbagliata, e l'utente scopre l'errore solo 45 secondi dopo,
quando il vaso non arriva online. Con l'elenco, il nome della rete è corretto per
costruzione e l'unico campo che l'utente può sbagliare è la password.
 
**Flusso principale:**
1. L'app richiede il permesso necessario alla scansione WiFi, spiegando **prima** del
   prompt di sistema perché serve ("Per mostrarti le reti disponibili").
2. L'app elenca le reti rilevate, ordinate per potenza del segnale, con l'icona del
   lucchetto per quelle protette.
3. La rete **attualmente in uso dal telefono** è mostrata in cima ed evidenziata: nella
   quasi totalità dei casi è quella giusta, perché il vaso va sulla stessa rete di casa.
4. L'utente tocca la rete e inserisce la password.
 
**Flussi alternativi:**
- **Permesso negato** → l'app non insiste e mostra il campo di testo libero per il nome
  della rete, con una riga che spiega come riattivare il permesso dalle impostazioni.
  Il pairing resta possibile: negare un permesso non deve impedire di usare il prodotto.
- **Nessuna rete trovata** → campo di testo libero, con l'avviso che il vaso supporta solo reti a 2,4 GHz.
- **Rete aperta (senza password)** → il campo password non viene mostrato.
- **Rete nascosta** → link "La mia rete non è in elenco" che apre il campo di testo libero.
 
**Note per l'implementazione:**
- **Android:** l'elenco delle reti richiede il permesso di **localizzazione precisa**.
  Il prompt di sistema parla di "posizione" per una funzione che l'utente percepisce come
  WiFi: la schermata di spiegazione al punto 1 esiste per evitare che sembri una richiesta
  fuori luogo e venga negata d'istinto.
- **iOS:** non esiste un'API pubblica per elencare le reti circostanti, nemmeno con
  entitlement dedicati. Su iOS il campo resta **a testo libero**; l'elenco è una
  funzionalità solo Android. Se in futuro si otterrà l'entitlement "Access WiFi
  Information" (richiede account Apple Developer), si potrà almeno **precompilare** il
  campo con la rete corrente, che copre comunque il caso più frequente.
- **Reti 5 GHz:** l'ESP32 non le supporta. Se la rete scelta è a 5 GHz, l'app lo segnala
  prima di inviare le credenziali invece di far fallire il pairing per un motivo che
  l'utente non potrebbe dedurre.
 
---
 
#### 10.1.2 Esiti negativi e nuovo tentativo
 
Il pairing tocca tre componenti (telefono, vaso, rete di casa) e può fallire in punti
diversi. Il principio: **l'app dice quale passo è fallito e riparte da lì**, non
dall'inizio, e non fa mai perdere dati già inseriti.
 
| Cosa fallisce | Cosa vede l'utente | Da dove riparte |
|---|---|---|
| Nessun vaso `Fiora-` trovato | "Assicurati che il vaso sia acceso e vicino allo smartphone. Il LED deve lampeggiare." | Nuova scansione BLE |
| Bluetooth spento | Invito ad attivare il Bluetooth, con scorciatoia alle impostazioni | Scansione, dopo l'attivazione |
| Permesso Bluetooth negato | Spiegazione + scorciatoia alle impostazioni dell'app | Scansione, dopo il consenso |
| Connessione BLE interrotta durante l'invio | "Connessione col vaso persa" | Selezione del vaso, credenziali WiFi conservate |
| Vaso non online entro 45 s | Vedi sotto — è il caso più delicato | Form WiFi precompilato |
| Rete a 5 GHz rilevata | Avviso prima dell'invio | Scelta della rete |
 
**Vaso non online entro 45 secondi.** L'app non può sapere da sola se il problema è la
password, la rete o il broker: il vaso, dopo il riavvio, non è più raggiungibile via BLE
e non ha ancora una via per parlare col backend. L'app quindi:
 
1. Mostra "Il vaso non è riuscito a collegarsi alla rete" con le tre cause probabili in
   ordine di frequenza: password errata, rete a 5 GHz, vaso troppo distante dal router.
2. Riporta l'utente al **form WiFi con rete e password già compilate**, così si corregge
   solo il campo sbagliato.
3. Offre "Riprova" — che rinvia le credenziali senza rifare la scansione, se il vaso è
   tornato in advertising — e "Ricomincia", che riparte dalla scansione BLE.
 
**Comportamento del vaso in caso di fallimento.** Il vaso deve **tornare da solo in
modalità BLE advertising** se non riesce a connettersi con le credenziali ricevute
(dettaglio dei tentativi e dei tempi nelle specifiche tecniche §6). Senza questo, un
solo errore di password renderebbe il vaso irrecuperabile senza il pulsante fisico di
reset — che oggi non è nemmeno gestito dal firmware. È il requisito che rende il
"Riprova" del punto 3 effettivamente possibile.
 
**Pulizia lato backend:** se il provisioning fallisce dopo che il vaso è già stato creato
con `POST /vases/pair`, il record viene rimosso. Altrimenti l'elenco dei vasi si
riempirebbe di voci mai andate online, indistinguibili da vasi realmente guasti.
 
---
 
#### 10.1.3 Assegnazione del nome al vaso
 
**Descrizione:** A pairing riuscito l'utente dà un nome al vaso.
 
**Flusso principale:**
1. L'app propone un campo **già compilato** con un nome di default: `Vaso 1` per il primo
   vaso dell'utente, `Vaso 2` per il secondo, e così via — il primo numero libero
   contando i vasi già presenti sull'account, inclusi quelli non connessi.
2. L'utente può confermare così com'è o sostituirlo con un nome proprio
   (es. "Monstera salotto").
3. Il nome viene salvato sul vaso ed è modificabile in seguito da §13.5.
 
**Flussi alternativi:**
- Campo svuotato e confermato → viene salvato il nome di default proposto: un vaso senza
  nome sarebbe indistinguibile dagli altri nell'elenco.
- Nome uguale a uno esistente → consentito. I vasi si distinguono per `device_id`, e
  impedire i duplicati costringerebbe l'utente a inventare differenze che non gli servono.
 
**Note:** il numero progressivo è calcolato al momento della proposta e non è un
identificatore: se l'utente elimina "Vaso 1", il vaso successivo può ricevere di nuovo
quel default. Il nome è puramente un'etichetta per l'utente.
 
**Perché scan-first e non wifi-first (decisione 2026-07-24):** l'ordine della v1.0 chiedeva
prima le credenziali WiFi e poi mostrava i dispositivi. È stato invertito: l'utente deve
sapere **a quale vaso fisico** si sta collegando prima di digitare la password di casa.
 
**Perché la verifica dello stato reale (decisione 2026-07-24):** l'app non dichiara il
pairing riuscito quando la scrittura BLE va a buon fine. Una scrittura BLE riuscita
significa solo che il messaggio è arrivato al vaso, non che le credenziali fossero
corrette: senza il polling su `stato: 'connesso'` un WiFi sbagliato risulterebbe
all'utente come un pairing perfettamente riuscito.
 
---
 
### 10.2 Associazione vaso a pianta diversa
 
**Descrizione:** L'utente sposta un vaso smart già configurato da una pianta a un'altra.
 
**Flusso principale:**
1. Dal dettaglio pianta, l'utente tocca "Associa vaso smart".
2. L'app mostra i vasi già configurati e non associati (o già associati ad altre piante con avviso).
3. L'utente seleziona il vaso.
4. Il backend dissocia il vaso dalla pianta precedente e lo associa a quella nuova.
5. I reminder della pianta precedente tornano a logica calendario. Quelli della nuova pianta diventano basati su sensore.
---
 
### 10.3 Visualizzazione dati sensori in tempo reale
 
**Descrizione:** L'utente vede i dati ambientali aggiornati del vaso smart nel dettaglio pianta.
 
**Flusso principale:**
1. L'utente apre il dettaglio di una pianta con vaso connesso.
2. L'app riceve i dati dal backend (già elaborati con etichette e stati).
3. I dati vengono aggiornati ogni volta che il vaso invia una nuova lettura (ogni 15 minuti in condizioni normali).
4. L'utente vede: umidità, luce, temperatura con etichette colorate.
**Flusso alternativo — vaso disconnesso:**
- L'app mostra "Vaso disconnesso" con timestamp dell'ultima lettura disponibile.
- I reminder passano automaticamente a logica calendario finché il vaso non torna online.
---
 
### 10.4 Riconfigurazione WiFi vaso
 
**Stato: 📋 non implementato.** Richiede la gestione del pulsante fisico nel firmware
(assente) e una voce "Riconfigura WiFi" nel dettaglio vaso (assente). Finché mancano
entrambe, un vaso che perde la rete di casa va rimosso e ri-appaiato da zero.
 
**Descrizione:** L'utente deve riconfigurare il WiFi del vaso (es. rete cambiata o password modificata).
 
**Flusso principale:**
1. L'utente tiene premuto il pulsante fisico sul vaso per 5 secondi → il vaso cancella le credenziali salvate e torna in modalità BLE advertising.
2. Dal dettaglio vaso nell'app, l'utente tocca "Riconfigura WiFi".
3. Il flusso BLE riparte dallo step 3 della sezione 10.1 (scansione e selezione del vaso).
4. Le credenziali MQTT e il `device_id` rimangono invariati — solo il WiFi viene riconfigurato.
---
 
### 10.5 Rimozione vaso smart
 
**Descrizione:** L'utente dissocia e rimuove un vaso smart dall'app.
 
**Flusso principale:**
1. L'utente va nelle impostazioni vaso e tocca "Rimuovi vaso".
2. L'app chiede conferma.
3. Il backend:
   - Dissocia il vaso dalla pianta
   - Revoca le credenziali MQTT del vaso su Mosquitto (**solo produzione** — vedi nota
     a inizio capitolo: in dev e staging le credenziali sono condivise e non revocabili)
   - Mantiene lo storico dati sensori già salvato
4. I reminder della pianta tornano a logica calendario.
**Note:** Il vaso fisico non viene resettato automaticamente — l'utente deve resettarlo manualmente (tasto 5 secondi) per poterlo riutilizzare.
 
---
 
## 11. Storico cure e diario fotografico
 
**Stato misto:**
- §11.1 Storico cure — ✅ (endpoint `GET /plants/:id/actions` + schermata dedicata).
- §11.2 Storico dati ambientali — 🚧 esiste la sparkline umidità 24h nel dettaglio pianta
  e l'endpoint `GET /vases/:id/readings` restituisce le letture grezze delle ultime 24 ore.
  Mancano l'aggregazione backend e le finestre 7/30 giorni descritte qui sotto.
- §11.3–11.4 Diario fotografico — 📋 **Fase 5**, rimandata: nessun upload implementato,
  MinIO è in piedi ma inutilizzato.
 
### 11.1 Visualizzazione storico cure
 
**Descrizione:** L'utente consulta lo storico di tutte le azioni completate, saltate o rimandare su una pianta.
 
**Flusso principale:**
1. Dal dettaglio pianta, l'utente tocca "Storico cure".
2. Il backend restituisce la lista paginata delle azioni, dalla più recente.
3. Ogni voce mostra: data, tipo azione, sorgente (sensore / calendario / manuale), nota opzionale.
4. Le azioni completate, saltate e rimandante hanno indicatori visivi diversi.
**Filtri disponibili (elaborati dal backend):**
- Tutti i tipi
- Solo annaffiature
- Solo concimazioni
- Periodo temporale (ultima settimana, ultimo mese, tutto)
---
 
### 11.2 Storico dati ambientali (solo vaso smart)
 
**Descrizione:** L'utente visualizza l'andamento dei dati del sensore nel tempo.
 
**Flusso principale:**
1. Dal dettaglio pianta (tab "Dati sensore"), l'utente scorre verso il basso.
2. Il backend restituisce i dati aggregati delle ultime 24 ore, 7 giorni o 30 giorni.
3. L'app mostra grafici semplici (linea) per umidità, luce e temperatura.
4. I valori sono già aggregati dal backend (media oraria o giornaliera).
**Note:** I dati grezzi vengono conservati per 90 giorni (retention policy TimescaleDB). I grafici mostrano sempre dati aggregati, mai i singoli campioni.
 
---
 
### 11.3 Aggiunta foto al diario
 
**Descrizione:** L'utente aggiunge una foto alla timeline fotografica di una pianta.
 
**Flusso principale:**
1. Dal dettaglio pianta, l'utente tocca "Aggiungi foto".
2. L'app apre il selettore: galleria o fotocamera.
3. L'utente sceglie o scatta la foto.
4. Opzionalmente aggiunge una nota testuale breve.
5. L'app invia la foto al backend.
6. Il backend ridimensiona (max 1200×1200px), converte in WebP, salva su MinIO.
7. La foto appare in cima alla timeline del diario.
**Flussi alternativi:**
- Foto troppo grande (> 10MB originale) → il backend la accetta comunque e la ridimensiona.
- Errore upload → messaggio di errore, foto non salvata, l'utente può riprovare.
**Postcondizioni:** Foto salvata su MinIO, URL salvato nel DB, visibile nella timeline.
 
---
 
### 11.4 Visualizzazione diario fotografico
 
**Descrizione:** L'utente scorre la timeline delle foto di una pianta.
 
**Flusso principale:**
1. Dal dettaglio pianta, l'utente tocca il tab "Diario foto".
2. Il backend restituisce la lista delle foto in ordine cronologico inverso.
3. Ogni foto mostra: immagine thumbnail, data, nota testuale.
4. L'utente può toccare una foto per vederla a schermo intero.
5. Dal dettaglio foto: opzione elimina.
---
 
## 12. Catalogo specie
 
**Stato: 🚧** — la ricerca sul **catalogo curato** (12 specie di seed) e la scheda specie
sono ✅. Il catalogo esteso e la proposta di nuove specie da parte degli utenti (§12.3)
sono 📋 **Fase 9**.
 
> **Cosa il catalogo esteso non può dare.** La versione 1.0 dava per scontato che una
> specie importata portasse con sé i propri dati di cura. La verifica sull'API Trefle
> (2026-07-08) ha mostrato che i campi `growth` sono **quasi sempre nulli**, anche per
> piante comuni come la Monstera deliciosa: Trefle compila i dati agronomici quasi solo
> per le specie agricole. Conseguenza: **i reminder non possono derivare dal catalogo
> importato.** Esso serve per nomi, ricerca e immagini; una pianta associata a una specie
> importata usa parametri di default o inseriti a mano dall'utente (flusso §4.2).
> I dati di cura affidabili restano quelli del **catalogo curato interno**.
 
**Sorgenti del catalogo:** le specie importate vivono in una tabella grezza separata
(`species_import_raw`) con una colonna `fonte` che ne distingue l'origine:
- `fonte='csv'` — **dev e test**: import manuale di un set ridotto di piante, senza dipendere da Trefle.
- `fonte='trefle'` — **produzione**: import massivo dell'indice Trefle (~437.000 specie).
 
Le due sorgenti convivono nella stessa tabella. La ricerca dà priorità al curato, poi alle
specie importate con nome comune italiano, infine a quelle col solo nome scientifico.
 
### 12.1 Ricerca specie
 
**Descrizione:** L'utente cerca una specie durante l'aggiunta di una pianta.
 
**Flusso principale:**
1. Durante l'aggiunta pianta, l'utente digita nel campo di ricerca specie.
2. Il backend cerca nel catalogo specie, che include sia le specie curate manualmente sia l'intero catalogo Trefle già importato (vedi specifiche tecniche, sezione 8) — non è più una chiamata live a Trefle durante la ricerca.
3. I risultati mostrano per ogni specie:
   - **Nome principale:** nome comune in italiano
   - **Sottotitolo:** nome scientifico in latino (visibile se l'opzione è abilitata nelle impostazioni — default: visibile)
   - Categoria (es. Tropicale, Succulenta…)
4. L'utente seleziona la specie desiderata.
5. I parametri di cura vengono precompilati automaticamente.
**Flussi alternativi:**
- Nessun risultato trovato → mostra "Specie non trovata" con opzione "Aggiungi specie mancante". (Con il catalogo Trefle interamente importato, questo caso copre principalmente specie non ancora presenti su Trefle o errori di battitura.)
---
 
### 12.2 Visualizzazione scheda specie
 
**Descrizione:** L'utente consulta le informazioni di cura di una specie.
 
**Flusso principale:**
1. L'utente tocca una specie nei risultati di ricerca o dalla scheda pianta.
2. Il backend restituisce i dati già tradotti in etichette leggibili.
3. La scheda mostra: nome comune, nome scientifico, categoria, luce, annaffiatura, umidità, temperatura min/max, tossicità, note di cura.
---
 
### 12.3 Proposta nuova specie (contributo utente)
 
**Descrizione:** L'utente propone una specie non trovata nel catalogo per renderla disponibile a tutti.
 
**Attori:** Utente autenticato.
 
**Flusso principale:**
1. L'utente tocca "Aggiungi specie mancante" dalla ricerca vuota.
2. L'app mostra il form di proposta.
3. L'utente compila i campi obbligatori: nome comune (in italiano), categoria (lista dinamica dal DB), luce (lista dinamica dal DB), frequenza annaffiatura (lista dinamica dal DB).
4. Opzionalmente compila: nome scientifico, umidità, temperatura, tossicità, note, foto.
5. Tocca "Invia proposta".
6. Il backend verifica se la specie è già presente in `species_import_raw` (il catalogo importato: CSV in dev, Trefle in prod):
   - **Se trovata:** viene aggiunta direttamente al catalogo condiviso con i dati Trefle integrati a quelli dell'utente.
   - **Se non trovata:** va in stato `in_revisione`, visibile solo al proponente fino all'approvazione admin.
7. L'utente può usare subito la specie proposta nella propria collezione.
**Flusso approvazione:**
1. L'admin approva la specie (sezione 14.2).
2. La specie diventa disponibile a tutti gli utenti.
3. Il backend invia notifica push al proponente: "La tua proposta {{nome_specie}} è stata approvata ed è ora disponibile a tutti".
**Flusso rifiuto:**
1. L'admin rifiuta la specie inserendo una nota obbligatoria (es. "Specie duplicata", "Dati non corretti", "Nome non riconosciuto").
2. Il backend aggiorna `stato = 'rifiutata'`.
3. Il backend invia notifica push al proponente: "La tua proposta {{nome_specie}} non è stata approvata" con la nota dell'admin visibile.
4. La specie rimane nella collezione del proponente contrassegnata come "Non approvata" con la motivazione leggibile.
5. Il proponente può:
   - **Correggere e riproporre:** modifica i dati e reinvia — reimposta `stato = 'in_revisione'`.
   - **Rimuovere:** elimina la specie. Se aveva piante associate, queste vengono convertite in piante generiche mantenendo nome e storico.
**Postcondizioni:** Specie salvata nel DB, disponibile per l'utente proponente, in attesa di approvazione o rifiutata con motivazione.
 
**Errori:** `VALIDATION_ERROR` (campi obbligatori mancanti), `SPECIES_ALREADY_EXISTS`.
 
---
 
## 13. Impostazioni
 
**Stato: 🚧** — clima, nomi scientifici, notifiche (on/off + orario), cambio password,
logout, eliminazione account e lista vasi sono ✅. Vedi le note nelle singole sezioni
per il toggle alert sensori (§13.3) e il cambio email (§13.4), entrambi non disponibili.
 
### 13.1 Modifica parametro clima
 
**Descrizione:** L'utente aggiorna il proprio clima di riferimento.
 
**Flusso principale:**
1. L'utente va in Impostazioni → Clima.
2. Vede il clima attualmente selezionato.
3. Sceglie un nuovo clima dalla lista (caricata dinamicamente dal DB).
4. Il backend aggiorna il profilo utente.
5. Il backend ricalcola le frequenze di tutti i reminder attivi delle piante senza vaso smart.
**Postcondizioni:** Clima aggiornato, reminder ricalcolati.
 
---
 
### 13.2 Mostra nomi scientifici
 
**Descrizione:** L'utente attiva o disattiva la visualizzazione del nome scientifico (latino) come sottotitolo nelle ricerche, nelle schede pianta e in tutta l'app.
 
**Flusso principale:**
1. L'utente va in Impostazioni → Visualizzazione → "Mostra nome scientifico".
2. Toggle on/off.
3. La preferenza viene salvata nel profilo utente sul backend.
4. Immediatamente tutta l'app aggiorna la visualizzazione: nomi con o senza sottotitolo latino.
**Default:** attivato (nome scientifico visibile come sottotitolo).
 
---
 
### 13.3 Gestione notifiche
 
**Descrizione:** L'utente configura le preferenze di notifica.
 
**Flusso principale:**
1. L'utente va in Impostazioni → Notifiche.
2. Vede le opzioni:
   - Notifiche push: attiva/disattiva
   - **Orario dei promemoria: qualsiasi ora del giorno**, scelta con un selettore di
     orario (es. 07:30, 21:15), non più una fascia predefinita — vedi nota sotto
   - Alert sensori: attiva/disattiva separatamente — 📋 **Fase 7**, non presente
     finché gli alert da sensore non esistono
3. Le modifiche vengono salvate nel profilo utente.
**Note:**
- Se le notifiche push sono disabilitate a livello di sistema (impostazioni telefono), l'app non può attivarle — mostra un link alle impostazioni di sistema.
- Non esiste una colonna dedicata "notifiche attive": le notifiche sono attive quando
  l'utente ha un `pushToken` registrato, e disattivarle azzera il token.
 
> **Orario libero — 📋 MEV-01, non ancora implementato.** Oggi l'orario è vincolato a
> tre fasce predefinite (mattina 9, pomeriggio 15, sera 19) perché il job di invio gira
> a quelle ore e smista gli utenti per fascia. L'utente deve poter scegliere **qualsiasi
> orario**: chi si alza alle 6 o rientra alle 22 non è servito da nessuna delle tre.
> Specifica completa in `fiora-mev.md` § MEV-01.
 
---
 
### 13.4 Gestione profilo
 
**Descrizione:** L'utente modifica i propri dati personali.
 
**Campi modificabili:**
- Nome visualizzato — ✅
- Password, con password attuale (`POST /auth/change-password`) — ✅
- **Password dimenticata**, reset via email — 📋 **MEV-02**
- Email — 📋 **MEV-02**: richiede la verifica del nuovo indirizzo
 
> **Email transazionali — 📋 MEV-02, non ancora implementato.** Sia il reset della
> password sia il cambio email richiedono l'invio di un messaggio a un indirizzo
> verificato, e nello stack non c'è alcun servizio email. È un buco vero, non solo
> una comodità: **oggi un utente che dimentica la password perde l'account**, perché
> `POST /auth/change-password` richiede quella attuale e non esiste altra via di recupero.
> Previsto un mittente no-reply dedicato con Resend. Specifica completa in
> `fiora-mev.md` § MEV-02.
---
 
### 13.5 Gestione vasi smart
 
**Descrizione:** L'utente visualizza e gestisce tutti i vasi smart collegati al proprio account.
 
**Flusso principale:**
1. L'utente va in Impostazioni → Vasi smart.
2. Vede la lista di tutti i vasi con: nome, stato connessione, batteria, pianta associata.
3. Può: rinominare il vaso, disassociare dalla pianta, rimuovere, riconfigurare WiFi.
---
 
## Opzioni dinamiche — configurazione da DB
 
**Stato: ✅** — tabella creata in Fase 4.5 con 39 opzioni di seed.
 
Tutte le tendine e le selezioni dell'app che potrebbero cambiare nel tempo sono gestite come opzioni dinamiche nel database. Per aggiungere o modificare un'opzione è sufficiente un insert o update sul DB, senza rilasciare una nuova versione dell'app.
 
> **Ambito della tabella.** `app_options` popola **le tendine dell'interfaccia**, non la
> logica di business. Gli intervalli di annaffiatura e i fattori clima (§4.1) restano
> costanti nel backend: spostarli qui renderebbe modificabile da DB il comportamento dei
> reminder, che è responsabilità del backend. Un eventuale spostamento è post-MVP.
> Nota: `posizione` resta salvata come stringa sulla pianta, senza chiave esterna verso
> questa tabella, per non vincolare i dati storici alle opzioni attualmente attive.
 
### Tabella `app_options`
 
```sql
CREATE TABLE app_options (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria   VARCHAR(100) NOT NULL,  -- raggruppamento logico
  chiave      VARCHAR(100) NOT NULL,  -- valore interno salvato nel DB
  etichetta   VARCHAR(255) NOT NULL,  -- testo mostrato all'utente
  descrizione VARCHAR(500),           -- testo descrittivo opzionale (es. per il clima)
  ordine      INTEGER DEFAULT 0,      -- ordine di visualizzazione nella lista
  attivo      BOOLEAN DEFAULT TRUE,
  UNIQUE(categoria, chiave)
);
```
 
### Opzioni gestite dinamicamente
 
| Categoria | Esempi di valori | Usata in |
|---|---|---|
| `clima` | temperato, mediterraneo, tropicale, freddo, appartamento | Onboarding, Impostazioni |
| `posizione_casa` | Soggiorno, Camera, Cucina, Balcone, Studio, Bagno, Corridoio | Aggiunta pianta |
| `categoria_specie` | Pianta da interno, Succulenta, Tropicale, Aromatica, Altro | Aggiunta specie, Proposta specie |
| `luce` | bassa, media, alta | Aggiunta specie, Proposta specie |
| `annaffiatura` | poca, media, frequente | Aggiunta specie, Proposta specie |
| `umidita` | bassa, media, alta | Aggiunta specie, Proposta specie |
| `tipo_task` | annaffiatura, concimazione, nebulizzazione, rinvaso, rotazione, pulizia_foglie, cambio_acqua, taglio_steli, controllo_stato | Aggiunta task manuale |
| `orario_reminder` | mattina_8, mattina_9, mattina_10, mezzogiorno, pomeriggio_15, sera_18, sera_20 | Impostazioni notifiche |
 
### Endpoint API per le opzioni
 
```
GET /options/:categoria     Restituisce le opzioni attive per una categoria
GET /options                Restituisce tutte le opzioni raggruppate per categoria
```
 
Le opzioni vengono caricate dall'app all'avvio e cachate localmente per 24 ore. In questo modo funzionano anche offline.
 
---
 
## 14. Area admin — moderazione specie
 
**Stato: 📋 Fase 9** — nessuna schermata admin esiste. Il campo `role` su User è già
presente (creato in Fase 4.5 insieme agli altri campi utente) ma non è ancora usato.
 
### 14.1 Visualizzazione specie in revisione
 
**Descrizione:** L'amministratore vede le specie proposte dagli utenti in attesa di approvazione.
 
**Attori:** Utente con ruolo `admin`.
 
**Precondizioni:** Esistono specie con `stato = 'in_revisione'`.
 
**Flusso principale:**
1. L'admin accede alla sezione admin (accessibile solo da utenti con ruolo admin).
2. Vede la lista delle specie in revisione con: nome, categoria, utente proponente, data proposta.
3. Tocca una specie per vederne i dettagli completi.
---
 
### 14.2 Approvazione specie
 
**Descrizione:** L'admin approva una specie proposta rendendola disponibile a tutti gli utenti.
 
**Flusso principale:**
1. L'admin visualizza il dettaglio della specie in revisione.
2. Verifica i dati inseriti dall'utente.
3. Può modificare i campi se necessario.
4. Tocca "Approva".
5. Il backend aggiorna `stato = 'attivo'`, `approvato_da = admin_id`.
6. La specie diventa disponibile nel catalogo condiviso per tutti gli utenti.
7. Il backend invia una notifica all'utente proponente ("La tua specie è stata approvata").
**Postcondizioni:** Specie attiva nel catalogo condiviso.
 
---
 
### 14.3 Rifiuto specie
 
**Descrizione:** L'admin rifiuta una specie proposta perché errata o duplicata.
 
**Flusso principale:**
1. L'admin visualizza il dettaglio della specie.
2. Tocca "Rifiuta".
3. Inserisce una nota di motivazione (obbligatoria).
4. Il backend aggiorna `stato = 'rifiutata'`.
5. Il backend invia una notifica all'utente proponente con la nota di motivazione.
6. La specie rimane visibile solo all'utente proponente come "non approvata".
---
 
### 14.4 Promozione specie da livello 3 a livello 1
 
**Descrizione:** L'admin promuove una specie verificata dagli utenti al catalogo curato interno.
 
**Flusso principale:**
1. L'admin individua una specie con molti utilizzi o rilevante per il target.
2. Tocca "Promuovi a catalogo curato".
3. Il backend aggiorna `fonte = 'curato'`.
4. La specie è ora parte del catalogo interno, disponibile offline e prioritaria nelle ricerche.
---
 
## 15. Notifiche
 
**Stato: 🚧** — implementate in Fase 8 (2026-07-13) **solo per i reminder da calendario**.
Le notifiche legate ai sensori (alert umidità/temperatura, vaso offline, batteria scarica)
sono 📋 Fase 7; quella di specie approvata è 📋 Fase 9.
 
### 15.1 Strategia di invio — digest + singola smart
 
Il backend non manda una notifica per ogni task. Girando tre volte al giorno (9, 15, 19)
seleziona gli utenti la cui fascia `orarioReminder` corrisponde e che hanno task pendenti
in scadenza entro fine giornata, poi:
 
| Task pendenti | Notifica | Apre |
|---|---|---|
| 1 | "🌱 Annaffia {{nome_pianta}}" | Dettaglio della pianta |
| N > 1 | "Hai N cure da fare oggi" | Schermata Oggi |
 
Una notifica per pianta avrebbe reso l'app rumorosa per chi ne ha molte: il digest
mantiene un solo avviso per fascia, e il caso singolo resta specifico perché è quello
in cui l'azione è immediatamente eseguibile.
 
Se Expo segnala che il token non è più valido (`DeviceNotRegistered`) il backend azzera
il `pushToken` dell'utente, disattivando di fatto le notifiche fino a un nuovo consenso.
 
### 15.1b Tipi di notifica previsti (fasi successive)
 
| Tipo | Titolo | Corpo | Priorità | Stato |
|---|---|---|---|---|
| Reminder cure (digest o singola) | vedi tabella sopra | — | Normale | ✅ |
| Alert umidità bassa | "{{nome_pianta}} ha sete" | "Il terreno è troppo asciutto — annaffia ora" | Alta | 📋 F7 |
| Alert temperatura | "Attenzione a {{nome_pianta}}" | "La temperatura è troppo bassa/alta" | Alta | 📋 F7 |
| Vaso disconnesso | "Vaso smart offline" | "Il vaso di {{nome_pianta}} non è raggiungibile" | Normale | 📋 F7 |
| Batteria scarica | "Batteria vaso scarica" | "Il vaso di {{nome_pianta}} ha bisogno di essere ricaricato" | Normale | 📋 F7 |
| Specie approvata | "Specie approvata" | "La tua proposta {{nome_specie}} è ora disponibile a tutti" | Bassa | 📋 F9 |
| Bouquet in scadenza | "Il tuo bouquet sta appassendo" | "{{nome_bouquet}} ha bisogno di attenzione" | Normale | 📋 |
 
---
 
### 15.2 Gestione notifiche con app chiusa
 
**Descrizione:** Comportamento delle notifiche quando l'app non è in foreground.
 
**Flusso:**
1. Il backend invia la notifica push tramite Expo Push Service.
2. Il sistema operativo mostra la notifica nella barra delle notifiche.
3. L'utente tocca la notifica.
4. L'app si apre direttamente sul dettaglio della pianta o sulla schermata Oggi (deep link).
---
 
## 16. Gestione stati e ciclo di vita
 
### 16.1 Archiviazione pianta o bouquet
 
**Descrizione:** L'utente nasconde un elemento dalla collezione principale senza eliminarlo.
 
**Flusso principale:**
1. L'utente fa swipe sulla card nella collezione oppure tocca "Archivia" dal dettaglio.
2. L'app chiede conferma: "Archiviare {{nome}}? Potrai ripristinarla in qualsiasi momento."
3. Il backend aggiorna `stato = 'archiviato'`.
4. Se la pianta ha un vaso smart: la ricezione dati viene messa in pausa ma il vaso non viene disconnesso.
5. **I task ancora pendenti passano a `saltato`** e non vengono generati nuovi reminder.
6. L'elemento scompare dalla collezione principale e dalla schermata Oggi.
**Postcondizioni:** Elemento archiviato, storico preservato, nessun task residuo in "Oggi".
 
**Nota:** i task pendenti vanno chiusi esplicitamente, con la stessa logica dell'eliminazione.
Lasciarli in stato `pending` li faceva restare visibili nella schermata Oggi anche dopo
l'archiviazione, chiedendo all'utente di annaffiare una pianta che aveva appena messo via.
 
---
 
### 16.2 Ripristino da archivio
 
**Descrizione:** L'utente riporta un elemento archiviato nella collezione attiva.
 
**Flusso principale:**
1. L'utente va nella sezione Archivio.
2. Tocca "Ripristina" sull'elemento.
3. Il backend aggiorna `stato = 'attivo'`.
4. Se aveva un vaso smart associato: la ricezione dati riprende.
5. Il reminder engine rigenera i task alla prima esecuzione utile, prendendo come
   riferimento la **data di ripristino** se non esiste uno storico più recente — così
   una pianta archiviata per mesi non rientra con settimane di annaffiature arretrate.
6. L'elemento appare di nuovo nella collezione principale.
---
 
### 16.3 Eliminazione definitiva
 
**Descrizione:** L'utente elimina permanentemente una pianta o bouquet con tutti i dati associati.
 
**Flusso principale:**
1. L'utente tocca "Elimina" dal dettaglio o dall'archivio.
2. L'app mostra una schermata di conferma con testo esplicito e campo di digitazione: l'utente deve scrivere "ELIMINA" per confermare.
3. Il backend elimina:
   - La pianta e tutti i task associati
   - Lo storico delle azioni
   - Le foto dal diario (e i file da MinIO)
   - I dati sensori da TimescaleDB
   - I reminder schedulati da BullMQ
4. Se aveva un vaso smart: il vaso viene dissociato (non rimosso dall'account).
5. L'elemento scompare definitivamente. Non è possibile il ripristino.
**Postcondizioni:** Tutti i dati della pianta eliminati. Il vaso smart, se presente, torna disponibile per essere associato ad altra pianta.
 
**Errori:** `PLANT_NOT_FOUND`, `PLANT_NOT_OWNED`.
 
**Note:** L'eliminazione è irreversibile. Non esiste periodo di grazia per le piante (solo per l'account utente).