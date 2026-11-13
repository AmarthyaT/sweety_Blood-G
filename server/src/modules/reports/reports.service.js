import ApiError from '../../lib/ApiError.js';
import { query } from '../../db/pool.js';
import { cacheGet, cacheSet } from '../../lib/cache.js';
import { reportCacheKey } from '../../lib/reportCache.js';
import {
  dailyRange,
  formatDayLabel,
  formatRangeLabel,
  isValidISODate,
  monthToDateRange,
  previousMonthRange,
  todayISO,
} from '../../utils/dates.js';

export const REPORT_TYPES = ['daily', 'mtd', 'monthly'];

const SLOT_ORDER = `
  CASE slot
    WHEN 'morning' THEN 1
    WHEN 'after_breakfast' THEN 2
    WHEN 'after_lunch' THEN 3
    WHEN 'after_dinner' THEN 4
  END`;

function resolveRange(type, dateISO) {
  switch (type) {
    case 'daily':
      return { range: dailyRange(dateISO), label: formatDayLabel(dateISO) };
    case 'mtd':
      return {
        range: monthToDateRange(dateISO),
        label: formatRangeLabel(monthToDateRange(dateISO).start, dateISO),
      };
    case 'monthly': {
      const range = previousMonthRange(dateISO);
      return { range, label: formatRangeLabel(range.start, range.end) };
    }
    default:
      throw ApiError.badRequest(
        'Unknown report type. Use daily, mtd or monthly.',
        'invalid_report_type',
      );
  }
}

/**
 * Build a report for one user.
 *
 * All three report types use the same shape so the client can reuse a single
 * view. `readings` is always included (the daily report lists it, and the
 * month chart uses it); `stats` is the aggregated summary.
 */
export async function getReport({ userId, type = 'daily', date = todayISO() }) {
  const reportType = String(type || 'daily');

  if (!REPORT_TYPES.includes(reportType)) {
    throw ApiError.badRequest(
      'Unknown report type. Use daily, mtd or monthly.',
      'invalid_report_type',
    );
  }

  const dateISO = String(date || todayISO());

  if (!isValidISODate(dateISO)) {
    throw ApiError.badRequest('Please choose a valid date.', 'invalid_date');
  }

  if (dateISO > todayISO()) {
    throw ApiError.badRequest('Date cannot be in the future.', 'invalid_date');
  }

  const cacheKey = reportCacheKey(userId, reportType, dateISO);
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const { range, label } = resolveRange(reportType, dateISO);

  const statsResult = await query(
    `SELECT
       COUNT(*)::int AS count,
       MAX(value)::int AS highest,
       MIN(value)::int AS lowest,
       ROUND(AVG(value)::numeric, 1)::float AS average
     FROM readings
     WHERE user_id = $1 AND reading_date BETWEEN $2 AND $3`,
    [userId, range.start, range.end],
  );

  const readingsResult = await query(
    `SELECT id, reading_date, slot, value
     FROM readings
     WHERE user_id = $1 AND reading_date BETWEEN $2 AND $3
     ORDER BY reading_date ASC, ${SLOT_ORDER}`,
    [userId, range.start, range.end],
  );

  const stats = statsResult.rows[0];

  const report = {
    type: reportType,
    label,
    range: { start: range.start, end: range.end },
    stats: {
      count: stats.count,
      highest: stats.highest,
      lowest: stats.lowest,
      average: stats.average === null ? null : Number(stats.average),
    },
    readings: readingsResult.rows.map((row) => ({
      id: row.id,
      date: row.reading_date,
      slot: row.slot,
      value: row.value,
    })),
  };

  await cacheSet(cacheKey, report);
  return report;
}
