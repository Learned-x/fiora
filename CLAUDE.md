# Fiora — Contesto progetto per Claude Code

## Cos'è questo progetto
App mobile per la cura delle piante con integrazione IoT (vaso smart con sensori).
Monorepo con backend Node.js (`/backend`), app mobile React Native/Expo (`/mobile`) e firmware ESP32 (`/firmware/vaso`, Arduino).

## Documentazione (`/docs`) — riordinata il 2026-07-27
Cinque documenti, ognuno con un ruolo distinto. **Non crearne altri**: aggiornare quello pertinente.
- **`fiora-specifiche-funzionali.md`** — cosa fa l'app, per utente. Ogni sezione ha un marcatore di stato (✅ / 🚧 / 📋). Ha assorbito il vecchio documento "integrazioni".
- **`fiora-specifiche-tecniche.md`** — come è implementata (schema DB, API, MQTT, firmware, OTA in §16). Ha assorbito il documento OTA separato.
- **`fiora-roadmap.md`** — fasi, stato di avanzamento e **debito noto D1–D11** (bug firmware, test rotti). Numerazione fasi allineata a questo file.
- **`fiora-mev.md`** — **MEV-01..07**, manutenzione evolutiva post-Fase 6. MEV = miglioria a una funzione che già si comporta come specificato; il debito D1–D11 è invece codice non allineato alle specifiche.
- **`fiora-manuale-ambienti.md`** — setup dev/staging/produzione. §2.0 = staging realmente in uso.
- `docs/archivio/` — documenti superati tenuti come riferimento (catalogo botanico esteso).

Le specifiche descrivono il **target**: dove il firmware è indietro, la differenza è marcata nel documento e tracciata come debito nella roadmap.

## Stato attuale sviluppo
**Fase 0 ✅ — Fase 1 ✅ — Fase 2 ✅ — Fase 3 ✅ — Fase 4 ✅ — Fase 4.5 ✅ — Fase 8 ✅** (push calendario, 2026-07-13) + **Fase 10 parziale** (onboarding invertito + pagina intro) + **Fase 6 in corso** (pairing BLE vaso smart, 2026-07-24; schermate Vasi/dettaglio vaso + sensori in dettaglio pianta, 2026-07-25).
Tag `v0.1.0` su `main` (2026-07-24) = baseline pre-Fase 6. Decisione (2026-07-24): niente TestFlight per ora, build di test installate manualmente via Xcode+cavo (iOS) o `expo run:android --device` (Android) su device reale; staging gira su server Ubuntu locale (stessa rete LAN di casa).
**Aggiornamento 2026-08-04**: comprato abbonamento Apple Developer Program, primo tentativo TestFlight in corso (vedi "Bundle ID" e "Sign in with Apple" sotto). Fino a qui vale ancora la decisione sopra per Android; per iOS si sta valutando anche EAS submit.

### ⚠️ Bundle ID cambiato: `com.fiora.app` → `app.fiora.mobile`
`com.fiora.app` (iOS **e** Android, `mobile/app.json`) dava "Invalid string" creando l'App ID su developer.apple.com, pur non risultando registrato né sul nostro account né altrove — residuo del vecchio setup a personal team (pre-abbonamento) mai propagato bene sul portale, non risolto nemmeno eliminando profili/certificati locali. Bundle cambiato in `app.fiora.mobile` (commit `64b12d5`), che si è creato senza problemi. Client OAuth Google (iOS e Android) aggiornati **in-place** sullo stesso bundle nuovo — nessun nuovo Client ID, nessun cambio di codice lato Google. **Ogni build EAS/locale già installata prima di questo commit ha il bundle vecchio**: va disinstallata e rifatta da zero, non aggiornabile in-place (bundle ID diverso = app diversa per iOS/Android).

### Sign in with Apple — collegato lato mobile (2026-08-04)
Backend verificava già `identityToken` Apple (da tempo), ma il bottone in app era placeholder. Ora funzionante: `expo-apple-authentication` installato, `signInWithApple()`/`loginWithApple()` (stesso pattern di Google), bottone visibile solo se `AppleAuthentication.isAvailableAsync()` (iOS 13+, nascosto su Android). `fullName` (Apple lo dà solo al primissimo consenso, mai nel token JWT) ora passato dal client e salvato al primo login — prima veniva scartato sempre. App ID `app.fiora.mobile` ha la capability "Sign In with Apple" abilitata su developer.apple.com; `APPLE_CLIENT_ID=app.fiora.mobile` impostato in `.env.development` (locale) e `.env.staging` (server Ubuntu, riavviato). **Non ancora testato su device reale** con build che riflette il bundle nuovo — nessuna build esiste ancora con `app.fiora.mobile`, prima build in corso (staging, per verificare Google+Apple prima di tentare TestFlight/production).
**Da testare stasera/prossima sessione** (vedi dettagli in Fase 6 sotto): pairing BLE completo su device Android reale, firmware con provisioning su hardware fisico.

### ⚠️ Bug aperto: collega/scollega pianta nel dettaglio vaso
`app/vase/[id].tsx` — le azioni "Cambia pianta" e "Scollega" (via `ActionSheet` → `updatePlant(id, {vasoId})`) restituiscono "Operazione non riuscita" lato app, ma il backend risponde 200 se chiamato via curl con lo stesso payload (verificato 2026-07-25). Il fallimento coincideva con un episodio di corruzione I/O in Docker Desktop (containerd, risolto con restart Docker Desktop) — non riverificato dopo il fix se il bug persiste. Investigare prima da qui: possibile causa client (stato React stale, richiesta che parte prima che `vase` sia popolato) più che backend.

### Redesign UI mobile — foundation + back-nav (2026-08-04, in corso)
Motivo: UI cresciuta screen-per-screen senza sistema condiviso — "tutto piccolo, posizionato male, misto bottoni/scritte", 6+ implementazioni diverse di back navigation (audit completo: 18 `fontSize` distinti, 19 `borderRadius` distinti, nessuno spacing/type/radius token esistente prima). Palette cambiata da iOS-system default a palette "Plant Care" (verde `#15803D`/`#22C55E`, non più `#34C759`), **ma sfondo resta bianco/nero puro** (`bg`/`card` = `#FFFFFF`/`#000000` — richiesta esplicita utente, il verde-mint di sfondo testato in precedenza non piaceva). Stile "Soft UI Evolution": card con `elevation.sm/md/lg` (ombra vera, non solo `backgroundColor` piatto), gerarchia tipografica forte (titoli 32-34px invece di 28-30px flat).
- **Nuovi file token**: `src/theme/spacing.ts` (xs4→xxxl48), `src/theme/typography.ts` (h1/h2/h3/body/caption, **manca `lineHeight`** — vedi debito sotto), `src/theme/radius.ts` (sm8→full999), `src/theme/elevation.ts` (wrapper `Platform.select` iOS shadow/Android elevation), `src/theme/index.ts` (barrel).
- **Nuovi componenti condivisi**: `BackButton.tsx` (chevron+"Indietro" fisso, `router.canGoBack()` guard con fallback `replace('/')`, sostituisce 8 implementazioni copy-paste del path SVG `M8 1L1.5 7.5L8 14`), `ScreenHeader.tsx` (back+titolo+slot azione destra), `Card.tsx` (wrapper ombra esterno + view clippata interna — **`overflow:'hidden'` va tenuto solo sull'inner view**, altrimenti clippa l'ombra stessa, bug comune RN), `SectionLabel.tsx`.
- **Back nav standardizzata**: label sempre "Indietro" (non più contestuale tipo "Piante"/"Vasi" in `plant/[id].tsx`/`vase/[id].tsx`), sempre `router.back()` letterale. `edit-plant.tsx` "Annulla" ora **visivamente distinto** da back (testo neutro `t2` a destra, non più verde stile back a sinistra — prima stesso pattern visivo di back ma significava cancel). `login.tsx`/`register.tsx`/`forgot-password.tsx`/`reset-password.tsx` avevano **zero back button** (raggiunte via `router.push`, nessuna via d'uscita se non gesture/hardware back) — ora tutte con `ScreenHeader`.
- **Migrazione completa**: tutte le schermate app (tabs, auth, plant/vase detail, form/settings) usano ora token+componenti condivisi. Solo `(auth)/index.tsx` (pagina intro) e `reset-password.tsx` **non ancora migrati** — restano con valori raw (`padding: 16`, `fontSize: 26` hardcoded).
- **Debito noto da audit successivo** (non ancora risolto):
  - `ScreenHeader` ha `minWidth: 80` fisso su entrambi i lati, ma `BackButton` con "Indietro" misura ~95px → sfora, il titolo centrato risulta visibilmente spostato. Fix previsto: `flex: 1` su entrambi i lati invece di `minWidth` fisso.
  - **Zero `lineHeight`** su ~20 titoli con `fontSize` 26-34 + `fontWeight: '800'` — rischio di clipping su lettere accentate italiane (È, à, ù) essendo RN diverso da web nel calcolo altezza riga.
  - Scala titoli ancora incoerente nonostante i token: 4 valori diversi in uso (34 tabs, 32 auth, 28 change-password/email/plant-history, 26 reset-password/vase-pair/plant-name) — `typography.ts` definisce `h1:30`/`h2:22` ma **nessuna schermata li usa ancora**, tutte hardcodano il proprio valore.
  - `paddingHorizontal: 4` ripetuto 11 volte per allineare le `fieldLabel` agli input sottostanti (aggiustamento a occhio, non derivato dal padding reale dell'input) — fragile a cambi futuri.
- **Debito UX più ampio, non ancora affrontato** (audit separato): 0 `accessibilityLabel` su 59 `Pressable` in tutta l'app, 0 feedback al tocco (`android_ripple`/`pressed`), 6 schermate con `catch {}` silenzioso su errori di rete (nessun segnale visivo, solo commento nel codice), nessuno stato di loading iniziale distinto dall'empty state (skeleton assente ovunque), `Alert.alert` di sistema usato per 37 casi invece del pattern `ActionSheet` già adottato in `vase/[id].tsx`, nessun update ottimistico sulle azioni task (tocco "completa" aspetta `await` + reload completo prima di mostrare cambiamento).

## Setup ambiente Android su altro Mac (es. lavoro fuori casa)
Fatto il 2026-07-24 su questo Mac, da rifare se si lavora da un Mac diverso (SDK/cache non sincronizzati via git):
1. **Android SDK cmdline-tools** (mancavano: SDK aveva solo platform-tools/emulator, niente `sdkmanager`/`avdmanager`):
   ```bash
   mkdir -p "$HOME/Library/Android/sdk/cmdline-tools"
   curl -o /tmp/cmdline-tools.zip -L https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip
   unzip -q /tmp/cmdline-tools.zip -d "$HOME/Library/Android/sdk/cmdline-tools"
   mv "$HOME/Library/Android/sdk/cmdline-tools/cmdline-tools" "$HOME/Library/Android/sdk/cmdline-tools/latest"
   ```
2. **`ANDROID_HOME` in `.zshrc`** (verificare presente, altrimenti `adb`/`emulator` non trovati in shell):
   ```bash
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin"
   ```
3. **System image + emulatore** (per test senza device fisico — attenzione: BLE non funziona su emulatore, serve device reale per pairing vaso):
   ```bash
   yes | sdkmanager --licenses > /dev/null 2>&1
   sdkmanager "platform-tools" "platforms;android-34" "system-images;android-34;google_apis;arm64-v8a" "emulator"
   avdmanager create avd -n Fiora_Test -k "system-images;android-34;google_apis;arm64-v8a" -d pixel_6
   emulator -avd Fiora_Test -no-snapshot-load &
   ```
4. **Build**: `cd mobile && npx expo run:android` (device fisico: aggiungere `--device <model>`, es. `2107113SG` per Galaxy; con `adb devices -l` si legge il campo `model:`)

### Problemi noti risolti (probabile ripresentarsi su altro Mac)
- **Gradle cache corrotta** (`Could not read workspace metadata from .../kotlin-dsl/accessors/.../metadata.bin`): causato da 2 daemon Gradle vivi contemporaneamente con JDK diversi (visto: Corretto 17 + Homebrew OpenJDK 21). Fix: `cd mobile/android && ./gradlew --stop`, poi `rm -rf ~/.gradle/caches/8.14.3`, ribuild pulito. Se JDK multipli installati, verificare `JAVA_HOME` non ambiguo prima di lanciare Gradle.
- **`react-native-svg` install locale corrotto** (mancava intera cartella `android/` in `node_modules/react-native-svg`, solo `apple/`,`windows/`,`common/` presenti — causa ignota, forse interruzione npm install): sintomo runtime `IllegalViewOperationException: Can't find ViewManager 'RNSVGPath'` schermata rossa DevLauncher. Fix: `rm -rf node_modules/react-native-svg && npm install react-native-svg@<versione da package.json> --no-save`. **Non basta**: l'autolinking Gradle cachava la lista pacchetti nativi da PRIMA del fix, quindi serve anche pulire `android/build`, `android/app/build`, `android/.cxx`, `android/app/.cxx` per forzare rigenerazione autolinking (verificabile in `android/build/generated/autolinking/autolinking.json`, deve comparire `react-native-svg` tra le dependencies).
- **Google Sign-In Android `DEVELOPER_ERROR` code 10**: serve un Client ID OAuth di tipo **Android** su Google Cloud Console (diverso dal client Web/iOS già esistente), con package `com.fiora.app` + SHA-1 del keystore debug locale (`android/app/debug.keystore`, non `~/.android/debug.keystore` — usa quello dentro il progetto). SHA-1 si ottiene con `keytool -list -v -keystore android/app/debug.keystore -storepass android -alias androiddebugkey -keypass android`. **Ogni keystore diverso (altro Mac, build EAS, ecc.) ha SHA-1 diverso** → va aggiunto come client Android separato (o fingerprint aggiuntivo) in Console, altrimenti stesso errore su ogni macchina/build nuova. Non serve mettere questo nuovo client ID Android nel codice/env — Google lo trova da solo via package+SHA-1, il `webClientId` in `.env.development` resta quello usato per la verifica lato backend.

### ✅ Risolto: mismatch pairing BLE mobile/firmware
Il firmware è stato riscritto e modularizzato (commit `c146237`, 2026-07-31 circa — non documentato al momento del commit, scoperto e verificato in audit il 2026-07-31): non più `vaso.ino` monolitico ma entry point **`firmware/vaso/vaso-testnale.ino`** (nome non allineato al resto del progetto, verificare se è un refuso da rinominare) + moduli `config.h/.cpp`, `ble_provisioning.h/.cpp`, `wifi_manager.h/.cpp`, `mqtt_handler.h/.cpp`, `sensors.h/.cpp`, `sleep_manager.h/.cpp`. `ble_provisioning.cpp` legge correttamente `mqtt_user`/`mqtt_pass`, allineato al payload mobile. Stesso audit ha chiuso anche il debito D3 (parziale)/D4/D5/D6/D7/D11 — dettagli in `docs/fiora-roadmap.md`. **Nessun pairing è comunque ancora stato testato su questo firmware nuovo su hardware reale.** Nuovi problemi trovati: D12 (`bmp.begin()` fallito blocca il boot in loop infinito, nessuna diagnosi da remoto) e D13 (`Adafruit_BME280 bme` dichiarato e mai usato in `sensors.cpp`).

## Workflow Git (Git Flow)
- **`main`**: solo release taggate, sempre deployabile/stabile. Mai commit diretti.
- **`develop`**: branch di lavoro quotidiano, base per le feature. Deploya in **staging** (server Ubuntu) ad ogni push/merge — ambiente di test continuo.
- **`feature/*`**: da `develop`, merge in `develop` a fine lavoro.
- **`release/x.y.z`**: da `develop` quando si stabilizza una versione candidata per test manuale su iPhone. Solo bugfix qui dentro, no nuove feature. A fine stabilizzazione: merge in `main` (tag `vx.y.z`) **e** back-merge in `develop`.
- **`hotfix/*`**: da `main`, per fix urgenti su una release già taggata. Merge in `main` (nuovo tag patch) **e** back-merge in `develop`.
- **Versioning**: SemVer (`vMAJOR.MINOR.PATCH`), tag git su `main` ad ogni release. `CHANGELOG.md` aggiornato ad ogni release (sezione `[Unreleased]` durante lo sviluppo). Mobile: `app.json` `version`/`ios.buildNumber` allineati al tag alla creazione del branch `release/*`.

### Completato
- Infrastruttura Docker locale: PostgreSQL (TimescaleDB), Redis, MinIO
- Schema Prisma completo con migrate (`npx prisma migrate dev`)
- TimescaleDB hypertable su `sensor_readings` (retention 90 giorni)
- MQTT subscriber attivo sul backend (`src/lib/mqtt.ts`) — connesso a HiveMQ Cloud
- Auth completa: `/auth/register|login|refresh|logout`, OAuth Google (`/auth/oauth/google`), Apple (backend pronto, credenziali mancanti), account deletion con grace period 30gg (BullMQ)
- Campo `name` su User (opzionale, backfill da Google)
- **Fase 2**: CRUD `/plants` (soft delete), task `/plants/:id/tasks` + `/tasks` (completa/rimanda/salta con action log), catalogo `/species` in sola lettura, seed 6 specie curate (`npm run seed`)
- **Fase 3**: reminder engine BullMQ (`src/services/reminder.service.ts`, `src/jobs/reminder.job.ts`) — job ricorrente (repeatable, cron `0 6 * * *` via `upsertJobScheduler`) genera task `annaffiatura` sorgente `calendario` per piante attive con specie collegata, intervallo giorni mappato da `Species.annaffiatura` (poca=10gg/media=5gg/frequente=2gg, hardcoded in `INTERVALLO_ANNAFFIATURA_GIORNI`); piante senza specie o bouquet escluse
- Swagger su `/docs`, export OpenAPI JSON su `/docs.json` (import Postman)
- Test jest: 153 passati (route + service, prisma mockato)
- Mobile: Expo Router, onboarding clima → auth, login/registrazione email, Google Sign-In nativo funzionante (dev build EAS simulatore iOS), token in SecureStore, refresh interceptor
- **Fase 4**: UI mobile — tab bar custom (Oggi/Piante/Aggiungi/Vasi/Impostazioni), schermata Oggi (task con Completa/Rimanda/Salta), collezione grid con filtri, dettaglio pianta/bouquet (guida cura, ciclo vita, azioni rapide), form aggiungi/modifica con picker specie, impostazioni con logout; Vasi placeholder (Fase 6)
- **Fase 4.5 backend** (2026-07-13): migration `fase_4_5_consolidamento` — User (+`onboardingDone`, `mostraNomiScientifici`, `orarioReminder`, `role`, `pushToken`), Plant (+`statoBouquetManuale`), tabella `app_options` (unique `categoria+chiave`); reminder engine esteso (`runReminderEngine`): fattore clima su annaffiatura (`FATTORE_CLIMA`: freddo 1.3/temperato 1.0/appartamento 1.0/mediterraneo 0.8/tropicale 0.7, min 1gg), concimazione 30gg solo mar-ott, bouquet `cambio_acqua` 2gg + `controllo_stato` 1gg + stato automatico da `dataRicezione` (0-2 fresco/3-6 in_cura/7-10 appassendo/>10 concluso, skip se `statoBouquetManuale`); `ricalcolaScadenzeClima` su cambio clima (solo piante `vasoId:null`); TASK_TYPES +5 tipi (`cambio_acqua`, `taglio_steli`, `controllo_stato`, `rotazione`, `pulizia_foglie`; `controllo` deprecato); rimanda rifiuta scadenza passata (`TASK_SCADENZA_PASSATA`); flag derivato `inRitardo` (pending + scadenza >3gg fa) in ogni response task; archiviazione pianta ora salta i task pending (come delete); `giaInAcqua` su create bouquet → task iniziale `cambio_acqua`; nuovi endpoint `GET /auth/me`, `POST /auth/change-password`, `PATCH /users/me` (name/clima/mostraNomiScientifici/orarioReminder), `GET /options[/:categoria]`, `GET /plants/:id/actions` (storico paginato, filtri tipo/periodo); login con grace period non blocca più: restituisce `graceperiod {active, deletedAt, giorniRimanenti}`; seed: 12 specie + 39 `app_options`; test 133 passati
- **Fase 4.5 mobile** (2026-07-13, commit `f0df682`): banner grace period con annulla eliminazione, preset Rimanda 2h/domani/2gg, conferma "ELIMINA" su delete pianta, schermata Storico cure, indicatore `inRitardo`, cambio password, clima in Impostazioni, `giaInAcqua` su create bouquet
- **Fase 8 backend** (2026-07-13): push Expo solo reminder calendario (niente alert sensori, rimandati a Fase 7) — `notification.service.ts` (`buildPushMessage`: 1 task → "🌱 Annaffia <Nome>" deep link `/plant/<id>`, N task → digest "Hai N cure da fare oggi" deep link `/`), coda BullMQ `push-reminders` + `notification.job.ts` (cron `0 9,15,19 * * *`, worker mappa ora→`orarioReminder` via `orarioFromHour`), utenti con `pushToken` non null e task pending `scadenza <= endOfDay`; ticket `DeviceNotRegistered` → azzera `pushToken`; `pushToken` (string|null) su `PATCH /users/me` e nelle select profilo; `expo-server-sdk@3` (v4 è ESM-only, backend CommonJS); test 153 passati
- **Fase 8 mobile** (2026-07-13): `expo-notifications`+`expo-device` (plugin in app.json — richiede rebuild dev client EAS), hook `src/hooks/usePushNotifications.ts` (register/disable + `useNotificationObserver` per tap → deep link, cold start incluso), toggle Notifiche + riga Orario promemoria in Impostazioni; token iOS solo su device reale (simulatore: fallisce con grazia)
- **Onboarding invertito + intro** (2026-07-13, Fase 10 parziale): pagina intro pre-auth 3 slide (`app/(auth)/index.tsx`), flusso intro → auth → login/register → clima post-auth (`app/onboarding/climate.tsx`, gated da `onboardingDone` in `(tabs)/_layout`, gate soft se profilo non caricato); `pendingClima` rimosso dallo store; prompt permessi push a fine onboarding
- **Fase 6 backend — pairing vaso** (2026-07-24, commit `29176a3`): `src/services/vase.service.ts` + `src/routes/vase.routes.ts` montate su `/vases` (requireAuth) — `POST /vases/pair` (genera `device_id` UUID + restituisce credenziali MQTT), `GET /vases`, `GET/PATCH/DELETE /vases/:id`; `src/lib/mqtt.ts` handler reali: `handleTelemetry` risolve `deviceId→vasoId` e scrive `sensor_readings` + aggiorna `lastSeen`/batteria, `handleStatus` segna vaso connesso/disconnesso da messaggi `{status:"online"|"offline"}`
- **Fase 6 firmware** (2026-07-24, `firmware/vaso/vaso.ino`, non nel monorepo prima): sketch ESP32 riscritto — WiFi/MQTT/device_id NON più hardcoded, letti da `Preferences` (flash); se assenti all'avvio parte BLE advertising `Fiora-XXXX` (MAC-based) con servizio custom (UUID `6e400001-...`, characteristic WRITE `6e400002-...`), riceve JSON `{ssid,password,device_id,mqtt_username,mqtt_password}` via `ArduinoJson`, salva e riavvia; fix bug preesistente: `publishTelemetry()` non era mai chiamata nel `loop()`, payload aveva luce/temperatura/batteria commentati
- **Fase 6 mobile — schermata pairing** (2026-07-24, `app/vase/pair.tsx`): flusso **scan-first** (scansiona subito all'apertura → lista device `Fiora-*` trovati → utente seleziona → SOLO ALLORA form WiFi, non il contrario); dopo invio credenziali via BLE fa **verifica reale** (polling `GET /vases/:id` fino 45s finché `stato:'connesso'`, non solo "credenziali inviate"); errori BLE tradotti per codice (`BluetoothPoweredOff`, `DeviceDisconnected`, `OperationTimedOut`, ecc.) invece di messaggi grezzi; retry contestuale (fallimento in fase WiFi torna al form con SSID/password già compilati); cleanup vaso orfano lato backend se il provisioning fallisce dopo la creazione; `react-native-ble-plx` installato (richiede dev client nativo, no Expo Go); encoder base64 custom UTF-8 (no `btoa`, rompe con caratteri accentati in SSID/password)
- **Fase 6 backend — dettaglio/storico vaso** (2026-07-25): `GET /vases/:id` ora include `plants` (pianta associata, `include` su `findOwnedVase`) e `ultimaLettura` (ultima riga `SensorReading`); nuovo `GET /vases/:id/readings` (letture ultime 24h, non aggregate); `PATCH /plants/:id` accetta `vasoId` (collega/scollega, valida ownership vaso e che non sia già collegato a un'altra pianta → `VASE_ALREADY_LINKED`); `speciesSelect` (dettaglio pianta) esteso con `sogliaUmidita`/`tempMin`/`tempMax` per calcolare stato sensori lato client
- **Fase 6 mobile — schermate Vasi e dettaglio vaso** (2026-07-25): `app/(tabs)/vasi.tsx` riscritta (lista reale con stato/batteria/pianta collegata, era placeholder statico); nuova `app/vase/[id].tsx` (dati ambientali, banner disconnesso, azioni collega/scollega pianta e rimuovi vaso); nuovo componente `ActionSheet` (bottom sheet custom, sostituisce `Alert.alert` di sistema in questa schermata su richiesta esplicita — non applicato al resto dell'app); nuovo `PlantPickerModal` per selezionare pianta da collegare
- **Fase 6 mobile — sensori in dettaglio pianta** (2026-07-25): `app/plant/[id].tsx` mostra sezione "Vaso smart" (se pianta ha vaso collegato) con 3 tile umidità/luce/temperatura (colore verde/ambra da soglie specie, etichette semantiche tipo "Umido"/"Asciutto"/"Ottimale") e sparkline umidità 24h (nuovo componente `Sparkline`, SVG `Polyline`); bottone "Vaso Smart" nelle azioni rapide (griglia ora 2x2 con "Storico cure")
- **Bug noto**: vedi nota "Bug aperto" a inizio file — collega/scollega pianta da `vase/[id].tsx` non affidabile lato client, backend verificato correttamente funzionante via curl
- **D9 chiuso** (2026-07-31, non ancora testato su hardware): pairing BLE trasmette anche `mqtt_host`/`mqtt_port` (prima hardcoded nel firmware), pronti per migrazione a Mosquitto in prod senza reflash. Aggiunta rinomina vaso da `vase/[id].tsx` (API backend già pronta, mai collegata a UI)
- **MEV-02 ✅ completa** — email transazionali e recupero password:
  - **Recupero password** (2026-07-31, testato end-to-end): Resend integrato (`src/lib/email.ts`), coda BullMQ `email` + worker (`src/jobs/email.job.ts`), token hash SHA-256 scadenza 30min a uso singolo, reset revoca tutti i refresh token, risposta API sempre identica anti-enumerazione; mobile `app/(auth)/forgot-password.tsx` + `app/reset-password.tsx`. Pagina fallback web su `GET /reset-password` (`app.ts`) rilancia lo schema `fiora://` (niente dominio pubblico verificato per universal link reali).
  - **Cambio email** (2026-08-04): stesso pattern token (30min, hash SHA-256, `User.pendingEmail*`, migration `20260804000000_mev02_cambio_email`); `POST /auth/change-email` (richiede password attuale) invia verifica al nuovo indirizzo + notifica al vecchio (anti-dirottamento); `POST /auth/verify-email` applica il cambio; fallback web `GET /verify-email` come per il reset password; mobile `app/change-email.tsx` + `app/verify-email.tsx`, riga in Impostazioni nascosta per utenti Google/Apple-only (senza password Fiora).
  - **Conferma eliminazione account** (2026-08-04): `requestAccountDeletion` (esisteva già lato backend, mai notificava) ora invia email riepilogativa con data eliminazione; aggiunto anche il trigger UI mancante in Impostazioni ("Elimina account", conferma nativa) — prima esisteva solo l'annullamento di una richiesta già in corso, non il modo di avviarla dall'app.
  - Mittente sandbox Resend (`onboarding@resend.dev`) consegna solo alla casella dell'account Resend, non a utenti reali — da sostituire quando c'è un dominio verificato (SPF/DKIM/DMARC), vale per tutte le email di questa MEV

### Prossimi passi
- **Investigare bug collega/scollega pianta** (vedi nota bug aperto a inizio file) prima di considerare il flusso vaso↔pianta completo
- **Da testare (Fase 6, prossima sessione/stasera)**: pairing BLE end-to-end su device Android reale (non ancora provato, solo iOS-dev-client testato in build); build locale Android (`npx expo run:android --device`, richiede `ANDROID_HOME` in `.zshrc`); flash firmware nuovo su hardware ESP32 reale (finora solo la versione vecchia con credenziali hardcoded ha girato); verificare che l'utente MQTT condiviso (quello del backend, restituito dal pairing) abbia permessi corretti su HiveMQ Cloud per publish/subscribe sui topic `fiora/vaso/+/...`
- **Ambiente staging** (in corso, 2026-07-24): backend in Docker su server Ubuntu locale (LAN casa), Postgres+Redis dedicati staging, `.env.staging`, `docker-compose.staging.yml`; mobile build EAS profilo `staging` puntata a IP LAN del server, installata su iPhone via Xcode+cavo (no TestFlight, manca account Apple Developer)
- Script import CSV specie in `species_import_raw` (da scrivere, dentro /backend)
- Rimandati: Fase 5 (foto MinIO), Fase 7 (alert sensori), fiori bouquet, empty state suggerimenti
- QA push su device reale: token iOS, ricezione notifiche, tap → deep link
- **TestFlight** (2026-08-04, in corso): abbonamento Developer Program attivo, Apple Sign-In collegato lato mobile (vedi nota bundle ID sopra). Prossimo passo: build EAS `staging` sul bundle nuovo (`app.fiora.mobile`) per verificare Google+Apple Sign-In su device reale prima di tentare `production`/EAS submit. Primo tentativo build `staging` falliva su "Failed to create Apple distribution certificate" (causa non ancora isolata, riprovare in modalità interattiva e leggere il log completo)
- ~~npm test backend rotto~~ — **risolto/non riproducibile** (verificato 2026-07-31): 153/153 test passano puliti su questa macchina (`node v20.20.2`, `jest 30.4.2`, `ts-jest 29.4.11`). Probabile causa originale un `node_modules` incompleto su un'altra macchina — se ricompare, `rm -rf node_modules && npm install` prima di indagare oltre.

### Note build iOS locale (npx expo run:ios)
- Lo spazio nei path ("SSD Lexar", "Fiora TG") rompeva script di build RN/Expo. Patch attive:
  - `mobile/patches/expo-constants+18.0.13.patch` (via patch-package, postinstall) — quoting in EXConstants podspec e get-app-config-ios.sh
- **`npx expo run:ios --device` funziona** (verificato 2026-08-11, build su iPhone via cavo riuscita) — la fase "Bundle React Native code and images" che secondo audit precedente falliva sul backtick non quotato NON si è ripresentata, causa non chiara (forse fix a monte in Expo/RN, o l'audit era su condizioni diverse). Se si ripresenta, isolare di nuovo dove fallisce prima di assumere serva EAS.
- Xcode 26 richiede runtime simulatore iOS 26 (scaricato)

## Scelte progettuali fatte (con motivazione)
- **Reminder engine su BullMQ repeatable job** (`upsertJobScheduler`, cron `0 6 * * *`) invece di cron di sistema: già usiamo BullMQ per account deletion, un solo meccanismo di scheduling
- **Intervalli annaffiatura e fattori clima come costanti backend** (`INTERVALLO_ANNAFFIATURA_GIORNI`, `FATTORE_CLIMA` in reminder.service.ts) — `app_options` esiste (Fase 4.5) ma serve solo per le dropdown UI, non per la logica reminder; spostamento eventuale post-MVP
- **statoBouquetManuale** (Fase 4.5): PATCH esplicito di `statoBouquet` imposta il flag e il cron non ricalcola più lo stato; nessun modo di riattivare l'automatismo (fuori scope)
- **Grace period non blocca il login** (Fase 4.5): `AUTH_ACCOUNT_DELETED` rimosso, la risposta login include `graceperiod` — il mobile mostra banner con annulla eliminazione
- **Compound unique Prisma 7**: il nome nel client è quello dell'attributo `@@unique(name:...)` (es. `uq_app_options_categoria_chiave`), NON `campo1_campo2`
- **Riferimento scadenza task**: `completatoA ?? createdAt` dell'ultimo task annaffiatura, altrimenti `plant.createdAt`; skip se esiste già task pending (no duplicati)
- **Google Sign-In**: client OAuth Web (ID token verificato dal backend), flusso nativo via dev build EAS — Expo Go non supporta il modulo nativo
- **Apple Sign-In**: collegato lato mobile 2026-08-04 (`expo-apple-authentication`, flusso nativo via dev build EAS — Expo Go non lo supporta, come Google); bottone nascosto su Android/iOS<13 via `AppleAuthentication.isAvailableAsync()`
- **Dark mode**: `userInterfaceStyle: "automatic"` in app.json (era "light", bloccava il tema scuro; richiede rebuild nativa perché finisce in Info.plist)
- **Guard auth nelle tabs**: `app/(tabs)/_layout.tsx` fa `Redirect` a `/(auth)/climate` se non autenticato; NON esiste `app/index.tsx` (creava conflitto di route con `(tabs)/index.tsx`, entrambi risolvono `/`)
- **SpeciesPickerModal condiviso** tra add-plant ed edit-plant, ricerca con debounce 250ms su `/species`
- **Trefle** (deciso dopo verifica live API): import completo indice in DB locale (437k specie, ~3-4h, rate limit 120 req/min), sync SETTIMANALE (non giornaliero: dataset stabile, scan costoso), ricerca pg_trgm. Trefle NON ha dati di cura → i reminder restano basati sulle nostre specie curate
- **Catalogo grezzo generico** (2026-07-13): tabella `trefle_species_raw` rinominata in **`species_import_raw`** (model `SpeciesImportRaw`) con campi generici `externalId` (era trefleId), `updatedAtSource` e nuova colonna `fonte` (`'csv'|'trefle'`, default csv); anche `Species.trefleId` → `Species.externalId`. Motivo: in dev/test il catalogo esteso si popola via **import CSV manuale** con poche specie, Trefle resta il meccanismo di produzione (Fase 9). Migration `rinomina_catalogo_import_generico`. Script import CSV da scrivere (dentro /backend, vedi lezione ts-node)
- **docs/ e CLAUDE.md versionati** in git (tolti da .gitignore, repo privato)
- **Build iOS**: EAS come via principale; build locale accantonata per bug path con spazi (vedi sopra)
- **Push notifications (Fase 8, 2026-07-13)**: stile "digest + singola smart" (1 task → notifica specifica con deep link pianta, N → digest); notifiche attive = `pushToken != null` (nessuna colonna `enable_notifications`); orario invio per-utente da `orarioReminder` (cron unico `0 9,15,19 * * *`, worker filtra per fascia); niente polling receipts Expo (solo errori ticket, `DeviceNotRegistered` → token azzerato); alert sensori esclusi (Fase 7)
- **expo-server-sdk pinnato a v3**: v4+ è ESM-only e il backend è CommonJS (`TS1479` in build) — non aggiornare a v4 senza migrare il modulo system
- **Logging strutturato con Pino, log applicativo separato da audit (2026-07-31)**: `src/lib/logger.ts` (request logging via `pino-http`, console pretty in dev/JSON in prod, file `combined`/`error` con rotazione giornaliera) e `src/lib/audit.ts` (eventi auth + azioni sensibili tipizzati in `AuditEvent`, file `audit` retention 90gg) — separati perché l'audit deve sopravvivere più a lungo e non va mischiato al rumore applicativo. `ip` passato esplicitamente `route → service` (niente middleware automatico). File in `LOG_DIR` (default `./logs`), bind mount `./logs/staging:/app/logs` in `docker-compose.staging.yml` per accesso diretto da host Ubuntu senza entrare nel container
- **Onboarding invertito (2026-07-13)**: prima auth, poi clima come step post-login (`/onboarding/climate`) gated da `onboardingDone`; gate soft (profilo null offline → entra nei tabs); `pendingClima` eliminato; utenti esistenti con `onboardingDone:false` vedono il clima una volta al login successivo
- **Pairing vaso: credenziali MQTT condivise, non per-device** (2026-07-24): tutti i vasi usano le stesse `MQTT_USERNAME`/`MQTT_PASSWORD` del backend (HiveMQ Cloud free non ha API di gestione credenziali) — MA vengono comunque *trasmesse dinamicamente* al vaso via BLE ad ogni pairing invece di essere hardcoded nel firmware, così sono cambiabili in futuro senza reflash. `device_id` generato dal backend (UUID) al momento del pairing, non dal firmware
- **BLE custom invece di ESP-IDF WiFi Provisioning ufficiale** (2026-07-24): il protocollo Espressif standard (protobuf, handshake sicurezza) era troppo lungo da implementare in una sera — scelto un servizio BLE semplice (libreria Arduino `BLEDevice` nativa, già nel core ESP32, zero dipendenze extra) con una sola characteristic WRITE che riceve JSON via `ArduinoJson`. Meno sicuro (nessuna cifratura sul payload BLE) ma sufficiente per MVP locale; da rivalutare se si va in produzione con utenti reali
- **Verifica pairing = stato reale, non "invio riuscito"** (2026-07-24): la schermata mobile non dichiara successo appena la scrittura BLE va a buon fine — fa polling `GET /vases/:id` fino a 45s aspettando `stato:'connesso'` (che il backend setta solo alla ricezione del primo messaggio MQTT `status:online` dal vaso). Motivo: BLE riuscito non garantisce che le credenziali WiFi/MQTT fossero corrette — l'utente deve sapere se il vaso è VERAMENTE online, non solo che gli è arrivato un messaggio
- **Flusso pairing scan-first, non wifi-first** (2026-07-24, richiesta esplicita utente): prima si scansiona e si seleziona il device BLE, SOLO DOPO si chiedono le credenziali WiFi — non il contrario. Motivo: l'utente deve sapere a quale vaso fisico sta collegando prima di inserire dati sensibili

## Errori corretti / lezioni apprese
- **`docker exec` senza `-i`**: heredoc psql ignora stdin silenziosamente (exit 0, insert non eseguiti) — usare sempre `docker exec -i` e verificare con SELECT
- **Conflitto route Expo Router**: `app/index.tsx` + `app/(tabs)/index.tsx` insieme rompono la risoluzione di `/` — tenere solo quello nel gruppo tabs
- **Path con spazi rompe build iOS**: `bash -c "$VAR"` word-splitta il path espanso; fix con quoting interno, persistito via patch-package (vedi Note build)
- **Prisma mock nei test**: nuove code BullMQ vanno aggiunte anche in `src/lib/__mocks__/bullmq.ts` o i test route falliscono
- **ts-node fuori dal progetto**: script in /tmp non compilano (moduleResolution node16) — script one-off vanno dentro /backend, lanciati con `ts-node-dev --transpile-only`
- **Trefle base URL**: l'env contiene già `/api/v1` — non riaggiungerlo nel client (404 su `/api/v1/api/v1`)
- **Trefle campo `growth`**: quasi sempre null anche su specie comuni (verificato su Monstera deliciosa) — mai contarci per dati di cura
- **react-native-screens deve restare allineato a Expo SDK54 (`~4.16.0`)**: una versione più recente (`^4.26.2`, finita in `package.json` non si sa come/quando) rompe il Codegen in build EAS con New Architecture (`Error: The first argument of method setToolbarMenuElementOptions must be of type React.ElementRef<>`) — fix con `npx expo install --fix`, mai bumpare a mano pacchetti nativi oltre il range SDK
- **DB dev locale può svuotarsi silenziosamente**: container Postgres ricreato (es. dopo `docker compose down -v` o reset) riparte senza migration applicate — `prisma migrate status` mostra "not yet applied" ma non è un errore visibile finché non arriva una query reale. Dopo ogni riavvio infra dubbio: `npx prisma migrate deploy` + verificare hypertable TimescaleDB (`SELECT create_hypertable(...)`/`add_retention_policy(...)` vanno rifatti a mano, non sono nella migration SQL)
- **`btoa` non basta per payload BLE con caratteri accentati**: SSID/password WiFi italiani possono contenere UTF-8 fuori range Latin1 — `btoa` tronca/corrompe silenziosamente, serve encoder base64 UTF-8-safe scritto a mano (vedi `utf8ToBase64` in `app/vase/pair.tsx`)
- **iOS Simulator non ha stack Bluetooth**: `react-native-ble-plx` non funziona su simulatore (nessun hardware BLE) — testare pairing solo su device fisico
- **Google Sign-In Android: un client OAuth per Mac/keystore, non riusare quello Web**: il Client ID **Android** su Google Cloud Console va creato da "CREATE CREDENTIALS → OAuth client ID → Android" (tipo dedicato) — modificare il client **Web** esistente aggiungendo un SHA-1 non crea un client Android valido, l'app riceve comunque `DEVELOPER_ERROR` code 10. Ogni Mac/keystore diverso serve il proprio client Android con il proprio SHA-1 (vedi anche nota sopra su questo). Non serve mettere l'ID del client Android in `.env` — Google lo trova da solo via package+SHA-1
- **Docker Desktop containerd corrotto (errore I/O)**: sintomo — container "healthy" ma porte non esposte (es. Postgres senza `0.0.0.0:5432->5432`), poi `docker compose down`/`up` falla con `input/output error` su `meta.db` o blob content. Non è un problema del progetto: serve Quit completo di Docker Desktop (icona menu bar) + riapertura. Dopo il restart, ricreare i container (`docker compose -f docker-compose.dev.yml up -d`) e **riavviare anche il backend** (`npm run dev`), altrimenti il pool di connessioni Prisma/Redis resta agganciato ai container vecchi
- **tsconfig.json backend + `@types/jest`**: aggiungere `"jest"` ai `types` in `tsconfig.json` (non solo in `tsconfig.test.json`) risolve i falsi positivi TypeScript nell'editor sui file `.test.ts` (VSCode non applica `tsconfig.test.json` ai file aperti singolarmente) — verificato che non rompe `npm run build` (i `.test.ts` restano esclusi da `include`/`exclude`) né `npm test`
- **`normalizeEmail()` di express-validator rimuove i punti dagli indirizzi Gmail per default**: `mario.rossi@gmail.com` diventava `mariorossi@gmail.com` in DB — comportamento tecnicamente valido (Gmail li ignora) ma confonde utente/supporto/log. Fix: `normalizeEmail({ gmail_remove_dots: false })` su tutte le route con email (`auth.routes.ts`)
- **SDK Resend non lancia eccezioni sugli errori API**: `resend.emails.send()` ritorna `{ data, error }` anche su 403/422/ecc — senza controllare esplicitamente `error` e lanciare, un invio rifiutato risulta job BullMQ "completed" e audit "ok", zero traccia dell'errore reale. Fix in `src/lib/email.ts`: throw se `error` presente. Verificare sempre la shape di ritorno reale degli SDK di terze parti prima di assumere che rifiutino con eccezione

## Stack tecnico

### Backend (`/backend`)
- Node.js 20 + Express 5 + TypeScript (strict) — nota: con i tipi Express 5 `req.params.x` è `string | string[]`, serve cast
- Prisma 7 ORM (PostgreSQL)
- Redis (ioredis)
- mqtt.js per subscriber HiveMQ Cloud
- express-validator, express-rate-limit, helmet, bcrypt, jsonwebtoken
- Pino per logging strutturato (`src/lib/logger.ts` applicativo + `src/lib/audit.ts` audit sicurezza, dettagli in specifiche-tecniche §14.5)

### Mobile (`/mobile`)
- Expo SDK 54 + React Native + TypeScript
- mqtt.js (connessione via WebSocket wss://)
- Zustand (state management — store auth in `src/store/auth.store.ts`)
- Expo Router (navigazione file-based: gruppo `(auth)` onboarding, gruppo `(tabs)` app principale)
- Axios (`src/services/api.ts`) con interceptor refresh token; token in expo-secure-store
- react-native-svg per le icone; tema light/dark in `src/theme/` agganciato a `useColorScheme()`

### Database
- PostgreSQL 16 + TimescaleDB (container: `fiora-postgres-dev`)
- Redis 7 (container: `fiora-redis-dev`)
- MinIO (container: `fiora-minio-dev`, bucket: `fiora-photos`)

## Configurazione MQTT
- **Broker:** HiveMQ Cloud (piano gratuito, cluster condiviso dev+staging)
- **Host:** `6c6f661a355149fbb2e308bc4a2ed846.s1.eu.hivemq.cloud`
- **Porta backend (TCP/TLS):** 8883 — protocollo `mqtts://`
- **Porta mobile (WebSocket/TLS):** 8884 — protocollo `wss://`, path `/mqtt`
- **Autenticazione:** username/password (vedere `.env.development`)
- **Topic telemetria vasi:** `fiora/vaso/{device_id}/telemetry`
- **Topic status vasi:** `fiora/vaso/{device_id}/status`
- **Topic config vasi:** `fiora/vaso/{device_id}/config`
- **Decisione 2026-07-24**: HiveMQ Cloud è il broker ufficiale di dev **e** staging (stesso cluster); Mosquitto self-hosted solo in produzione (ACL per-vaso, CA propria embeddata nel firmware ESP32). Implicazione Fase 6: il piano gratuito HiveMQ non ha API di gestione credenziali → in dev/test le credenziali device si pre-creano a mano nella console, il pairing automatico (`mosquitto_passwd`) esiste solo in prod. Docs allineati: specifiche-tecniche §3 (tabella broker per ambiente) e §6 (nota pairing), manuale-ambienti §1.4/§2.6-2.7 marcate "solo produzione"

## Struttura cartelle backend
```
backend/
├── src/
│   ├── index.ts              ← entry point, avvia Express + MQTT subscriber
│   ├── app.ts                ← Express setup, middleware globali, routes
│   ├── lib/
│   │   ├── prisma.ts         ← Prisma client singleton
│   │   ├── redis.ts          ← Redis client singleton
│   │   └── mqtt.ts           ← MQTT subscriber HiveMQ Cloud
│   ├── middleware/
│   │   └── auth.middleware.ts ← JWT requireAuth middleware
│   ├── services/             ← auth, plants, tasks, species, reminder, vase
│   ├── jobs/                 ← worker BullMQ (reminder.job.ts, account deletion)
│   └── routes/               ← /auth, /plants, /tasks, /species, /vases
├── prisma/
│   └── schema.prisma         ← schema completo (users, plants, species, tasks, ecc.)
└── generated/
    └── prisma/               ← client generato da `npx prisma generate`
```

## Comandi principali
```bash
# Backend (da /backend)
npm run dev                                    # avvia con hot reload
npx prisma generate                            # rigenera client Prisma
npx prisma migrate dev --name <nome>           # crea nuova migration
npx prisma studio                              # GUI database

# Mobile (da /mobile)
npx expo start -c                              # avvia con cache pulita
npx expo install <pacchetto>                   # installa dipendenza compatibile SDK
npx expo run:android --device                  # build locale Android su device USB (richiede ANDROID_HOME in .zshrc)
eas build:run -p ios --latest                  # installa ultima build EAS su simulatore iOS

# Docker (dalla root /fiora)
docker compose -f docker-compose.dev.yml up -d    # avvia infrastruttura
docker compose -f docker-compose.dev.yml down -v  # reset completo con dati
docker compose -f docker-compose.dev.yml ps        # stato container
```

## Ambiente staging (server Ubuntu locale)
- Server Ubuntu: IP LAN `192.168.1.50`, IP Tailscale `100.102.50.17`
- File: `docker-compose.staging.yml` (root) + `backend/Dockerfile` + `backend/.env.staging` (da `.env.staging.example`, mai committato)
- Deploy da `develop` (staging riflette sempre l'ultimo `develop`):
```bash
# Sul server Ubuntu, dentro il repo (branch develop)
git pull origin develop
docker compose -f docker-compose.staging.yml up -d --build
docker compose -f docker-compose.staging.yml exec backend npx prisma migrate deploy
```
- Backend raggiungibile su `http://192.168.1.50:3000` (LAN) o `http://100.102.50.17:3000` (Tailscale, da qualsiasi rete)
- Mobile: profilo EAS `staging` in `mobile/eas.json` usa **l'IP Tailscale** (`EXPO_PUBLIC_API_URL=http://100.102.50.17:3000`) — funziona sia in LAN casa sia fuori (Tailscale instrada diretto se stesso subnet, altrimenti via relay). Richiede app Tailscale installata e autenticata sull'iPhone di test.
```bash
# Da /mobile
eas build --profile staging --platform ios
```
- Install su iPhone: cavo USB + Xcode → Window → Devices and Simulators → trascina l'`.ipa` scaricato (no TestFlight, manca account Apple Developer)

## Convenzioni codice
- TypeScript strict, nessun `any` esplicito
- Tutti gli endpoint rispondono `{ success: true, data: ... }` oppure `{ success: false, error: { code, message } }`
- I codici errore sono stringhe uppercase: `AUTH_TOKEN_EXPIRED`, `VALIDATION_ERROR`, ecc.
- Il backend è l'unico responsabile della logica di business — l'app mobile è solo presentazione
- Commit in stile Conventional Commits: `feat(auth): aggiunge refresh token`

## File sensibili (mai committare)
- `backend/.env` e `backend/.env.development`
- `mobile/.env.development`
- Tutti coperti da `.gitignore`

## Roadmap fasi
(dettaglio in `docs/fiora-roadmap.md`)
- **Fase 0** ✅ Setup infrastruttura
- **Fase 1** ✅ Backend Core + Autenticazione
- **Fase 2** ✅ CRUD piante + task (+ catalogo specie read-only)
- **Fase 3** ✅ Reminder engine (BullMQ)
- **Fase 4** ✅ App mobile UI (schermate principali)
- **Fase 4.5** ✅ backend + mobile (2026-07-13)
- **Fase 5** Foto diario (MinIO) — rimandata (decisione 2026-07-13)
- **Fase 6** Integrazione vaso smart (MQTT → DB, schermate Vasi, pairing BLE) — **in corso** (2026-07-24): backend pairing+telemetria ✅, firmware BLE provisioning ✅ (mai testato su hardware), mobile schermata pairing ✅ (mai testata su device reale). Manca: test end-to-end reale, schermata dettaglio vaso/dati sensori in tempo reale (solo pairing fatto finora)
- **Fase 7** Alert sensori (+ push per alert, esclusi da Fase 8) — rimandata
- **Fase 8** ✅ Notifiche push Expo (2026-07-13, solo reminder calendario)
- **Fase 9** Catalogo esteso: in dev/test import CSV manuale in `species_import_raw` (`fonte='csv'`, set ridotto — script da scrivere); in prod import massivo Trefle (`fonte='trefle'`, 437k specie, ~3-4h una tantum), arricchimento dettagli on-demand, sync settimanale, ricerca pg_trgm, proposta specie + area admin. NB: Trefle NON ha dati di cura (verificato: growth null anche per Monstera) — serve solo per ricerca/nomi/immagini
- **Fase 10** rifinitura UI (fiori bouquet, empty state suggerimenti) — inversione onboarding + pagina intro ✅ fatte il 2026-07-13; Apple Sign-In ✅ fatto 2026-08-04 (vedi sopra)
- **Post-MVP** Email transazionali, offline SQLite, cambio email

## Note importanti
- Prisma 7: il campo `url` NON va in `schema.prisma` ma in `prisma.config.ts` (già configurato)
- `moduleResolution` in tsconfig deve essere `node16` (non `node`)
- Expo SDK 54 (non 56 — downgrade per compatibilità con Expo Go)
- Il mobile si connette a MQTT via WebSocket (wss://), NON via TCP diretto
- `sensor_readings` è una TimescaleDB hypertable — non modificare la PK senza ricreare l'hypertable