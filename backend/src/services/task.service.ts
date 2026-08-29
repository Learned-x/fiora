import { prisma } from '../lib/prisma';
import { findOwnedPlant } from './plant.service';

export const TASK_TYPES = [
  'annaffiatura',
  'concimazione',
  'nebulizzazione',
  'potatura',
  'rinvaso',
  'controllo', // deprecato, mantenuto come alias — usare 'controllo_stato'
  'cambio_acqua',
  'taglio_steli',
  'controllo_stato',
  'rotazione',
  'pulizia_foglie',
] as const;

const GIORNI_IN_RITARDO = 3;

// Tetto di sicurezza su GET /tasks: senza, la rotta restituisce tutto lo storico
// dell'utente (misurato: 762 KB e 678 ms per un utente con 6 mesi di task). Il
// default è generoso perché i chiamanti reali filtrano già per data — serve a
// impedire il caso degenere, non a paginare l'uso normale.
const TASKS_LIMIT_DEFAULT = 200;
const TASKS_LIMIT_MAX = 500;

export function isTaskLate(task: { stato: string; scadenza: Date }, now: number = Date.now()): boolean {
  return (
    task.stato === 'pending' &&
    task.scadenza.getTime() < now - GIORNI_IN_RITARDO * 24 * 60 * 60 * 1000
  );
}

// `now` passato dall'esterno quando si serializza una lista: altrimenti ogni
// elemento richiama Date.now().
function serializeTask<T extends { stato: string; scadenza: Date }>(
  task: T,
  now: number = Date.now()
): T & { inRitardo: boolean } {
  return { ...task, inRitardo: isTaskLate(task, now) };
}

export interface CreateTaskInput {
  tipo: string;
  scadenza: string; // ISO datetime
  nota?: string;
}

export interface ListTasksFilters {
  plantId?: string;
  stato?: string;
  from?: string; // ISO datetime, filtro su scadenza
  to?: string;
  // Filtro su completatoA, non su scadenza: un task scaduto giorni fa ma
  // completato oggi deve rientrare in "completati oggi", e con il filtro su
  // scadenza verrebbe perso.
  completatoFrom?: string;
  completatoTo?: string;
  limit?: number;
  offset?: number;
}

const plantSelect = { id: true, nome: true, fotoUrl: true } as const;

// ── Create ────────────────────────────────────────────────────────────────────

export async function createTask(userId: string, plantId: string, input: CreateTaskInput) {
  await findOwnedPlant(userId, plantId);

  const task = await prisma.task.create({
    data: {
      plantId,
      userId,
      tipo: input.tipo,
      sorgente: 'manuale', // i task da API sono manuali; 'calendario'/'sensore' arrivano dal reminder engine
      scadenza: new Date(input.scadenza),
      nota: input.nota,
    },
    include: { plant: { select: plantSelect } },
  });
  return serializeTask(task);
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function listTasks(userId: string, filters: ListTasksFilters = {}) {
  const take = Math.min(filters.limit ?? TASKS_LIMIT_DEFAULT, TASKS_LIMIT_MAX);
  const skip = filters.offset ?? 0;

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      ...(filters.plantId && { plantId: filters.plantId }),
      ...(filters.stato && { stato: filters.stato }),
      ...((filters.from || filters.to) && {
        scadenza: {
          ...(filters.from && { gte: new Date(filters.from) }),
          ...(filters.to && { lte: new Date(filters.to) }),
        },
      }),
      ...((filters.completatoFrom || filters.completatoTo) && {
        completatoA: {
          ...(filters.completatoFrom && { gte: new Date(filters.completatoFrom) }),
          ...(filters.completatoTo && { lte: new Date(filters.completatoTo) }),
        },
      }),
    },
    orderBy: { scadenza: 'asc' },
    include: { plant: { select: plantSelect } },
    take,
    skip,
  });

  const now = Date.now();
  return tasks.map((t: { stato: string; scadenza: Date }) => serializeTask(t, now));
}

// ── Ownership helper ──────────────────────────────────────────────────────────

async function findOwnedTask(userId: string, taskId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task) {
    throw { code: 'TASK_NOT_FOUND', status: 404, message: 'Task non trovato' };
  }
  return task;
}

// ── Complete ──────────────────────────────────────────────────────────────────

export async function completeTask(userId: string, taskId: string, nota?: string) {
  const task = await findOwnedTask(userId, taskId);

  if (task.stato === 'completato') {
    throw { code: 'TASK_ALREADY_COMPLETED', status: 409, message: 'Task già completato' };
  }

  // Transazione unica: prima erano due query separate e se la seconda falliva il
  // task restava completato senza voce nello storico della pianta.
  const updated = await prisma.$transaction(async (tx: typeof prisma) => {
    const result = await tx.task.update({
      where: { id: taskId },
      data: { stato: 'completato', completatoA: new Date(), ...(nota !== undefined && { nota }) },
      include: { plant: { select: plantSelect } },
    });

    // Storico azioni: ogni task completato genera una voce nel log della pianta
    await tx.actionLog.create({
      data: { plantId: task.plantId, userId, tipo: task.tipo, nota },
    });

    return result;
  });

  return serializeTask(updated);
}

// ── Postpone ──────────────────────────────────────────────────────────────────

export async function postponeTask(userId: string, taskId: string, scadenza: string) {
  const task = await findOwnedTask(userId, taskId);

  if (task.stato === 'completato') {
    throw { code: 'TASK_ALREADY_COMPLETED', status: 409, message: 'Task già completato' };
  }

  const nuovaScadenza = new Date(scadenza);
  if (nuovaScadenza <= new Date()) {
    throw { code: 'TASK_SCADENZA_PASSATA', status: 400, message: 'La nuova scadenza deve essere nel futuro' };
  }

  // Rimandare = il task resta pending con nuova scadenza
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { stato: 'pending', scadenza: nuovaScadenza },
    include: { plant: { select: plantSelect } },
  });
  return serializeTask(updated);
}

// ── Skip ──────────────────────────────────────────────────────────────────────

export async function skipTask(userId: string, taskId: string) {
  const task = await findOwnedTask(userId, taskId);

  if (task.stato === 'completato') {
    throw { code: 'TASK_ALREADY_COMPLETED', status: 409, message: 'Task già completato' };
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { stato: 'saltato' },
    include: { plant: { select: plantSelect } },
  });
  return serializeTask(updated);
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteTask(userId: string, taskId: string) {
  await findOwnedTask(userId, taskId);
  await prisma.task.delete({ where: { id: taskId } });
}
