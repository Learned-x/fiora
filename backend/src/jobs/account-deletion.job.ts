import { Worker } from 'bullmq';
import { redisConnection } from '../lib/bullmq';
import { prisma } from '../lib/prisma';

export const accountDeletionWorker = new Worker(
  'account-deletion',
  async (job) => {
    const { userId } = job.data as { userId: string };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.deletedAt) return; // annullata nel frattempo

    // L'utente potrebbe aver annullato l'eliminazione dopo lo scheduling del job
    if (user.deletedAt > new Date()) return;

    // 1. Elimina utente: cascade su plants, tasks, action_logs, photo_diary,
    //    refresh_tokens, smart_vases (schema.prisma onDelete: Cascade)
    await prisma.user.delete({ where: { id: userId } });

    // TODO Fase 2+: eliminare foto da MinIO e sensor_readings prima del cascade,
    // quando saranno implementati i servizi di storage e telemetria.
  },
  { connection: redisConnection }
);

accountDeletionWorker.on('completed', (job) => {
  console.log(`Job eliminazione account completato: ${job.id}`);
});

accountDeletionWorker.on('failed', (job, err) => {
  console.error(`Job eliminazione account fallito: ${job?.id}`, err);
});
