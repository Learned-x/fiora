export interface SpeciesSummary {
  id: string;
  nomeComune: string;
  nomeScientifico: string | null;
  categoria: string | null;
  luce: 'bassa' | 'media' | 'alta';
  annaffiatura: 'poca' | 'media' | 'frequente';
  umidita: string | null;
  tossicita: boolean | null;
  immaginePrincipaleUrl: string | null;
}

export interface Species extends SpeciesSummary {
  tempMin: number | null;
  tempMax: number | null;
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
  _count?: { tasks: number };
}

export type TaskTipo =
  | 'annaffiatura'
  | 'concimazione'
  | 'nebulizzazione'
  | 'potatura'
  | 'rinvaso'
  | 'controllo';

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
  plant: { id: string; nome: string; fotoUrl: string | null };
}
