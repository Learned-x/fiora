# Specifiche funzionali per il catalogo piante di Fiora

> ## ⚠️ Documento archiviato — visione futura, non pianificata
>
> **Archiviato il 2026-07-27.** Questo documento descrive un catalogo botanico che
> fonde tre sorgenti (Trefle, USDA PLANTS, ECOCROP) in un profilo di coltivazione
> unificato, con entità dedicate e regole di fusione dei dati.
>
> **Non è ciò che il progetto sta costruendo.** La Fase 9 prevede qualcosa di molto
> più ridotto: import CSV manuale in dev e test, import dell'indice Trefle in
> produzione, senza USDA né ECOCROP e senza logica di fusione. La ragione principale
> è che i dati di cura di Trefle sono quasi sempre nulli, quindi i reminder continuano
> a basarsi sul catalogo curato interno anziché su quello importato.
>
> Resta qui come riferimento nel caso il catalogo venga ripreso e ampliato post-MVP.
> Per lo stato reale: `../fiora-specifiche-funzionali.md` §12 e `../fiora-roadmap.md` Fase 9.

## 1. Obiettivo

Costruire un catalogo piante unificato che:

- Usa **Trefle** come fonte principale di identità botanica e tassonomia.
- Integra **USDA PLANTS** per caratteristiche morfologiche/fisiologiche e requisiti di crescita.
- Integra **ECOCROP (FAO)** per requisiti ecologici di coltivazione (temperatura, precipitazioni, pH, luce, suolo, altitudine, ecc.).
- Deriva da queste fonti un **profilo di coltivazione standardizzato** per ogni pianta, utilizzato dal software e dall'hardware di Fiora.

Non sono previste guide editoriali lunghe: l’obiettivo è avere parametri oggettivi e classificazioni coerenti per gestire luce, acqua, suolo, temperatura, pH, difficoltà di cura e idoneità indoor/outdoor.

---

## 2. Ambito dati e fonti

### 2.1 Trefle (API botanica)

**Ruolo:** identità botanica e struttura tassonomica.

**Dati rilevanti:**

- Nomi: `common_name`, `scientific_name`, `family`, `genus`.
- Campi `growth`:
  - `light`
  - `soil_humidity`
  - `minimum_temperature`, `maximum_temperature`
  - `ph_minimum`, `ph_maximum`
  - `minimum_root_depth`
  - `minimum_precipitation`, `maximum_precipitation`
  - `bloom_months`, `fruit_months`
- Campi `specifications`:
  - `growth_form`, `growth_habit`, `growth_rate`
  - `average_height`, `maximum_height`
  - `toxicity`

### 2.2 USDA PLANTS

**Ruolo:** caratteristiche e requisiti agronomici (prevalentemente per specie native/naturalizzate nel PLANTS Floristic Area).

**Dati rilevanti (a livello concettuale):**

- Morfologia / fisiologia:
  - `Height at Maturity`
  - `Growth Rate`
  - `Growth Form`
  - `Active Growth Period`
- Growth requirements:
  - `Soil Texture`
  - `Drought Tolerance`
  - `Fertility Requirements`
  - `Soil pH Minimum`, `Soil pH Maximum`
  - `Root Depth`
- Suitability / use:
  - `Christmas Tree Use`
  - `Fruit/Seed/Nut Production`
  - `Lumber/Timber Production`
  - `Human Consumption`
  - `Palatability` (grazing/browsing)

### 2.3 ECOCROP (FAO)

**Ruolo:** requisiti ecologici di coltivazione e usi principali.

**Tipi di descrittori:**

- Plant descriptors:
  - categoria (crop type)
  - `Life Form`
  - `Growth Habit`
  - `Life Span`
- Environmental descriptors:
  - temperatura: `TempMin`, `TempOptMin`, `TempOptMax`, `TempMax`
  - precipitazioni annue: `PrecipMin`, `PrecipOptMin`, `PrecipOptMax`, `PrecipMax`
  - pH suolo: `SoilPhMin`, `SoilPhOptMin`, `SoilPhOptMax`, `SoilPhMax`
  - intensità di luce: `LightIntensity`
  - altitudine: `AltitudeMin`, `AltitudeMax`
  - zona climatica Köppen
  - ulteriori parametri su suolo: `SoilTexture`, `SoilDepth`, `SoilFertility`, `SoilSalinity`, `Drainage`
- Use descriptors:
  - `MainUse` (food, fodder, energy, erosion control, industrial, ecc.)
  - `UsedPart` (fruit, leaves, stems, roots, seeds, ecc.)

---

## 3. Requisiti funzionali

### 3.1 Identità unica per ogni pianta

Per ogni specie/pianta gestita da Fiora deve esistere un record di **identità botanica unificata** che:

- Aggrega i dati di Trefle, USDA PLANTS ed ECOCROP.
- Usa il **nome scientifico canonicalizzato** come chiave principale.
- Gestisce sinonimi e varianti (es. ibridi, forme diverse di scrittura del nome).

Questa identità è il fulcro logico su cui si agganciano tutte le altre informazioni.

### 3.2 Profilo di coltivazione standardizzato

Per ogni pianta Fiora deve avere un **Cultivation Profile** con:

- Range numerici finali:
  - `TempMinFinal`, `TempMaxFinal` (temperatura minima/massima di crescita)
  - `PhMinFinal`, `PhMaxFinal` (pH suolo ammissibile)
  - opzionale: `PrecipMinFinal`, `PrecipMaxFinal` (precipitazioni / apporto idrico)
  - opzionale: `AltitudeMinFinal`, `AltitudeMaxFinal`
- Classificazioni derivate (categorie user-friendly):
  - `LightLevel`: `ombra` | `mezz’ombra` | `pieno_sole`
  - `WaterLevel`: `poca` | `media` | `molta`
  - `SoilType`: es. `leggero_drenante`, `medio`, `pesante_umido`, `salino`, ecc.
  - `FertilityNeed`: `bassa` | `media` | `alta`
  - `CareDifficulty`: 1 | 2 | 3
- Indicatori di utilizzo per Fiora:
  - `IndoorSuitable`: boolean (idonea alla coltivazione indoor in appartamento/clima temperato)
  - altre flag di idoneità outdoor per scenari/climi definiti

### 3.3 Tracciabilità della fonte

Per ogni campo del profilo di coltivazione deve essere possibile sapere da **quale fonte** è stato derivato:

- Per ogni parametro principale (temperatura, pH, luce, acqua, suolo, fertilità) indicare:
  - `SourceTemp` = `TREFLE` | `USDA` | `ECOCROP` | `MIXED`
  - analogamente per `SourcePh`, `SourceLight`, `SourceWater`, `SourceSoil`, `SourceFertility`
- La logica di fusione deve essere deterministica e documentata (vedi §4).

### 3.4 Override manuali

Per le piante chiave di Fiora deve essere possibile:

- Modificare manualmente singoli campi del profilo di coltivazione (es. `LightLevel`, `WaterLevel`, `CareDifficulty`, ecc.).
- Registrare:
  - autore dell’override
  - data
  - motivazione (`OverrideReason`)
- Segnalare via flag che il campo è stato overrideato (`HasManualOverrideX = true`) in modo da non sovrascriverlo automaticamente.

### 3.5 Aggiornabilità controllata

Il sistema deve supportare:

- Import iniziale massivo da Trefle, USDA PLANTS, ECOCROP.
- Aggiornamenti periodici (es. job notturni) dei dati sorgente.
- Mantenimento degli override manuali e delle fonti (`Source*`) durante gli aggiornamenti.

---

## 4. Modello concettuale (entità)

### 4.1 PlantIdentity

**Scopo:** rappresentare la pianta in modo unico.

Campi concettuali principali:

- `PlantIdentityId`
- `ScientificNameCanonical`
- `ScientificAuthor`
- `Family`, `Genus`
- `CommonNames[]` (con lingua)
- chiavi verso fonti:
  - `TrefleId`, `TrefleSlug`
  - `UsdaSymbol`
  - `EcocropCode`

Relazioni:

- 1:N con `TrefleData`, `UsdaTraits`, `EcocropRequirements` (nella pratica saranno 1:1 verso la stessa pianta, ma concettualmente possono esserci più record storici).
- 1:1 con `CultivationProfile`.

### 4.2 TrefleData

**Scopo:** rappresentare i dati raw di Trefle legati alla specie.

Campi concettuali:

- `PlantIdentityId`
- `Growth`:
  - `LightRaw`
  - `SoilHumidityRaw`
  - `MinimumTemperatureRaw`
  - `MaximumTemperatureRaw`
  - `PhMinimumRaw`
  - `PhMaximumRaw`
  - `MinimumRootDepthRaw`
  - `MinimumPrecipitationRaw`, `MaximumPrecipitationRaw`
  - `BloomMonthsRaw`, `FruitMonthsRaw`
- `Specifications`:
  - `GrowthFormRaw`, `GrowthHabitRaw`, `GrowthRateRaw`
  - `AverageHeightRaw`, `MaximumHeightRaw`
  - `ToxicityRaw`
- Metadati:
  - `TrefleJsonRaw`
  - `LastSyncAt`

### 4.3 UsdaTraits

**Scopo:** rappresentare i trait e requisiti da USDA PLANTS.

Campi concettuali:

- `PlantIdentityId`
- Morfologia / fisiologia:
  - `HeightMaturity`
  - `GrowthRate`
  - `GrowthForm`
  - `ActiveGrowthPeriod`
- Growth requirements:
  - `SoilTexture`
  - `DroughtTolerance`
  - `FertilityRequirements`
  - `SoilPhMin`
  - `SoilPhMax`
  - `RootDepth`
- Suitability / use:
  - `ChristmasTreeUse`
  - `FruitSeedNutProduction`
  - `LumberUse`
  - `HumanConsumption`
  - `Palatability`
- Metadati:
  - `UsdaRawRecord`
  - `LastSyncAt`

### 4.4 EcocropRequirements

**Scopo:** descrivere i requisiti ecologici di coltivazione.

Campi concettuali:

- `PlantIdentityId`
- Plant descriptors:
  - `Category`
  - `LifeForm`
  - `GrowthHabit`
  - `LifeSpan`
- Environmental descriptors:
  - `TempMin`, `TempOptMin`, `TempOptMax`, `TempMax`
  - `PrecipMin`, `PrecipOptMin`, `PrecipOptMax`, `PrecipMax`
  - `SoilPhMin`, `SoilPhOptMin`, `SoilPhOptMax`, `SoilPhMax`
  - `LightIntensity`
  - `AltitudeMin`, `AltitudeMax`
  - `KoppenZone`
  - `SoilTexture`, `SoilDepth`, `SoilFertility`, `SoilSalinity`, `Drainage`
- Use descriptors:
  - `MainUse`
  - `UsedPart`
- Metadati:
  - `EcocropRawRecord`
  - `LastSyncAt`

### 4.5 CultivationProfile

**Scopo:** rappresentare il profilo di coltivazione “finale” usato da Fiora.

Campi concettuali:

- `PlantIdentityId`

**Range numerici finali**:

- `TempMinFinal`
- `TempMaxFinal`
- `PhMinFinal`
- `PhMaxFinal`
- opzionali: `PrecipMinFinal`, `PrecipMaxFinal`, `AltitudeMinFinal`, `AltitudeMaxFinal`

**Classificazioni derivate**:

- `LightLevel` (ombra/mezz’ombra/pieno_sole)
- `WaterLevel` (poca/media/molta)
- `SoilType`
- `FertilityNeed` (bassa/media/alta)
- `CareDifficulty` (1/2/3)

**Indicatori di utilizzo Fiora**:

- `IndoorSuitable`
- eventuali altri flag per scenari/climi

**Tracciabilità**:

- `SourceTemp`
- `SourcePh`
- `SourceLight`
- `SourceWater`
- `SourceSoil`
- `SourceFertility`

**Override**:

- `HasManualOverrideTemp`, `HasManualOverridePh`, `HasManualOverrideLight`, `HasManualOverrideWater`, `HasManualOverrideSoil`, `HasManualOverrideFertility`, `HasManualOverrideDifficulty`, `HasManualOverrideIndoorSuitable`

### 4.6 CultivationManualOverride

**Scopo:** rappresentare modifiche manuali su singoli campi.

Campi concettuali:

- `PlantIdentityId`
- Campi override (solo quelli che possono essere corretti a mano):
  - `LightLevelOverride`
  - `WaterLevelOverride`
  - `SoilTypeOverride`
  - `FertilityNeedOverride`
  - `CareDifficultyOverride`
  - `IndoorSuitableOverride`
- Metadati:
  - `OverrideReason`
  - `OverrideAuthor`
  - `OverrideDate`

---

## 5. Logica di fusione (business rules)

### 5.1 Identità unificata

- Per ogni specie ricevuta da Trefle:
  - si crea o aggiorna un record in `PlantIdentity` usando `scientific_name` come base.
- Per USDA ed ECOCROP:
  - si agganciano i record tramite match su `ScientificNameCanonical`.
  - si gestiscono sinonimi e varianti con un meccanismo di normalizzazione.

### 5.2 Range finali di temperatura

- Se ECOCROP fornisce i 4 valori di temperatura, vengono considerati come base.
- Se manca ECOCROP, si usano i range da Trefle (`MinimumTemperatureRaw`, `MaximumTemperatureRaw`).
- Eventuali valori da USDA possono essere usati per raffinare.
- Regola concettuale:
  - `TempMinFinal` = minimo tra tutti i valori disponibili attendibili.
  - `TempMaxFinal` = massimo tra tutti i valori disponibili attendibili.
- `SourceTemp` indica quale fonte è stata determinante (ECOCROP, Trefle, USDA, MIXED).

### 5.3 Range finali di pH

- ECOCROP: `SoilPhMin`, `SoilPhMax` come fonte principale.
- USDA: `SoilPhMin`, `SoilPhMax` nei growth requirements come seconda fonte.
- Trefle: `PhMinimumRaw`, `PhMaximumRaw` come fallback.
- Fusione simile alla temperatura, con priorità ECOCROP > USDA > Trefle.

### 5.4 Classificazione luce (`LightLevel`)

- ECOCROP `LightIntensity` viene mappato su:
  - valori bassi → `ombra`
  - medi → `mezz’ombra`
  - alti → `pieno_sole`
- Se ECOCROP manca, si usa Trefle `Growth.LightRaw` con mapping analogo.

### 5.5 Classificazione acqua (`WaterLevel`)

- Si considerano:
  - range di precipitazioni da ECOCROP
  - `SoilHumidityRaw` da Trefle
  - `DroughtTolerance` da USDA
- Regole concettuali:
  - `poca`: alta drought tolerance + precipitazioni minime + soil_humidity basso.
  - `media`: valori intermedi.
  - `molta`: precipitazioni alte + soil_humidity alto + bassa drought tolerance.

### 5.6 Classificazione suolo (`SoilType`)

- Dati ECOCROP: `SoilTexture`, `SoilSalinity`, `Drainage`, `SoilFertility`.
- Dati USDA: `SoilTexture`, `FertilityRequirements`, `RootDepth`.
- Si definisce un set di categorie di suolo coerenti con i valori di texture/ drenaggio/ salinità (es. `leggero_drenante`, `medio`, `pesante_umido`, `salino`, ecc.).

### 5.7 FertilityNeed

- ECOCROP `SoilFertility` + USDA `FertilityRequirements`.
- Categorie:
  - `bassa`: la specie tollera suoli poveri.
  - `media`: livello intermedio.
  - `alta`: ha richieste elevate di fertilità/concimazione.

### 5.8 CareDifficulty

- Parametri che aumentano la difficoltà:
  - range stretti di temperatura e pH; 
  - `FertilityNeed = alta`;
  - `WaterLevel = molta`;
  - luce molto specifica.
- Parametri che la riducono:
  - ampie tolleranze (range larghi);
  - buona drought tolerance;
  - suolo flessibile.
- Output su scala 1–3, con regole definite e documentate.

### 5.9 IndoorSuitable

- Considera:
  - `TempMinFinal` compatibile con ambienti interni (nessun gelo, nessuna dormienza obbligatoria).
  - altezza e habitus (da USDA/Trefle) compatibili con spazi indoor.
  - `LightLevel` adatto a luce diffusa/mezz’ombra.
- Se questi criteri sono soddisfatti, `IndoorSuitable = true`.

### 5.10 Campi mancanti

- Se una fonte non fornisce dati per un parametro:
  - i campi finali possono restare null o avere categoria "non determinato".
  - non si inventano valori: tutto deriva da dati reali misurati/curati e da regole di fusione.

---

## 6. Governance e qualità dati

- **Tracciabilità:** ogni campo ha la sua fonte indicata e si conserva il raw record (JSON/CSV) per debug.
- **Audit:** si registra una cronologia di aggiornamenti e override manuali.
- **Controlli di plausibilità:**
  - verificare che `TempMinFinal <= TempMaxFinal`, `PhMinFinal <= PhMaxFinal`.
  - limitare i range a valori realistici (pH ~3–10, temperature compatibili con crescita vegetale).
- **Specie non coperte:**
  - se USDA/ECOCROP non forniscono dati per una pianta, il profilo può basarsi solo su Trefle e/o essere marcato come "profilo incompleto".

Questo documento definisce cosa il sistema deve fare sul piano funzionale e dei dati; la traduzione in schema tecnico, ETL e servizi applicativi sarà progettata separatamente.