import { Worker } from 'bullmq';
import { redisConnection, reminderQueue } from '../lib/bullmq';
import { generateWateringReminders } from '../services/reminder.service';

export const reminderWorker = new Worker(
  'reminder-engine',
  async () => {
    const result = await generateWateringReminders();
    console.log(`Reminder engine: ${result.created} task creati su ${result.checked} piante controllate`);
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
