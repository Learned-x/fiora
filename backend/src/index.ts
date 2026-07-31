import dotenv from 'dotenv';
dotenv.config();

// If TypeScript reports: "Cannot find module './app' or its corresponding type declarations",
// ignore the error here while ensuring the runtime import works.
// @ts-ignore
import app from './app';
import { connectMqtt } from './lib/mqtt';
import { logger } from './lib/logger';
import './jobs/account-deletion.job';
import './jobs/reminder.job';
import { scheduleReminderJob } from './jobs/reminder.job';
import { schedulePushReminderJob } from './jobs/notification.job';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Fiora backend in ascolto');
  connectMqtt();
  scheduleReminderJob();
  schedulePushReminderJob();
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled rejection');
});