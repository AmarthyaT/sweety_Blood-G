/**
 * Calendar-date helpers.
 *
 * A reading stores a calendar date (not a timestamp), so every helper works
 * with `YYYY-MM-DD` strings and UTC to avoid timezone drift. `todayISO()` is
 * also UTC-based; the README documents this assumption.
 */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Current calendar date as YYYY-MM-DD (UTC). */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** True when `value` is a real calendar date in YYYY-MM-DD form. */
export function isValidISODate(value) {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Format a Date as YYYY-MM-DD using its UTC parts. */
export function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

/** Add (or subtract) whole days to a YYYY-MM-DD string. */
export function addDays(dateISO, days) {
  const [year, month, day] = dateISO.split('-').map(Number);
  return toISODate(new Date(Date.UTC(year, month - 1, day + days)));
}

/** First day of the month containing `dateISO`. */
export function startOfMonth(dateISO) {
  return `${dateISO.slice(0, 7)}-01`;
}

/** Last day of the month containing `dateISO`. */
export function endOfMonth(dateISO) {
  const [year, month] = dateISO.split('-').map(Number);
  return toISODate(new Date(Date.UTC(year, month, 0)));
}

/** Daily report range: the selected day only. */
export function dailyRange(dateISO) {
  return { start: dateISO, end: dateISO };
}

/** Month-to-date range: 1st of the selected month through the selected day. */
export function monthToDateRange(dateISO) {
  return { start: startOfMonth(dateISO), end: dateISO };
}

/** Monthly report range: the full month before the selected day's month. */
export function previousMonthRange(dateISO) {
  const firstOfThisMonth = startOfMonth(dateISO);
  const lastOfPreviousMonth = addDays(firstOfThisMonth, -1);
  return { start: startOfMonth(lastOfPreviousMonth), end: lastOfPreviousMonth };
}

/** Human label for the assignment, e.g. "1 Sep - 30 Sep 2026". */
export function formatRangeLabel(start, end) {
  if (start === end) return formatDayLabel(start);

  const startLabel = formatDayLabel(start);
  const endLabel = formatDayLabel(end);

  if (start.slice(0, 7) === end.slice(0, 7)) {
    // Same month: avoid repeating the month and year.
    return `${Number(start.slice(8, 10))} ${MONTH_NAMES[Number(start.slice(5, 7)) - 1]} – ${endLabel}`;
  }

  return `${startLabel} – ${endLabel}`;
}

/** "15 Oct 2026" */
export function formatDayLabel(dateISO) {
  const [year, month, day] = dateISO.split('-').map(Number);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}
