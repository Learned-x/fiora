import { prisma } from '../lib/prisma';
import { audit } from '../lib/audit';

// Campi specie restituiti insieme alla pianta (sottoinsieme leggero del catalogo)
const speciesSelect = {
  id: true,
  nomeComune: true,
  nomeScientifico: true,
  categoria: true,
  luce: true,
  annaffiatura: true,
  umidita: true,
  sogliaUmidita: true,
  tempMin: true,
  tempMax: true,
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
  giaInAcqua?: boolean; // solo bouquet: se false, crea task iniziale "metti in acqua"
  luceCura?: string;
  annaffiaturaCura?: string;
  umiditaCura?: string;
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
  vasoId?: string | null;
  sogliaUmiditaMin?: number | null;
  sogliaUmiditaMax?: number | null;
  sogliaLuceMin?: number | null;
  sogliaLuceMax?: number | null;
  sogliaTempMin?: number | null;
  sogliaTempMax?: number | null;
  luceCura?: string | null;
  annaffiaturaCura?: string | null;
  umiditaCura?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function assertSpeciesExists(speciesId: string): Promise<void> {
  const species = await prisma.species.findUnique({ where: { id: speciesId } });
  if (!species) {
    throw { code: 'SPECIES_NOT_FOUND', status: 404, message: 'Specie non trovata' };
  }
}

const SOGLIA_PAIRS = [
  ['sogliaUmiditaMin', 'sogliaUmiditaMax'],
  ['sogliaLuceMin', 'sogliaLuceMax'],
  ['sogliaTempMin', 'sogliaTempMax'],
] as const;

// Le soglie sensore hanno senso solo su una pianta con vaso collegato: senza,
// non esiste nessuna lettura reale con cui confrontarle.
function assertSoglieValide(input: UpdatePlantInput, vasoIdEffettivo: string | null): void {
  const haSoglie = SOGLIA_PAIRS.some(
    ([min, max]) => input[min] !== undefined || input[max] !== undefined
  );
  if (!haSoglie) return;

  if (!vasoIdEffettivo) {
    throw {
      code: 'PLANT_NO_VASE',
      status: 422,
      message: 'Le soglie sensore richiedono una pianta con vaso collegato',
    };
  }

  for (const [minKey, maxKey] of SOGLIA_PAIRS) {
    const min = input[minKey];
    const max = input[maxKey];
    if (min != null && max != null && min > max) {
      throw {
        code: 'VALIDATION_ERROR',
        status: 422,
        message: `${minKey} non può essere maggiore di ${maxKey}`,
      };
    }
  }
}

// Senza una specie di catalogo non c'è nessun'altra fonte per luce/annaffiatura/
// umidità: servono per la guida cura e annaffiatura pilota il reminder engine,
// quindi diventano obbligatori (solo per tipo 'pianta' — i bouquet non hanno
// questi concetti, seguono un ciclo di vita diverso).
function assertCuraCompleta(tipo: string, speciesIdEffettivo: string | null | undefined, cura: {
  luceCura?: string | null;
  annaffiaturaCura?: string | null;
  umiditaCura?: string | null;
}): void {
  if (tipo !== 'pianta' || speciesIdEffettivo) return;

  if (!cura.luceCura || !cura.annaffiaturaCura || !cura.umiditaCura) {
    throw {
      code: 'PLANT_CURA_INCOMPLETA',
      status: 422,
      message: 'Senza una specie di catalogo, luce, annaffiatura e umidità sono obbligatorie',
    };
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

// Annulla i task pending di una pianta (usato su eliminazione e archiviazione,
// per non generare reminder orfani su piante non più attive).
async function skipPendingTasks(plantId: string): Promise<void> {
  await prisma.task.updateMany({
    where: { plantId, stato: 'pending' },
    data: { stato: 'saltato' },
  });
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createPlant(userId: string, input: CreatePlantInput) {
  if (input.speciesId) {
    await assertSpeciesExists(input.speciesId);
  }
  assertCuraCompleta(input.tipo, input.speciesId, input);

  const plant = await prisma.plant.create({
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
      ...(input.tipo === 'pianta' && {
        luceCura: input.luceCura,
        annaffiaturaCura: input.annaffiaturaCura,
        umiditaCura: input.umiditaCura,
      }),
    },
    include: { species: { select: speciesSelect } },
  });

  if (input.tipo === 'bouquet' && !input.giaInAcqua) {
    await prisma.task.create({
      data: {
        plantId: plant.id,
        userId,
        tipo: 'cambio_acqua',
        sorgente: 'manuale',
        stato: 'pending',
        scadenza: new Date(),
        nota: 'Metti il bouquet in acqua',
      },
    });
  }

  return plant;
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
  const existing = await findOwnedPlant(userId, plantId);

  if (input.speciesId) {
    await assertSpeciesExists(input.speciesId);
  }

  if (input.vasoId) {
    const vaso = await prisma.smartVase.findFirst({ where: { id: input.vasoId, userId } });
    if (!vaso) {
      throw { code: 'VASE_NOT_FOUND', status: 404, message: 'Vaso non trovato' };
    }
  }

  const vasoIdEffettivo = input.vasoId !== undefined ? input.vasoId : existing.vasoId;
  assertSoglieValide(input, vasoIdEffettivo);

  const speciesIdEffettivo = input.speciesId !== undefined ? input.speciesId : existing.speciesId;
  assertCuraCompleta(existing.tipo, speciesIdEffettivo, {
    luceCura: input.luceCura !== undefined ? input.luceCura : existing.luceCura,
    annaffiaturaCura: input.annaffiaturaCura !== undefined ? input.annaffiaturaCura : existing.annaffiaturaCura,
    umiditaCura: input.umiditaCura !== undefined ? input.umiditaCura : existing.umiditaCura,
  });

  const updated = await prisma.$transaction(async (tx: typeof prisma) => {
    // Cambio pianta: il vaso può essere collegato a una sola pianta alla volta,
    // scollegare quella precedente fa parte dell'operazione, non è un conflitto.
    if (input.vasoId) {
      await tx.plant.updateMany({
        where: { vasoId: input.vasoId, id: { not: plantId } },
        data: { vasoId: null },
      });
    }

    return tx.plant.update({
      where: { id: plantId },
      data: {
        ...(input.nome !== undefined && { nome: input.nome }),
        ...(input.speciesId !== undefined && { speciesId: input.speciesId }),
        ...(input.posizione !== undefined && { posizione: input.posizione }),
        ...(input.note !== undefined && { note: input.note }),
        ...(input.fotoUrl !== undefined && { fotoUrl: input.fotoUrl }),
        ...(input.stato !== undefined && { stato: input.stato }),
        ...(input.statoBouquet !== undefined && { statoBouquet: input.statoBouquet, statoBouquetManuale: true }),
        ...(input.dataRicezione !== undefined && {
          dataRicezione: input.dataRicezione ? new Date(input.dataRicezione) : null,
        }),
        ...(input.luceCura !== undefined && { luceCura: input.luceCura }),
        ...(input.annaffiaturaCura !== undefined && { annaffiaturaCura: input.annaffiaturaCura }),
        ...(input.umiditaCura !== undefined && { umiditaCura: input.umiditaCura }),
        ...(input.vasoId !== undefined && { vasoId: input.vasoId }),
        // Scollegare il vaso azzera anche le soglie: senza vaso non hanno più
        // senso (nessuna lettura reale con cui confrontarle), altrimenti
        // resterebbero orfane finché non se ne collega uno nuovo.
        ...(input.vasoId === null
          ? {
              sogliaUmiditaMin: null,
              sogliaUmiditaMax: null,
              sogliaLuceMin: null,
              sogliaLuceMax: null,
              sogliaTempMin: null,
              sogliaTempMax: null,
            }
          : {
              ...(input.sogliaUmiditaMin !== undefined && { sogliaUmiditaMin: input.sogliaUmiditaMin }),
              ...(input.sogliaUmiditaMax !== undefined && { sogliaUmiditaMax: input.sogliaUmiditaMax }),
              ...(input.sogliaLuceMin !== undefined && { sogliaLuceMin: input.sogliaLuceMin }),
              ...(input.sogliaLuceMax !== undefined && { sogliaLuceMax: input.sogliaLuceMax }),
              ...(input.sogliaTempMin !== undefined && { sogliaTempMin: input.sogliaTempMin }),
              ...(input.sogliaTempMax !== undefined && { sogliaTempMax: input.sogliaTempMax }),
            }),
      },
      include: { species: { select: speciesSelect } },
    });
  });

  if (input.vasoId !== undefined) {
    audit('plant.vase_link.changed', {
      userId,
      targetId: plantId,
      meta: input.vasoId ? { azione: 'collegato', vasoId: input.vasoId } : { azione: 'scollegato' },
    });
  }

  if (input.stato === 'archiviato') {
    await skipPendingTasks(plantId);
  }

  return updated;
}

// ── Delete (soft) ─────────────────────────────────────────────────────────────

export async function deletePlant(userId: string, plantId: string) {
  await findOwnedPlant(userId, plantId);

  // Soft delete: la pianta resta in DB per storico/foto, sparisce dalle liste.
  // I task pending vengono annullati per non generare reminder orfani.
  await prisma.plant.update({ where: { id: plantId }, data: { stato: 'eliminato' } });
  await skipPendingTasks(plantId);
}
