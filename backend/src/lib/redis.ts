import IORedis from 'ioredis';
import { logger } from './logger';

const log = logger.child({ module: 'redis' });

export const redis = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
});

redis.on('connect', () => log.info('Redis connesso'));
redis.on('error', (err) => log.error({ err }, 'Redis errore'));
