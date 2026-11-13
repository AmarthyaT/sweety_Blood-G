export const SLOTS = ['morning', 'after_breakfast', 'after_lunch', 'after_dinner'];

export const SLOT_LABELS = {
  morning: 'Morning (fasting)',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner',
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function slotLabel(slot) {
  return SLOT_LABELS[slot] ?? slot;
}

/** Today as YYYY-MM-DD, matching the API's UTC calendar-date assumption. */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(dateISO, days) {
  const [year, month, day] = dateISO.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/** "15 Oct 2026" */
export function formatDayLabel(dateISO) {
  if (!dateISO) return '';
  const [year, month, day] = dateISO.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** "15 Oct" - compact chart labels. */
export function formatShortDate(dateISO) {
  if (!dateISO) return '';
  const [, month, day] = dateISO.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

/** "Wed, 15 Oct" for the dashboard heading. */
export function formatWeekday(dateISO) {
  const [year, month, day] = dateISO.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(
    date,
  );
  return `${weekday}, ${formatShortDate(dateISO)}`;
}

/** Classify a glucose value for colour coding. */
export function valueTone(value) {
  if (value < 70) return 'low';
  if (value > 180) return 'high';
  return 'normal';
}
