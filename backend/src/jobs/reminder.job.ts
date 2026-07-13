import { Worker } from 'bullmq';
import { redisConnection, reminderQueue } from '../lib/bullmq';
import { runReminderEngine } from '../services/reminder.service';

export const reminderWorker = new Worker(
  'reminder-engine',
  async () => {
    const result = await runReminderEngine();
    console.log(
      `Reminder engine: annaffiatura ${result.watering.created}/${result.watering.checked}, ` +
        `concimazione ${result.fertilizing.created}/${result.fertilizing.checked}, ` +
        `bouquet ${result.bouquet.created}/${result.bouquet.checked}, ` +
        `statoBouquet aggiornati ${result.statoBouquetAggiornati.aggiornati}/${result.statoBouquetAggiornati.checked}`
    );
    return result;
  },
  { connection: redisConnection }
);

reminderWorker.on('failed', (job, err) => {
  console.error(`Job reminder engine fallito: ${job?.id}`, err);
});

// Job ricorrente: ogni giorno alle 6:00, timezone server.
export async function scheduleReminderJob() {
  await reminderQueue.upsertJobScheduler(
    'daily-watering-reminders',
    { pattern: '0 6 * * *' },
    { name: 'generate-watering-reminders' }
  );
}
