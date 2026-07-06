# 🌿 Fiora — Specifiche di prodotto v3

**Fase 1 · Software + Hardware · Mobile**

---

## 1. Panoramica

Fiora è un'app mobile per la cura delle piante da interno: piante in vaso, piante tropicali, succulente, aromatiche, e bouquet come categoria aggiuntiva. L'obiettivo è aiutare utenti comuni a capire cosa fare oggi per ogni pianta, con istruzioni semplici e reminder chiari.

La fase 1 include già il **vaso smart** sviluppato in collaborazione con un partner esterno. Il vaso è dotato di sensori ambientali che rilevano umidità del suolo, luce ambientale e temperatura, e trasmette i dati all'app in tempo reale. Questo cambia in modo significativo la logica dei reminder: invece di basarsi solo su regole predefinite per specie, l'app può reagire allo stato reale della pianta.

L'analisi hardware e il firmware del vaso smart sono gestiti esternamente. Le specifiche Fiora coprono solo la parte software: ricezione dati, interpretazione, interfaccia utente e logica di notifica.

---

## 2. Obiettivo del prodotto

L'obiettivo principale della v1 è dimostrare che un'app connessa a un sensore reale può rendere la cura delle piante concretamente più semplice, non solo più ricca di dati. La priorità non è monetizzare subito, ma far percepire valore pratico fin dal primo utilizzo.

Gli obiettivi operativi della fase 1 sono:

- Gestire piante di qualsiasi tipo in un'unica app, con bouquet come categoria separata.
- Fornire suggerimenti specie-specifici attraverso un catalogo interno a tre livelli.
- Mostrare i dati in tempo reale del vaso smart in modo comprensibile, non tecnico.
- Generare reminder intelligenti che integrano dati da sensore e regole per specie.
- Offrire una schermata "Oggi" che riflette lo stato reale delle piante, non solo il calendario.

---

## 3. Target utenti

Il target principale è composto da persone non esperte con poche o medie piante in casa, che vogliono evitare di farle morire per mancanza di attenzione o di informazioni pratiche. Un secondo target sono gli utenti più curiosi e tech-friendly, attratti dalla componente smart del vaso e dalla visualizzazione dei dati ambientali.

L'app non è pensata per vivaisti, collezionisti esperti o utenti che cercano diagnosi botaniche avanzate. Linguaggio, interfaccia e flussi devono restare rassicuranti e pratici anche per chi non ha mai usato un sensore.

---

## 4. Problemi da risolvere

- Gli utenti non ricordano quando hanno annaffiato o fatto altre cure di routine.
- Molte persone non conoscono le esigenze specifiche della propria pianta.
- Le app esistenti mostrano dati da sensori in modo troppo tecnico, scoraggiando gli utenti comuni.
- I reminder basati solo sul calendario ignorano le condizioni reali: una pianta in estate ha bisogno di più acqua rispetto a una in inverno.
- Fiora deve risolvere prima il problema della semplicità, poi quello della completezza.

---

## 5. Proposta di valore

Fiora connette il vaso smart all'app e trasforma i dati grezzi dei sensori in consigli pratici comprensibili. L'utente non vede percentuali di umidità: vede "la tua Monstera ha bisogno di acqua oggi".

Il vantaggio competitivo non è la quantità di dati rilevati, ma la capacità di tradurli in azioni chiare, al momento giusto, per qualsiasi livello di esperienza.

---

## 6. Ambito della fase 1

### Incluso

- Gestione di piante di qualsiasi tipo e bouquet (aggiunta, modifica, archiviazione, eliminazione).
- Autenticazione utente con sincronizzazione cloud.
- Connessione e gestione del vaso smart via app (pairing, stato connessione, dati in tempo reale).
- Reminder intelligenti che integrano dati da sensore e regole specie-specifiche.
- Schermata "Oggi" con stato reale delle piante.
- Storico delle azioni e storico dei dati ambientali.
- Diario fotografico.
- Schede guida con consigli specie-specifici.
- Catalogo specie a tre livelli.
- Selezione manuale del clima per piante senza vaso smart.

### Escluso dalla v1

- Analisi hardware e firmware del vaso smart (gestiti dal partner esterno).
- Identificazione da foto e diagnosi delle malattie.
- Community, funzioni sociali o familiari condivise.
- Funzioni premium definite nel dettaglio.

> ⚑ Le funzionalità escluse potranno essere valutate in fasi successive solo dopo la validazione dell'uso quotidiano.

---

## 7. Autenticazione e gestione dati

L'app richiede un account utente per garantire sincronizzazione e persistenza dei dati, inclusi quelli provenienti dal vaso smart.

### Metodi di accesso

- Email e password.
- Login con Google.
- Login con Apple (obbligatorio per App Store iOS).

### Comportamento offline

L'app funziona senza connessione per le operazioni principali (visualizzazione, completamento task, note). I dati vengono sincronizzati alla prima riconnessione. In caso di conflitto, prevale la versione più recente per data di modifica.

Il vaso smart salva localmente i dati dei sensori quando l'app è offline, e li trasmette alla sincronizzazione successiva, così lo storico ambientale rimane continuo.

### Sincronizzazione e backup

- I dati sono salvati su DB cloud in tempo reale quando online.
- Il cambio dispositivo non comporta perdita di dati, inclusa la configurazione del vaso smart.
- L'eliminazione account prevede conferma esplicita e periodo di grazia prima della cancellazione definitiva.

---

## 8. Il vaso smart

Il vaso smart è sviluppato da un partner esterno. Fiora gestisce esclusivamente la ricezione e l'interpretazione dei dati via API o protocollo definito con il partner.

### Sensori disponibili

| Sensore | Dato rilevato | Come viene mostrato all'utente |
|---|---|---|
| Umidità del suolo | % umidità | "Terreno asciutto / umido / saturo" |
| Luce ambientale | lux | "Luce scarsa / sufficiente / intensa" |
| Temperatura | °C | "Temperatura ottimale / troppo freddo / troppo caldo" |

### Pairing e configurazione

- Il pairing avviene via app con un flusso guidato (es. scansione QR o Bluetooth).
- Ogni vaso smart viene associato a una specifica pianta nella collezione.
- Un utente può avere più vasi smart associati a piante diverse.
- Se il vaso smart si disconnette, l'app notifica l'utente e torna temporaneamente ai reminder basati su regole.

### Stato connessione

L'app mostra sempre lo stato di connessione del vaso nella scheda pianta: connesso, disconnesso, batteria scarica. In caso di disconnessione prolungata, i reminder continuano a funzionare con la logica basata su specie e clima.

---

## 9. Logica dei reminder

Con il vaso smart, la logica dei reminder cambia rispetto a un sistema puramente calendar-based.

### Piante con vaso smart

I reminder vengono generati combinando tre fonti:

1. **Dati sensore in tempo reale** — se l'umidità scende sotto la soglia consigliata per la specie, l'app invia una notifica immediata, indipendentemente dal calendario.
2. **Regole specie-specifiche** — definiscono le soglie e la frequenza attesa (es. Monstera: annaffia quando umidità < 30%).
3. **Parametro clima** — modula le soglie in base alla stagione e al tipo di clima selezionato dall'utente.

In questo modello, il reminder di annaffiatura non arriva "ogni 5 giorni", ma quando la pianta ne ha davvero bisogno.

### Piante senza vaso smart

Per le piante non associate a un vaso smart, i reminder funzionano con il sistema calendar-based basato su specie e clima, come descritto in precedenza.

### Tipologie di task — piante

- Annaffiatura (automatica con vaso smart, manuale senza)
- Concimazione
- Nebulizzazione
- Rinvaso
- Rotazione
- Pulizia foglie
- Verifica condizioni ambientali (luce, temperatura)

### Tipologie di task — bouquet

- Cambio acqua
- Taglio steli
- Controllo stato generale

### Notifiche disabilitate

Se l'utente disabilita le notifiche push, i task rimangono visibili nella schermata Oggi. Gli alert da sensore (es. "terreno troppo asciutto") vengono mostrati come badge o banner all'apertura dell'app.

---

## 10. Stati e ciclo di vita

### Piante e bouquet

| Stato | Descrizione |
|---|---|
| Attivo | Visibile nella collezione e nella schermata Oggi |
| Archiviato | Nascosto dalla vista principale, recuperabile. Storico preservato |
| Eliminato | Rimozione definitiva con conferma esplicita. Irreversibile |

**Transizioni:**

- Attivo → Archiviato: dal dettaglio o con swipe nella lista.
- Archiviato → Attivo: ripristino dall'archivio con un tap.
- Qualsiasi → Eliminato: richiede conferma testuale esplicita ("Elimina definitivamente"). Nessun ripristino possibile.

L'archiviazione di una pianta associata a un vaso smart mette in pausa la ricezione dati ma non disconnette il vaso. Il vaso rimane disponibile per essere riassociato a un'altra pianta.

### Bouquet: stato sintetico

I bouquet hanno uno stato sintetico aggiuntivo — **Fresco / In cura / Appassendo / Concluso** — aggiornabile manualmente o suggerito dall'app in base ai giorni trascorsi. Alla marcatura come Concluso, l'app propone di archiviare o eliminare il bouquet.

---

## 11. Parametro clima

Usato per le piante senza vaso smart, o come contesto aggiuntivo per quelle connesse.

L'utente seleziona il proprio clima durante l'onboarding, senza GPS. La scelta è modificabile dalle impostazioni.

**Opzioni:**

- Temperato (es. Nord Italia, Europa centrale)
- Mediterraneo (es. Centro-Sud Italia, Spagna, Grecia)
- Tropicale (es. climi caldi e umidi tutto l'anno)
- Freddo (es. climi continentali con inverni rigidi)
- Appartamento sempre riscaldato (stagionalità ridotta, clima interno controllato)

---

## 12. Empty state e primo accesso

Se l'utente non aggiunge nulla durante l'onboarding, la schermata principale non deve essere vuota. L'app propone le piante da interno più comuni, precompilando nome, specie e parametri di cura.

**Piante suggerite:**

- Pothos (Epipremnum aureum)
- Sansevieria (Dracaena trifasciata)
- Monstera deliciosa
- Orchidea Phalaenopsis
- Ficus benjamina
- Aloe vera
- Calathea
- Zamioculcas
- Edera (Hedera helix)
- Lavanda (se clima esterno/balcone)

L'utente può ignorare i suggerimenti e aggiungere manualmente qualsiasi pianta o bouquet.

---

## 13. Funzioni principali

### Onboarding

Breve, con solo le informazioni strettamente necessarie:

1. Scelta tipo di contenuto: piante / bouquet / entrambi.
2. Selezione clima (senza GPS).
3. Metodo di accesso o registrazione.
4. Opzione di saltare e aggiungere subito il primo elemento.
5. Se l'utente ha un vaso smart: avvio del flusso di pairing guidato (opzionale, può essere fatto in seguito).

### Collezione

La schermata principale mostra tutte le piante e i bouquet attivi come card. Ogni card mostra foto, nome, tipo, stato sintetico e — se connessa a un vaso smart — un indicatore visivo dello stato ambientale attuale (es. icona goccia rossa se il terreno è troppo asciutto).

Filtri disponibili: piante / bouquet / con vaso smart / tutti. Ordinamento per nome o prossima azione.

### Aggiunta pianta

- Nome libero.
- Scelta specie dal catalogo (con precompilazione parametri di cura).
- Foto opzionale.
- Posizione in casa.
- Associazione opzionale a un vaso smart (con avvio pairing se non ancora configurato).
- Se la specie non è in catalogo: pianta generica con parametri manuali.

### Aggiunta bouquet

Flusso rapido: nome, data ricezione, foto opzionale, conferma acqua. Dopo il salvataggio: checklist iniziale (taglio steli, foglie sotto l'acqua, nutrimento, posizione) e generazione reminder ricorrenti.

### Schermata Oggi

Centro operativo dell'app. Mostra i task del giorno raggruppati per pianta, integrando:

- Reminder da calendario (specie + clima).
- Alert in tempo reale da vaso smart (es. "Pothos: terreno troppo asciutto").
- Consigli stagionali se pertinenti.

Ogni task è completabile, rimandabile o saltabile con un tap. Gli alert da sensore hanno priorità visiva rispetto ai reminder da calendario.

### Scheda dettaglio pianta

Mostra foto, nome, specie, prossime cure, storico recente. Se associata a un vaso smart, include una sezione dati ambientali con:

- Umidità del suolo attuale e storico delle ultime 24/48 ore.
- Luce ambientale media del giorno.
- Temperatura rilevata.
- Stato connessione vaso.

Le informazioni botaniche sono sempre in linguaggio semplice:

- Luce consigliata (bassa / media / alta).
- Annaffiatura (poca / media / frequente, modulata per clima o sensore).
- Concime.
- Temperatura da evitare.
- Tossicità, se disponibile.

### Scheda dettaglio bouquet

Mostra foto, data ricezione, giorni trascorsi, stato sintetico e prossimi task. Include guida pratica su come prolungarne la durata.

### Storico e diario

Ogni pianta ha uno storico delle azioni (data, tipo, nota opzionale) e, se connessa al vaso smart, uno storico dei dati ambientali con grafici semplici. Il diario foto è una timeline di immagini con data e nota testuale.

---

## 14. Catalogo specie — architettura a tre livelli

### Livello 1 — Catalogo curato interno

Circa 100 specie comuni da interno, costruite e mantenute dal team Fiora. Dati derivati da Trefle in fase di importazione batch, poi revisionati editorialmente in linguaggio semplice e orientato all'azione.

- Disponibile offline, senza dipendenze esterne a runtime.
- Aggiornamento manuale periodico dal team.
- Priorità massima: copre le specie più rilevanti per il target.

### Livello 2 — Trefle API (fallback)

Per le specie non nel catalogo curato, l'app interroga Trefle in tempo reale. I dati grezzi vengono mappati nello schema interno. I risultati vengono cachati localmente dopo la prima interrogazione.

Se Trefle non risponde o non ha dati, l'utente può procedere con una pianta generica a parametri manuali.

> ⚑ Trefle è open source e gratuita ma senza garanzie di continuità. Valutare Perenual (~60$/mese) come sostituto dalla v2 se il volume lo richiede.

### Livello 3 — Contributi utente (verificati)

Gli utenti possono proporre specie non trovate nei livelli 1 e 2.

**Flusso:**

1. L'utente cerca una specie non trovata.
2. Sceglie "Aggiungi specie mancante" e compila i campi.
3. Viene verificata su Trefle: se presente viene aggiunta al DB, altrimenti va in revisione admin.
4. L'utente può usarla subito nella propria collezione (visibile solo a lui fino all'approvazione).
5. L'admin approva o rifiuta con nota.
6. Se approvata, entra nel catalogo condiviso.

**Campi obbligatori:** nome comune, categoria, luce consigliata, frequenza annaffiatura.

**Campi facoltativi:** nome scientifico, umidità, temperatura min/max, tossicità, note, foto.

> ⚑ Il team Fiora può promuovere specie dal livello 3 al livello 1 quando diventano sufficientemente diffuse.

### Schema interno condiviso

Tutti e tre i livelli producono lo stesso formato normalizzato:

```
nome_comune        string
nome_scientifico   string
categoria          enum
luce               enum: bassa / media / alta
annaffiatura       enum: poca / media / frequente
umidita            enum: bassa / media / alta  (nullable)
temp_min           integer °C  (nullable)
temp_max           integer °C  (nullable)
tossicita          boolean  (nullable)
note_cura          string
soglia_umidita     integer %  (nullable, usata dal vaso smart)
fonte              enum: curato / trefle / utente
stato              enum: attivo / in_revisione  (solo livello 3)
```

> ⚑ Il campo `soglia_umidita` è nuovo rispetto alle versioni precedenti: definisce la percentuale di umidità del suolo sotto la quale il vaso smart attiva un alert. Viene precompilato per le specie del catalogo curato e modificabile dall'utente.

---

## 15. Modello freemium

Il prodotto nasce freemium. Nella fase 1 la priorità è l'adozione. L'esperienza gratuita deve essere pienamente utile nelle funzioni fondamentali, incluso l'uso base del vaso smart. I limiti premium saranno definiti in base ai dati di utilizzo reali.

---

## 16. Principi UX

- Linguaggio semplice, non botanico, non tecnico.
- I dati del sensore non vengono mostrati come numeri grezzi: vengono sempre tradotti in stato comprensibile e azione consigliata.
- Ogni schermata permette un'azione immediata o comunica lo stato in pochi secondi.
- Pochi passaggi per ogni flusso; task completabili con un tap.
- L'app funziona anche senza vaso smart e senza notifiche push attive.
- Il vaso smart deve sembrare un'estensione naturale dell'app, non una funzione separata o avanzata.

---

## 17. Indicatori di validazione

- Numero medio di piante create per utente.
- Percentuale di utenti che completano almeno un task nella prima settimana.
- Frequenza di apertura della schermata "Oggi".
- Tasso di completamento dei reminder.
- Percentuale di utenti che connettono un vaso smart.
- Tempo medio tra il pairing del vaso e il primo alert ricevuto (misura l'attivazione reale).
- Retention a 7 e 30 giorni.
- Numero di specie proposte dagli utenti.

---

## 18. Evoluzioni future (non incluse in v1)

- Identificazione da foto e diagnosi delle malattie.
- Annaffiatura automatica integrata nel vaso smart (se il partner hardware lo supporta).
- Consigli avanzati basati su storico ambientale a lungo termine.
- Feed social o community delle piante.
- Funzioni familiari condivise (più utenti sulla stessa collezione).
- Sostituzione di Trefle con API commerciale per maggiore copertura.
- Widget home screen con i task del giorno.
- Export scheda cura da condividere.

> ⚑ Nessuna di queste direzioni deve influenzare la semplicità della prima versione del prodotto.

---

## 19. Sintesi

La v1 di Fiora è un prodotto mobile connesso, orientato all'azione quotidiana, costruito per utenti comuni. Le fondamenta sono: autenticazione e sync cloud, gestione di piante di qualsiasi tipo con il bouquet come categoria, vaso smart con sensori ambientali integrati, reminder intelligenti che reagiscono allo stato reale della pianta, schermata "Oggi" come centro operativo, storico delle cure e dati ambientali, catalogo a tre livelli con contributi utente verificati.

Il vaso smart non è un accessorio opzionale: è parte integrante della proposta di valore della v1 e distingue Fiora da qualsiasi app di plant care puramente software.
