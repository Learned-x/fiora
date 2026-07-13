# 🌿 Fiora — Integrazioni alle specifiche e revisione roadmap

**Versione 1.0 · 2026-07-08**

Documento delta rispetto a `fiora-specifiche-funzionali-v1.md` e `fiora-roadmap-dettagliata.md`.
Nasce dall'analisi di allineamento tra specifiche e implementazione a valle delle Fasi 0–4.
Ogni sezione indica: cosa manca o diverge, la decisione presa (o da prendere), e in quale fase va gestito.

---

## Indice

1. [Correzioni al comportamento implementato (Fase 4.5)](#1-correzioni-al-comportamento-implementato)
2. [Decisioni di specifica prese](#2-decisioni-di-specifica-prese)
3. [Decisioni di specifica da prendere](#3-decisioni-di-specifica-da-prendere)
4. [Trefle — import massivo nel DB locale (analisi di fattibilità)](#4-trefle--import-massivo-nel-db-locale)
5. [Roadmap rivista](#5-roadmap-rivista)

---

## 1. Correzioni al comportamento implementato

Da fare in una **Fase 4.5 di consolidamento**, prima della Fase 5. Riferimenti alle sezioni delle specifiche funzionali v1.

### 1.1 Endpoint profilo utente (nuovo)

- `GET /auth/me` — restituisce il profilo dell'utente autenticato (id, email, name, clima, preferenze).
  Motivazione: dopo il riavvio dell'app `restoreSession` non ha modo di recuperare il profilo;
  le Impostazioni mostrano dati placeholder.
- `PATCH /users/me` — aggiorna: `name`, `clima`, `mostraNomiScientifici`, `orarioReminder`.
  Al cambio di `clima`: ricalcolo scadenze dei task `calendario` pending delle piante senza vaso smart (spec 13.1).

### 1.2 Onboarding clima (spec 2.1)

- La selezione clima nell'onboarding mobile deve essere inviata al backend
  (`PATCH /users/me`) dopo l'autenticazione, non tenuta solo in stato locale.
- Nuovo campo `onboardingDone` su User; l'onboarding non viene riproposto (spec 2.1, nota).
- Resta aperta (fase successiva) l'inversione dell'ordine: prima login, poi clima.

### 1.3 Archiviazione e ripristino (spec 16.1, 16.2)

- **Archivia**: i task pending della pianta passano a `saltato` (stessa logica del delete)
  — oggi restano pending e compaiono in "Oggi". I reminder non vengono più generati (già corretto).
- **Ripristina**: il reminder engine rigenera i task alla prima esecuzione utile
  basandosi sulla data attuale (riferimento = data ripristino se non esiste storico più recente).

### 1.4 Reminder engine completo (spec 5.1, 9.1, 15.1)

Oggi il job genera solo `annaffiatura` per piante con specie. Estensioni:

- **Concimazione**: task `concimazione` ogni 30 giorni (marzo–ottobre; sospesa nei mesi invernali)
  per piante attive con specie.
- **Bouquet**:
  - alla creazione: task immediato "Metti il bouquet in acqua" se checkbox "già in acqua" non spuntata (spec 5.1);
  - `cambio_acqua` ogni 2 giorni; `controllo_stato` ogni giorno;
  - stato sintetico automatico in base ai giorni dalla ricezione (0–2 Fresco, 3–6 In cura,
    7–10 Appassendo, >10 Concluso), sovrascrivibile manualmente (spec 7.1);
  - al passaggio a Concluso: stop generazione task e proposta archivia/elimina lato app.
- **Tipi task**: aggiungere ai `TASK_TYPES` backend: `cambio_acqua`, `taglio_steli`, `controllo_stato`,
  `rotazione`, `pulizia_foglie` (allineamento con tabella opzioni dinamiche, spec §Opzioni).
  `controllo` esistente viene mantenuto come alias deprecato o migrato a `controllo_stato`.

### 1.5 Modulazione clima degli intervalli (spec 4.1, 13.1)

Intervalli base annaffiatura (giorni) moltiplicati per fattore clima:

| `Species.annaffiatura` | Base |
|---|---|
| frequente | 2 |
| media | 5 |
| poca | 10 |

| Clima utente | Fattore |
|---|---|
| freddo | ×1.3 |
| temperato | ×1.0 |
| appartamento | ×1.0 |
| mediterraneo | ×0.8 |
| tropicale | ×0.7 |

Risultato arrotondato, minimo 1 giorno. Valori tarabili in `app_options` (vedi 2.2) o costanti backend.

### 1.6 Gestione task — dettagli (spec 9.2, 9.3)

- Opzioni "Rimanda": **Tra 2 ore / Domani / Tra 2 giorni** (allineamento alla spec; oggi: domani / +3 giorni).
- Rifiutare date di rimando nel passato (validazione backend su `scadenza`).
- Task pending con scadenza superata da più di 3 giorni: flag "in ritardo" calcolato dal backend
  (campo derivato nella risposta, non nuovo stato), indicatore arancione in app.

### 1.7 Storico cure (spec 11.1)

- Nuovo endpoint `GET /plants/:id/actions` — lista paginata action log
  (data, tipo, nota; filtri: tipo, periodo).
- Schermata "Storico cure" nel dettaglio pianta (già prevista dal wireframe, rimossa dalla Fase 4 per mancanza endpoint).

### 1.8 Eliminazioni e grace period (spec 1.7, 16.3)

- Eliminazione pianta: conferma con digitazione "ELIMINA" (oggi: alert semplice). Solo mobile.
- Login con account in grace period: il backend oggi rifiuta; deve invece restituire un flag
  che consenta all'app di mostrare il banner "Annulla eliminazione" (spec 1.2, flusso alternativo).

### 1.9 Campi nuovi su User (migration unica)

| Campo | Tipo | Uso | Fase di utilizzo |
|---|---|---|---|
| `onboardingDone` | Boolean default false | spec 2.1 | 4.5 |
| `mostraNomiScientifici` | Boolean default true | spec 13.2 | 4.5 |
| `orarioReminder` | String default 'mattina_9' | spec 13.3 | 4.5 (usato in F8) |
| `role` | String default 'user' | area admin, spec 14 | 9 |
| `pushToken` | String nullable | Expo push, spec 15 | 8 |

Conviene una sola migration in Fase 4.5 anche per i campi usati dopo.

---

## 2. Decisioni di specifica prese

### 2.1 Mapping annaffiatura → giorni

Non era specificato in nessun documento. Adottati i valori della tabella in 1.5.
Vanno considerati parametri di prodotto tarabili, non costanti definitive.

### 2.2 Tabella `app_options` — adottata

Prevista dalle specifiche (§Opzioni dinamiche) ma mai creata. Si adotta in Fase 4.5:

- Migration con la tabella come da spec + seed di: `clima`, `posizione_casa`, `categoria_specie`,
  `luce`, `annaffiatura`, `umidita`, `tipo_task`, `orario_reminder`.
- Endpoint `GET /options` e `GET /options/:categoria` (pubblici per utenti autenticati).
- Mobile: carica le opzioni all'avvio, cache in memoria (la cache 24h su storage arriva
  con l'eventuale lavoro offline, vedi 3.2).
- La schermata clima dell'onboarding e il campo "posizione" del form pianta passano
  da valori hardcoded/testo libero alle opzioni dinamiche.
  Nota: `posizione` resta salvata come stringa su Plant (nessuna FK) per non complicare lo schema.

### 2.3 Catalogo curato — seed empty state

Il seed passa da 6 a 10+ specie per coprire l'elenco della spec 2.2:
aggiungere Ficus benjamina, Aloe vera, Calathea, Zamioculcas, Edera (Hedera helix), Lavanda.
L'empty state della collezione con card suggerite "Aggiungi" (spec 2.2) si implementa in Fase 4.5 o 10.

### 2.4 Trefle

Cambio di strategia rispetto alla spec 12.1 (ricerca live con fallback):
**import massivo nel DB locale + sincronizzazione periodica**. Dettagli e fattibilità in §4.
La Fase 9 della roadmap viene ridefinita di conseguenza.

### 2.5 Catalogo grezzo generico — `species_import_raw` (2026-07-13)

La tabella `trefle_species_raw` è stata rinominata in **`species_import_raw`**
(model Prisma `SpeciesImportRaw`, migration `rinomina_catalogo_import_generico`),
con campi generici: `external_id` (era `trefle_id`), `updated_at_source` (era
`updated_at_trefle`) e nuova colonna **`fonte`** (`'csv' | 'trefle'`, default `'csv'`).
Anche `species.trefle_id` è stato rinominato in `species.external_id`.

Motivazione: in **dev e test** le specie del catalogo esteso verranno importate
manualmente **via CSV** con un set ridotto di piante, senza dipendere da Trefle.
L'import massivo Trefle resta il meccanismo previsto per la produzione (Fase 9);
la colonna `fonte` distingue l'origine dei record e permette ai due meccanismi
di convivere sulla stessa tabella.

Conseguenze:
- lo script/job di import Trefle (§4.3) scriverà su `species_import_raw` con `fonte='trefle'`;
- serve uno script di import CSV (`fonte='csv'`) per il seed del catalogo esteso in dev — da definire;
- i riferimenti a `trefle_species_raw` nelle specifiche tecniche v1 e nelle roadmap si intendono aggiornati al nuovo nome.

---

## 3. Decisioni di specifica da prendere

Aperte, con proposta. Nessuna blocca le Fasi 5–8.

### 3.1 Email transazionali

La spec 1.7 prevede email di conferma eliminazione account con link di annullamento.
Nessun servizio email nello stack. **Proposta:** rinviare a post-MVP; il periodo di grazia
resta gestito in-app (banner al login). Se si adotta: Resend o SES, job BullMQ dedicato.

### 3.2 Offline / cache locale SQLite

Le spec 3.1 e 8.1 citano cache locale con banner "Dati non aggiornati". Non è in nessuna fase.
**Proposta:** fuori scope MVP. Pull-to-refresh + messaggi di errore rete bastano per il prototipo.
Se entra: expo-sqlite + strategia stale-while-revalidate, fase dedicata dopo la F8.

### 3.3 "Fiori nel bouquet"

Il wireframe mostra chips dei fiori contenuti nel bouquet; le specifiche funzionali non ne parlano;
il DB non ha il campo. **Proposta:** campo `fioriBouquet String[]` su Plant (lista nomi liberi),
UI chips nel form bouquet e nel dettaglio. Fase 10 (rifinitura), non critico.

### 3.4 Collezione — ordinamento e badge

Spec 3.1: ordinamento "per prossima azione", filtro "con vaso smart", prossimo task su ogni card.
Oggi: filtri tipo/stato e conteggio task pending. **Proposta:** badge prossimo task in Fase 4.5
(il dato c'è già nella risposta API); ordinamento per prossima azione e filtro vaso smart in Fase 6
(quando esistono i vasi).

### 3.5 Modifica email e password (spec 13.4)

Richiede verifica email (→ dipende da 3.1) e endpoint cambio password con password attuale.
**Proposta:** cambio password in Fase 4.5 (`POST /auth/change-password`, nessuna email richiesta);
cambio email rinviato insieme a 3.1.

---

## 4. Trefle — import massivo nel DB locale

### 4.1 Verifica effettuata (2026-07-08, API v1 con key del progetto)

- API attiva, HTTP 200. Dataset: **437.255 specie**, 20 per pagina → ~21.900 pagine.
- Endpoint lista (`/plants`): id, slug, nome comune (principale), nome scientifico, genere,
  famiglia, anno, rank, sinonimi, `image_url`. **Niente dati di cura.**
- Endpoint dettaglio (`/species/:slug`): aggiunge `common_names` per lingua (incluso `it`, presenza
  sparsa), `growth` (luce, temperatura min/max, precipitazioni…), `specifications` (tossicità…).
  **Verificato su Monstera deliciosa: tutti i campi `growth` sono null.** I dati di cura su Trefle
  sono compilati quasi solo per specie agricole/USDA, non per piante d'appartamento.
- Rate limit piano gratuito: 120 richieste/minuto.

### 4.2 Conclusioni di fattibilità

**Fattibile e consigliato**, con un ridimensionamento delle aspettative:

| Aspetto | Verdetto |
|---|---|
| Import indice completo (lista) | ✅ ~21.900 richieste ≈ **3–4 ore** una tantum a 120 req/min. Job resumabile con checkpoint pagina. |
| Peso su PostgreSQL | ✅ ~437k righe, ~1 GB con indici. Irrilevante. |
| Nomi comuni italiani | ⚠️ Presenti ma sparsi. Fallback: nome scientifico. Il curato resta prioritario nella ricerca. |
| Dati di cura (luce/acqua/temp) | ❌ Quasi sempre null. **I reminder non possono derivare da Trefle.** Una pianta con specie solo-Trefle usa parametri default o inseriti dall'utente (flusso spec 4.2). |
| Import dettagli completo | ❌ 437k richieste ≈ 61 ore. Non farlo in blocco. |
| Dettagli on-demand | ✅ Alla prima selezione di una specie Trefle: fetch dettaglio, merge nel DB (nomi it, immagine, eventuali dati cura). 1 richiesta per specie, una sola volta. |
| Immagini | ✅ Salvare `image_url` (hotlink). Cache su MinIO solo per specie effettivamente usate (opzionale, F5+). |
| Licenza | ⚠️ Dati Trefle in Open Database License (ODbL): copia locale lecita con attribuzione ("Powered by Trefle") in app. Verificare i TOS correnti prima del rilascio pubblico. |
| Affidabilità servizio | ⚠️ Trefle è storicamente instabile (già offline in passato). La copia locale è proprio la mitigazione giusta: dopo l'import il runtime non dipende più da Trefle. |

### 4.3 Architettura proposta (ridefinizione Fase 9)

1. **Import iniziale** — script/job BullMQ `trefle-import`:
   pagina per pagina (`/plants?page=N`), upsert su `species_import_raw` per `externalId` con `fonte='trefle'` (vedi 2.5)
   (`fonte='trefle'`, `stato='attivo'`, campi cura null), checkpoint pagina in tabella
   `sync_state` per ripresa dopo interruzione. Throttle 100 req/min (margine sul limite).
2. **Arricchimento on-demand** — alla prima selezione di una specie `fonte='trefle'`
   da parte di un utente: fetch `/species/:slug`, merge nomi comuni it + immagine + eventuali
   dati growth, flag `dettaglioImportato=true`.
3. **Sync periodico** — job BullMQ **settimanale** (non giornaliero: 3–4 ore di scan per un
   dataset che cambia raramente non giustificano la frequenza giornaliera; l'API non offre
   un filtro affidabile "modificato dopo X", da riverificare in fase di implementazione):
   re-scan completo notturno con upsert; le specie nuove entrano, quelle rimosse restano
   (nessuna cancellazione automatica).
4. **Ricerca** (`GET /species?search=`): priorità curato > trefle-con-nome-it > trefle-scientifico.
   Indice trigram (`pg_trgm`) su nomeComune e nomeScientifico per ricerca veloce su 437k righe.
5. **Schema**: campi nuovi su Species: `slugTrefle`, `famiglia`, `genere`, `sinonimi String[]`,
   `dettaglioImportato Boolean`; tabella `sync_state (chiave, valore, updatedAt)`.

Con l'import locale decadono: il fallback live su Trefle in ricerca (spec 12.1) e il
"verifica se presente su Trefle" nella proposta specie (spec 12.3) — la verifica diventa
una query locale.

---

## 5. Roadmap rivista

| Fase | Contenuto | Stato / Note |
|---|---|---|
| 0–4 | Infra, auth, CRUD, reminder annaffiatura, UI mobile | ✅ Completate |
| **4.5 Consolidamento** | §1 completa: /auth/me, PATCH /users/me + clima onboarding, fix archiviazione, reminder concimazione+bouquet+stato automatico, tipi task allineati, modulazione clima, rimanda 2h/1g/2g + in-ritardo, storico cure (endpoint+schermata), app_options, migration campi User, seed 10 specie, cambio password, conferma "ELIMINA", banner grace period | 🆕 Nuova fase, prima della 5 |
| 5 | Foto diario (MinIO, resize WebP 1200px, timeline) | Invariata |
| 6 | Vaso smart: MQTT→sensor_readings, schermate Vasi, pairing BLE, associazione pianta, ordinamento collezione "prossima azione" + filtro vaso | Invariata + code spostato da 3.4 |
| 7 | Alert sensori (soglie → task `sensore`, gruppo rosso in Oggi già predisposto) | Invariata |
| 8 | Notifiche push Expo (usa `pushToken` e `orarioReminder` da 4.5) | Invariata |
| **9 Catalogo esteso** | **Ridefinita**: import massivo Trefle (§4.3), arricchimento on-demand, sync settimanale, ricerca pg_trgm, proposta specie utente (verifica locale, non live), area admin moderazione (`role` da 4.5) | 🔄 Ridefinita |
| 10 | Apple Sign-In, inversione onboarding login→clima (da decidere), fiori bouquet (3.3), empty state suggerimenti se non fatto in 4.5, rifinitura UI | Ampliata |
| Post-MVP | Email transazionali (3.1), offline SQLite (3.2), cambio email (3.5) | 🆕 Parcheggio esplicito |

---

*Documento generato dall'analisi di allineamento specifiche↔codice del 2026-07-08 (Fasi 0–4 complete).*
