import { prisma } from '../lib/prisma';

export interface ListSpeciesFilters {
  search?: string;
  categoria?: string;
  limit?: number;
  offset?: number;
}

// Catalogo specie in sola lettura (il CRUD completo con Trefle arriva in Fase 9)

export async function listSpecies(filters: ListSpeciesFilters = {}) {
  const limit = Math.min(filters.limit ?? 20, 50);
  const offset = filters.offset ?? 0;

  const where = {
    stato: 'attivo',
    ...(filters.categoria && { categoria: filters.categoria }),
    ...(filters.search && {
      OR: [
        { nomeComune: { contains: filters.search, mode: 'insensitive' as const } },
        { nomeScientifico: { contains: filters.search, mode: 'insensitive' as const } },
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
