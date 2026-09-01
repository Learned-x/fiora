import { api } from './api';
import type { ActionLogEntry, Plant, PlantStato, Species, StatoBouquet, Task, TaskTipo } from '../types/models';

// ── Piante ────────────────────────────────────────────────────────────────────

export async function listPlants(stato: PlantStato = 'attivo'): Promise<Plant[]> {
  const res = await api.get<{ data: Plant[] }>('/plants', { params: { stato } });
  return res.data.data;
}

export async function getPlant(id: string): Promise<Plant & { tasks: Task[] }> {
  const res = await api.get<{ data: Plant & { tasks: Task[] } }>(`/plants/${id}`);
  return res.data.data;
}

export interface CreatePlantInput {
  nome: string;
  tipo: 'pianta' | 'bouquet';
  speciesId?: string;
  posizione?: string;
  note?: string;
  statoBouquet?: StatoBouquet;
  dataRicezione?: string;
  giaInAcqua?: boolean;
  luceCura?: 'bassa' | 'media' | 'alta';
  annaffiaturaCura?: 'poca' | 'media' | 'frequente';
  umiditaCura?: 'bassa' | 'media' | 'alta';
}

export async function createPlant(input: CreatePlantInput): Promise<Plant> {
  const res = await api.post<{ data: Plant }>('/plants', input);
  return res.data.data;
}

export interface UpdatePlantInput {
  nome?: string;
  speciesId?: string | null;
  posizione?: string | null;
  note?: string | null;
  stato?: PlantStato;
  statoBouquet?: StatoBouquet;
  vasoId?: string | null;
  sogliaUmiditaMin?: number | null;
  sogliaUmiditaMax?: number | null;
  sogliaLuceMin?: number | null;
  sogliaLuceMax?: number | null;
  sogliaTempMin?: number | null;
  sogliaTempMax?: number | null;
  luceCura?: 'bassa' | 'media' | 'alta' | null;
  annaffiaturaCura?: 'poca' | 'media' | 'frequente' | null;
  umiditaCura?: 'bassa' | 'media' | 'alta' | null;
}

export async function updatePlant(id: string, input: UpdatePlantInput): Promise<Plant> {
  const res = await api.patch<{ data: Plant }>(`/plants/${id}`, input);
  return res.data.data;
}

export async function deletePlant(id: string): Promise<void> {
  await api.delete(`/plants/${id}`);
}

// ── Task ──────────────────────────────────────────────────────────────────────

export interface ListTasksFilters {
  stato?: string;
  from?: string;
  to?: string;
  // Filtro su completatoA (non su scadenza): "completati oggi" include anche un
  // task scaduto ieri ma spuntato oggi. Il server filtra, il client non scarica
  // più tutto lo storico per poi filtrarlo a mano.
  completatoFrom?: string;
  completatoTo?: string;
  limit?: number;
  offset?: number;
}

export async function listTasks(filters: ListTasksFilters = {}): Promise<Task[]> {
  const res = await api.get<{ data: Task[] }>('/tasks', { params: filters });
  return res.data.data;
}

export async function createTask(plantId: string, tipo: TaskTipo, scadenza: string, nota?: string): Promise<Task> {
  const res = await api.post<{ data: Task }>(`/plants/${plantId}/tasks`, { tipo, scadenza, nota });
  return res.data.data;
}

export async function completeTask(taskId: string, nota?: string): Promise<Task> {
  const res = await api.patch<{ data: Task }>(`/tasks/${taskId}`, { azione: 'completa', nota });
  return res.data.data;
}

export async function postponeTask(taskId: string, scadenza: string): Promise<Task> {
  const res = await api.patch<{ data: Task }>(`/tasks/${taskId}`, { azione: 'rimanda', scadenza });
  return res.data.data;
}

export async function skipTask(taskId: string): Promise<Task> {
  const res = await api.patch<{ data: Task }>(`/tasks/${taskId}`, { azione: 'salta' });
  return res.data.data;
}

// ── Storico cure ──────────────────────────────────────────────────────────────

export interface ListPlantActionsResult {
  items: ActionLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export async function listPlantActions(
  plantId: string,
  params: { tipo?: string; from?: string; to?: string; limit?: number; offset?: number } = {}
): Promise<ListPlantActionsResult> {
  const res = await api.get<{ data: ListPlantActionsResult }>(`/plants/${plantId}/actions`, { params });
  return res.data.data;
}

// ── Specie ────────────────────────────────────────────────────────────────────

export async function listSpecies(search?: string): Promise<Species[]> {
  const res = await api.get<{ data: { items: Species[] } }>('/species', {
    params: { limit: 50, ...(search ? { search } : {}) },
  });
  return res.data.data.items;
}

export interface ProposeSpeciesInput {
  nomeComune: string;
  categoria?: string; // libera — una delle categorie standard o un valore custom dell'utente
  luce: 'bassa' | 'media' | 'alta';
  annaffiatura: 'poca' | 'media' | 'frequente';
  umidita: 'bassa' | 'media' | 'alta';
  nomeScientifico?: string;
  tempMin?: number;
  tempMax?: number;
  tossicita?: boolean;
  noteCura?: string;
  forzaCrea?: boolean;
}

export type ProposeSpeciesResult =
  | { creata: true; species: Species }
  | { creata: false; suggerimento: Species };

export async function proposeSpecies(input: ProposeSpeciesInput): Promise<ProposeSpeciesResult> {
  const res = await api.post<{ data: ProposeSpeciesResult }>('/species', input);
  return res.data.data;
}
