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
