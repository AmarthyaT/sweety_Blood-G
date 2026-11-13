/**
 * The four fixed time slots, in the order they are shown in the UI.
 */
export const SLOTS = ['morning', 'after_breakfast', 'after_lunch', 'after_dinner'];

export const SLOT_LABELS = {
  morning: 'Morning (fasting)',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner',
};

export function isValidSlot(slot) {
  return SLOTS.includes(slot);
}

export function slotLabel(slot) {
  return SLOT_LABELS[slot] ?? slot;
}

/** Small helper so messages read naturally: "an After lunch reading". */
export function withArticle(label) {
  return /^[aeiou]/i.test(label) ? `an ${label}` : `a ${label}`;
}
