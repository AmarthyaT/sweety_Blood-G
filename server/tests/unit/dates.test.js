import { describe, expect, it } from 'vitest';
import {
  addDays,
  dailyRange,
  endOfMonth,
  formatDayLabel,
  formatRangeLabel,
  isValidISODate,
  monthToDateRange,
  previousMonthRange,
  startOfMonth,
  todayISO,
} from '../../src/utils/dates.js';

describe('date helpers', () => {
  it('returns the selected day for a daily report', () => {
    expect(dailyRange('2026-10-15')).toEqual({ start: '2026-10-15', end: '2026-10-15' });
  });

  it('builds a month-to-date range', () => {
    expect(monthToDateRange('2026-10-15')).toEqual({
      start: '2026-10-01',
      end: '2026-10-15',
    });
  });

  it('builds the previous full month range', () => {
    expect(previousMonthRange('2026-10-15')).toEqual({
      start: '2026-09-01',
      end: '2026-09-30',
    });
  });

  it('handles the previous month across a year boundary', () => {
    expect(previousMonthRange('2026-01-05')).toEqual({
      start: '2025-12-01',
      end: '2025-12-31',
    });
  });

  it('handles leap years when finding the end of a month', () => {
    expect(endOfMonth('2024-02-10')).toBe('2024-02-29');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('validates ISO calendar dates', () => {
    expect(isValidISODate('2026-10-15')).toBe(true);
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('2026-2-3')).toBe(false);
    expect(isValidISODate('not-a-date')).toBe(false);
  });

  it('formats report labels like the assignment examples', () => {
    expect(formatRangeLabel('2026-10-15', '2026-10-15')).toBe('15 Oct 2026');
    expect(formatRangeLabel('2026-10-01', '2026-10-15')).toBe('1 Oct – 15 Oct 2026');
    expect(formatRangeLabel('2026-09-01', '2026-09-30')).toBe('1 Sep – 30 Sep 2026');
    expect(formatDayLabel('2026-10-01')).toBe('1 Oct 2026');
  });

  it('uses today as a valid ISO date', () => {
    expect(isValidISODate(todayISO())).toBe(true);
    expect(startOfMonth(todayISO()).endsWith('-01')).toBe(true);
  });
});
