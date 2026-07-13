import { prisma } from '../lib/prisma';

export async function listOptions(categoria?: string) {
  return prisma.appOption.findMany({
    where: {
      attivo: true,
      ...(categoria && { categoria }),
    },
    orderBy: [{ categoria: 'asc' }, { ordine: 'asc' }],
  });
}
