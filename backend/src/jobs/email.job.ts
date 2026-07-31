import { Worker } from 'bullmq';
import { redisConnection } from '../lib/bullmq';
import { sendEmail } from '../lib/email';
import { logger } from '../lib/logger';
import { audit } from '../lib/audit';

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
  log.info({ jobId: job.id, to: job.data.to, name: job.name }, 'Email inviata');
  audit('email.sent', { meta: { jobName: job.name, to: job.data.to } });
});

emailWorker.on('failed', (job, err) => {
  // L'esito "ok" lato richiesta HTTP significa solo "job accodato": questo è
  // l'unico posto dove si vede se Resend ha davvero rifiutato l'invio (es. 403
  // sandbox, dominio non verificato) — senza throw esplicito in sendEmail()
  // il job risultava "completed" anche sugli errori API di Resend.
  log.error({ jobId: job?.id, to: job?.data?.to, name: job?.name, err: err.message }, 'Invio email fallito');
  audit('email.failed', { meta: { jobName: job?.name, to: job?.data?.to, error: err.message } });
});
