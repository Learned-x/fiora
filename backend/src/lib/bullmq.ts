import { Queue } from 'bullmq';

export const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
};

export const accountDeletionQueue = new Queue('account-deletion', { connection: redisConnection });
export const reminderQueue = new Queue('reminder-engine', { connection: redisConnection });
export const notificationQueue = new Queue('push-reminders', { connection: redisConnection });
