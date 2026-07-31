import { Worker } from 'bullmq';
import { redisConnection, reminderQueue } from '../lib/bullmq';
import { runReminderEngine } from '../services/reminder.service';
import { logger } from '../lib/logger';

const log = logger.child({ module: 'job:reminder' });

export const reminderWorker = new Worker(
  'reminder-engine',
  async () => {
    const result = await runReminderEngine();
    log.info(
      {
        watering: result.watering,
        fertilizing: result.fertilizing,
        bouquet: result.bouquet,
        statoBouquetAggiornati: result.statoBouquetAggiornati,
      },
      'Reminder engine completato'
    );
    return result;
  },
  { connection: redisConnection }
);

reminderWorker.on('failed', (job, err) => {
  log.error({ jobId: job?.id, err }, 'Job reminder engine fallito');
});

// Job ricorrente: ogni giorno alle 6:00, timezone server.
export async function scheduleReminderJob() {
  await reminderQueue.upsertJobScheduler(
    'daily-watering-reminders',
    { pattern: '0 6 * * *' },
    { name: 'generate-watering-reminders' }
  );
}
