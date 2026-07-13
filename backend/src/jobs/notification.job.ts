import { Worker } from 'bullmq';
import { notificationQueue, redisConnection } from '../lib/bullmq';
import { orarioFromHour, sendDailyPushReminders } from '../services/notification.service';

export const notificationWorker = new Worker(
  'push-reminders',
  async () => {
    const orario = orarioFromHour(new Date().getHours());
    if (!orario) {
      return { skipped: true };
    }
    const result = await sendDailyPushReminders(orario);
    console.log(
      `Push reminders (${orario}): notificati ${result.utentiNotificati}, token rimossi ${result.tokenRimossi}`
    );
    return result;
  },
  { connection: redisConnection }
);

notificationWorker.on('failed', (job, err) => {
  console.error(`Job push reminders fallito: ${job?.id}`, err);
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
