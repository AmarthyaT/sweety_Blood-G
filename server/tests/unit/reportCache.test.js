import { describe, expect, it } from 'vitest';
import {
  REPORT_CACHE_PREFIX,
  invalidateReportCache,
  reportCacheKey,
  reportCachePattern,
} from '../../src/lib/reportCache.js';

describe('report cache keys', () => {
  it('namespaces keys by user, report type and date', () => {
    const key = reportCacheKey('user-1', 'monthly', '2026-10-15');

    expect(REPORT_CACHE_PREFIX).toBe('sweety:reports');
    expect(key).toBe('sweety:reports:user-1:monthly:2026-10-15');
  });

  it('builds a per-user invalidation pattern', () => {
    expect(reportCachePattern('user-1')).toBe('sweety:reports:user-1:*');
  });

  it('delegates invalidation and returns the deleted count', async () => {
    const calls = [];
    const deleted = await invalidateReportCache(async (pattern) => {
      calls.push(pattern);
      return 3;
    }, 'user-1', 'reading created');

    expect(deleted).toBe(3);
    expect(calls).toEqual(['sweety:reports:user-1:*']);
  });
});
