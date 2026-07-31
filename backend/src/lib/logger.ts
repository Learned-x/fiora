import path from 'path';
import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
const LOG_LEVEL = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');

// Rotazione giornaliera, 14 file conservati (~2 settimane) per stream.
function fileStream(fileName: string) {
  return {
    level: LOG_LEVEL as pino.Level,
    stream: pino.transport({
      target: 'pino-roll',
      options: {
        file: path.join(LOG_DIR, fileName),
        frequency: 'daily',
        dateFormat: 'yyyy-MM-dd',
        extension: '.log',
        limit: { count: 14 },
        mkdir: true,
      },
    }),
  };
}

function buildStreams(): pino.StreamEntry[] {
  if (isTest) {
    // Niente file/console in test: evita rumore e file spazzatura nel repo.
    return [{ stream: { write: () => {} } }];
  }

  const streams: pino.StreamEntry[] = [
    fileStream('combined'),
    { level: 'error', stream: pino.transport({ target: 'pino-roll', options: {
      file: path.join(LOG_DIR, 'error'),
      frequency: 'daily',
      dateFormat: 'yyyy-MM-dd',
      extension: '.log',
      limit: { count: 30 },
      mkdir: true,
    } }) },
  ];

  if (!isProd) {
    streams.push({
      level: LOG_LEVEL as pino.Level,
      stream: pino.transport({ target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }),
    });
  } else {
    // In produzione stdout resta JSON puro (catturato anche da `docker logs`).
    streams.push({ level: LOG_LEVEL as pino.Level, stream: process.stdout });
  }

  return streams;
}

export const logger = pino(
  {
    level: isTest ? 'silent' : LOG_LEVEL,
    base: { service: 'fiora-backend' },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream(buildStreams())
);
