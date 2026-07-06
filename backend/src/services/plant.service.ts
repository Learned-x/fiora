import { prisma } from '../lib/prisma';

// Campi specie restituiti insieme alla pianta (sottoinsieme leggero del catalogo)
const speciesSelect = {
  id: true,
  nomeComune: true,
  nomeScientifico: true,
  categoria: true,
  luce: true,
  annaffiatura: true,
  umidita: true,
  tossicita: true,
  immaginePrincipaleUrl: true,
} as const;

export interface CreatePlantInput {
  nome: string;
  tipo: 'pianta' | 'bouquet';
  speciesId?: string;
  posizione?: string;
  note?: string;
  fotoUrl?: string;
  statoBouquet?: string;
  dataRicezione?: string; // ISO date, solo per bouquet
}

export interface UpdatePlantInput {
  nome?: string;
  speciesId?: string | null;
  posizione?: string | null;
  note?: string | null;
  fotoUrl?: string | null;
  stato?: 'attivo' | 'archiviato';
  statoBouquet?: string | null;
  dataRicezione?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function assertSpeciesExists(speciesId: string): Promise<void> {
  const species = await prisma.species.findUnique({ where: { id: speciesId } });
  if (!species) {
    throw { code: 'SPECIES_NOT_FOUND', status: 404, message: 'Specie non trovata' };
  }
}

// Ownership: la pianta deve appartenere all'utente e non essere eliminata
export async function findOwnedPlant(userId: string, plantId: string) {
  const plant = await prisma.plant.findFirst({
    where: { id: plantId, userId, stato: { not: 'eliminato' } },
  });
  if (!plant) {
    throw { code: 'PLANT_NOT_FOUND', status: 404, message: 'Pianta non trovata' };
  }
  return plant;
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createPlant(userId: string, input: CreatePlantInput) {
  if (input.speciesId) {
    await assertSpeciesExists(input.speciesId);
  }

  return prisma.plant.create({
    data: {
      userId,
      nome: input.nome,
      tipo: input.tipo,
      speciesId: input.speciesId,
      posizione: input.posizione,
      note: input.note,
      fotoUrl: input.fotoUrl,
      statoBouquet: input.tipo === 'bouquet' ? input.statoBouquet ?? 'fresco' : null,
      dataRicezione: input.tipo === 'bouquet' && input.dataRicezione ? new Date(input.dataRicezione) : null,
    },
    include: { species: { select: speciesSelect } },
  });
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function listPlants(userId: string, stato: 'attivo' | 'archiviato' = 'attivo') {
  return prisma.plant.findMany({
    where: { userId, stato },
    orderBy: { createdAt: 'desc' },
    include: {
      species: { select: speciesSelect },
      _count: { select: { tasks: { where: { stato: 'pending' } } } },
    },
  });
}

// ── Get ───────────────────────────────────────────────────────────────────────

export async function getPlant(userId: string, plantId: string) {
  const plant = await prisma.plant.findFirst({
    where: { id: plantId, userId, stato: { not: 'eliminato' } },
    include: {
      species: { select: speciesSelect },
      tasks: {
        where: { stato: 'pending' },
        orderBy: { scadenza: 'asc' },
      },
    },
  });
  if (!plant) {
    throw { code: 'PLANT_NOT_FOUND', status: 404, message: 'Pianta non trovata' };
  }
  return plant;
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updatePlant(userId: string, plantId: string, input: UpdatePlantInput) {
  await findOwnedPlant(userId, plantId);

  if (input.speciesId) {
    await assertSpeciesExists(input.speciesId);
  }

  return prisma.plant.update({
    where: { id: plantId },
    data: {
      ...(input.nome !== undefined && { nome: input.nome }),
      ...(input.speciesId !== undefined && { speciesId: input.speciesId }),
      ...(input.posizione !== undefined && { posizione: input.posizione }),
      ...(input.note !== undefined && { note: input.note }),
      ...(input.fotoUrl !== undefined && { fotoUrl: input.fotoUrl }),
      ...(input.stato !== undefined && { stato: input.stato }),
      ...(input.statoBouquet !== undefined && { statoBouquet: input.statoBouquet }),
      ...(input.dataRicezione !== undefined && {
        dataRicezione: input.dataRicezione ? new Date(input.dataRicezione) : null,
      }),
    },
    include: { species: { select: speciesSelect } },
  });
}

// ── Delete (soft) ─────────────────────────────────────────────────────────────

export async function deletePlant(userId: string, plantId: string) {
  await findOwnedPlant(userId, plantId);

  // Soft delete: la pianta resta in DB per storico/foto, sparisce dalle liste.
  // I task pending vengono annullati per non generare reminder orfani.
  await prisma.plant.update({ where: { id: plantId }, data: { stato: 'eliminato' } });
  await prisma.task.updateMany({
    where: { plantId, stato: 'pending' },
    data: { stato: 'saltato' },
  });
}
