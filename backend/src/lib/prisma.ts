import * as PrismaPkg from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const PrismaClient = (PrismaPkg as unknown as {
  PrismaClient: new (...args: any[]) => any;
}).PrismaClient;

const globalForPrisma = globalThis as unknown as { prisma: InstanceType<typeof PrismaClient> };

// `?connection_limit=` nell'URL non ha effetto con l'adapter pg: il pool va
// configurato qui. `max: 10` = tetto di connessioni per processo.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 10 });

// Singleton incondizionato: in dev evita pool multipli sull'hot-reload di
// ts-node-dev, in prod evita che un secondo processo (es. worker BullMQ) apra
// un pool separato ignorando quello già istanziato.
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });
globalForPrisma.prisma = prisma;
