import Redis from 'ioredis';
import env from '../config/env.js';
import logger from './logger.js';

/**
 * Redis is optional infrastructure:
 *  - no REDIS_URL      -> caching is disabled
 *  - Redis unavailable -> every helper falls back to a cache miss
 *
 * This keeps the app usable for a reviewer who only starts PostgreSQL.
 */
let client = null;
let connectPromise = null;

function getClient() {
  if (!env.redisUrl || env.isTest) return null;

  if (!client) {
    client = new Redis(env.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
    });

    let warned = false;
    client.on('error', (error) => {
      if (!warned) {
        logger.warn(`Redis unavailable, continuing without cache: ${error.message}`);
        warned = true;
      }
    });
  }

  return client;
}

/** Connect eagerly at startup (never throws). */
export async function initCache() {
  const redis = getClient();
  if (!redis) return false;

  if (redis.status === 'ready') return true;

  if (!connectPromise) {
    connectPromise = redis
      .connect()
      .catch((error) => {
        logger.warn(`Could not connect to Redis: ${error.message}`);
      })
      .finally(() => {
        connectPromise = null;
      });
  }

  await connectPromise;
  return redis.status === 'ready';
}

async function readyClient() {
  const redis = getClient();
  if (!redis || redis.status !== 'ready') return null;
  return redis;
}

export async function cacheGet(key) {
  try {
    const redis = await readyClient();
    if (!redis) return null;
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds = env.reportCacheTtlSeconds) {
  try {
    const redis = await readyClient();
    if (!redis) return false;
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    return true;
  } catch {
    return false;
  }
}

/** Delete every key matching `pattern` using SCAN (non-blocking). */
export async function cacheDeletePattern(pattern) {
  try {
    const redis = await readyClient();
    if (!redis) return 0;

    let cursor = '0';
    let deleted = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');

    return deleted;
  } catch {
    return 0;
  }
}

export async function cacheStatus() {
  if (!env.redisUrl || env.isTest) return 'disabled';
  const redis = getClient();
  if (!redis) return 'disabled';
  return redis.status === 'ready' ? 'up' : 'down';
}

/** Only used by tests / graceful shutdown. */
export async function closeCache() {
  if (!client) return;
  await client.quit().catch(() => {});
  client = null;
}

export default { initCache, cacheGet, cacheSet, cacheDeletePattern, cacheStatus, closeCache };
