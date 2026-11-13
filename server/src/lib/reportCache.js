import logger from './logger.js';

export const REPORT_CACHE_PREFIX = 'sweety:reports';

export function reportCacheKey(userId, type, dateISO) {
  return `${REPORT_CACHE_PREFIX}:${userId}:${type}:${dateISO}`;
}

export function reportCachePattern(userId) {
  return `${REPORT_CACHE_PREFIX}:${userId}:*`;
}

/**
 * Called after any reading write. Logs how many cached reports were dropped,
 * which makes the invalidation visible in the API log during a demo.
 */
export async function invalidateReportCache(cacheDeletePattern, userId, reason) {
  const deleted = await cacheDeletePattern(reportCachePattern(userId));
  if (deleted > 0) {
    logger.debug(`Cleared ${deleted} cached report(s) for user ${userId} (${reason})`);
  }
  return deleted;
}
