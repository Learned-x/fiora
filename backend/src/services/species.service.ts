import { prisma } from '../lib/prisma';

export interface ListSpeciesFilters {
  search?: string;
  categoria?: string;
  limit?: number;
  offset?: number;
}

// Le specie fonte='utente' sono private al proponente (§12.3): la ricerca le
// restituisce solo per l'utente che le ha proposte, mai per gli altri.
export async function listSpecies(userId: string, filters: ListSpeciesFilters = {}) {
  const limit = Math.min(filters.limit ?? 20, 50);
  const offset = filters.offset ?? 0;

  const where = {
    stato: 'attivo',
    OR: [{ fonte: { not: 'utente' } }, { propostoDa: userId }],
    ...(filters.categoria && { categoria: filters.categoria }),
    ...(filters.search && {
      AND: [
        {
          OR: [
            { nomeComune: { contains: filters.search, mode: 'insensitive' as const } },
            { nomeScientifico: { contains: filters.search, mode: 'insensitive' as const } },
          ],
        },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.species.findMany({
      where,
      orderBy: { nomeComune: 'asc' },
      take: limit,
      skip: offset,
    }),
    prisma.species.count({ where }),
  ]);

  return { items, total, limit, offset };
}

export async function getSpecies(speciesId: string) {
  const species = await prisma.species.findUnique({ where: { id: speciesId } });
  if (!species || species.stato !== 'attivo') {
    throw { code: 'SPECIES_NOT_FOUND', status: 404, message: 'Specie non trovata' };
  }
  return species;
}

// ── Proposta specie (§12.3, Fase 9) ────────────────────────────────────────────
// Niente moderazione: la specie proposta è attiva da subito, ricercabile solo
// dal proponente. species_import_raw è vuota finché lo script import CSV non
// gira con dati reali, quindi il check duplicati oggi guarda solo il catalogo
// curato interno (fonte='curato', quello del seed) — mai le proposte di altri
// utenti, che restano private per definizione.

export interface ProposeSpeciesInput {
  nomeComune: string;
  categoria?: string;
  luce: string;
  annaffiatura: string;
  umidita: string;
  nomeScientifico?: string;
  tempMin?: number;
  tempMax?: number;
  tossicita?: boolean;
  noteCura?: string;
  forzaCrea?: boolean;
}

function assertProposalComplete(input: ProposeSpeciesInput): void {
  if (!input.nomeComune?.trim() || !input.luce || !input.annaffiatura || !input.umidita) {
    throw {
      code: 'VALIDATION_ERROR',
      status: 422,
      message: 'Nome comune, luce, annaffiatura e umidità sono obbligatori',
    };
  }
}

export async function proposeSpecies(userId: string, input: ProposeSpeciesInput) {
  assertProposalComplete(input);

  if (!input.forzaCrea) {
    const match = await prisma.species.findFirst({
      where: {
        fonte: 'curato',
        stato: 'attivo',
        nomeComune: { equals: input.nomeComune.trim(), mode: 'insensitive' },
      },
    });
    if (match) {
      return { creata: false, suggerimento: match };
    }
  }

  const species = await prisma.species.create({
    data: {
      nomeComune: input.nomeComune.trim(),
      nomeScientifico: input.nomeScientifico,
      categoria: input.categoria,
      luce: input.luce,
      annaffiatura: input.annaffiatura,
      umidita: input.umidita,
      tempMin: input.tempMin,
      tempMax: input.tempMax,
      tossicita: input.tossicita,
      noteCura: input.noteCura,
      fonte: 'utente',
      stato: 'attivo',
      propostoDa: userId,
    },
  });

  return { creata: true, species };
}
