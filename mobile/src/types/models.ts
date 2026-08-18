export interface SpeciesSummary {
  id: string;
  nomeComune: string;
  nomeScientifico: string | null;
  categoria: string | null;
  luce: 'bassa' | 'media' | 'alta';
  annaffiatura: 'poca' | 'media' | 'frequente';
  umidita: string | null;
  sogliaUmidita: number | null;
  tempMin: number | null;
  tempMax: number | null;
  tossicita: boolean | null;
  immaginePrincipaleUrl: string | null;
}

export interface Species extends SpeciesSummary {
  noteCura: string | null;
  fonte: string;
}

export type PlantStato = 'attivo' | 'archiviato';
export type StatoBouquet = 'fresco' | 'in_cura' | 'appassendo' | 'concluso';

export interface Plant {
  id: string;
  nome: string;
  tipo: 'pianta' | 'bouquet';
  speciesId: string | null;
  posizione: string | null;
  fotoUrl: string | null;
  stato: PlantStato;
  statoBouquet: StatoBouquet | null;
  dataRicezione: string | null;
  note: string | null;
  createdAt: string;
  species: SpeciesSummary | null;
  vasoId: string | null;
  sogliaUmiditaMin: number | null;
  sogliaUmiditaMax: number | null;
  sogliaLuceMin: number | null;
  sogliaLuceMax: number | null;
  // Decimal lato Prisma → JSON le serializza come stringa (stesso motivo di SensorReading.temperatura).
  sogliaTempMin: string | null;
  sogliaTempMax: string | null;
  _count?: { tasks: number };
}

export type TaskTipo =
  | 'annaffiatura'
  | 'concimazione'
  | 'nebulizzazione'
  | 'potatura'
  | 'rinvaso'
  | 'controllo'
  | 'cambio_acqua'
  | 'taglio_steli'
  | 'controllo_stato'
  | 'rotazione'
  | 'pulizia_foglie';

export type TaskStato = 'pending' | 'completato' | 'saltato';
export type TaskSorgente = 'calendario' | 'sensore' | 'manuale';

export interface Task {
  id: string;
  plantId: string;
  tipo: TaskTipo;
  sorgente: TaskSorgente;
  stato: TaskStato;
  scadenza: string;
  completatoA: string | null;
  nota: string | null;
  inRitardo?: boolean;
  plant: { id: string; nome: string; fotoUrl: string | null };
}

export type Clima = 'freddo' | 'temperato' | 'appartamento' | 'mediterraneo' | 'tropicale';

export interface GracePeriod {
  active: boolean;
  deletedAt: string;
  giorniRimanenti: number;
}

export interface UserProfile {
  id: string;
  email: string | null;
  name: string | null;
  clima: Clima;
  onboardingDone: boolean;
  mostraNomiScientifici: boolean;
  orarioReminder: string;
  pushToken: string | null;
  graceperiod?: GracePeriod;
}

export interface AppOption {
  id: string;
  categoria: string;
  chiave: string;
  etichetta: string;
  ordine: number;
  attivo: boolean;
}

export interface ActionLogEntry {
  id: string;
  plantId: string;
  tipo: string;
  nota: string | null;
  createdAt: string;
}
