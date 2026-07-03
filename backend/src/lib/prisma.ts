import * as PrismaPkg from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const PrismaClient = (PrismaPkg as unknown as {
  PrismaClient: new (...args: any[]) => any;
}).PrismaClient;

const globalForPrisma = globalThis as unknown as { prisma: InstanceType<typeof PrismaClient> };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
