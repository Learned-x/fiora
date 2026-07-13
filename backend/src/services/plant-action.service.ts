import { prisma } from '../lib/prisma';
import { findOwnedPlant } from './plant.service';

export interface ListPlantActionsFilters {
  tipo?: string;
  from?: string; // ISO datetime
  to?: string;
}

export interface ListPlantActionsPagination {
  limit?: number;
  offset?: number;
}

const DEFAULT_LIMIT = 20;

export async function listPlantActions(
  userId: string,
  plantId: string,
  filters: ListPlantActionsFilters = {},
  pagination: ListPlantActionsPagination = {}
) {
  await findOwnedPlant(userId, plantId);

  const limit = pagination.limit ?? DEFAULT_LIMIT;
  const offset = pagination.offset ?? 0;

  const where = {
    plantId,
    ...(filters.tipo && { tipo: filters.tipo }),
    ...((filters.from || filters.to) && {
      createdAt: {
        ...(filters.from && { gte: new Date(filters.from) }),
        ...(filters.to && { lte: new Date(filters.to) }),
      },
    }),
  };

  const [items, total] = await Promise.all([
    prisma.actionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.actionLog.count({ where }),
  ]);

  return { items, total, limit, offset };
}
