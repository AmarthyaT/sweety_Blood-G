import IORedis from 'ioredis';
import env from '../config/env.js';

/**
 * BullMQ needs its own Redis connection with `maxRetriesPerRequest: null`.
 * Returns null when REDIS_URL is not configured.
 */
export function createRedisConnection() {
  if (!env.redisUrl) return null;

  return new IORedis(env.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

export default createRedisConnection;
