import { Worker } from 'bullmq';
import { redisConnection } from '../lib/bullmq';
import { sendEmail } from '../lib/email';
import { logger } from '../lib/logger';

const log = logger.child({ module: 'job:email' });

export const emailWorker = new Worker(
  'email',
  async (job) => {
    const { to, subject, html, text } = job.data as { to: string; subject: string; html: string; text: string };
    await sendEmail(to, subject, html, text);
  },
  { connection: redisConnection }
);

emailWorker.on('completed', (job) => {
  log.info({ jobId: job.id }, 'Email inviata');
});

emailWorker.on('failed', (job, err) => {
  log.error({ jobId: job?.id, err }, 'Invio email fallito');
});
