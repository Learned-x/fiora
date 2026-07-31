import { Worker } from 'bullmq';
import { notificationQueue, redisConnection } from '../lib/bullmq';
import { orarioFromHour, sendDailyPushReminders } from '../services/notification.service';
import { logger } from '../lib/logger';

const log = logger.child({ module: 'job:notification' });

export const notificationWorker = new Worker(
  'push-reminders',
  async () => {
    const orario = orarioFromHour(new Date().getHours());
    if (!orario) {
      return { skipped: true };
    }
    const result = await sendDailyPushReminders(orario);
    log.info(
      { orario, utentiNotificati: result.utentiNotificati, tokenRimossi: result.tokenRimossi },
      'Push reminders inviati'
    );
    return result;
  },
  { connection: redisConnection }
);

notificationWorker.on('failed', (job, err) => {
  log.error({ jobId: job?.id, err }, 'Job push reminders fallito');
});

// Job ricorrente: alle 9, 15 e 19 (timezone server) — dopo il reminder engine
// delle 6:00, i task del giorno sono già stati generati.
export async function schedulePushReminderJob() {
  await notificationQueue.upsertJobScheduler(
    'daily-push-reminders',
    { pattern: '0 9,15,19 * * *' },
    { name: 'send-push-reminders' }
  );
}
