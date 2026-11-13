import ApiError from '../../lib/ApiError.js';
import { isValidISODate, todayISO } from '../../utils/dates.js';
import { isValidSlot } from '../../utils/slots.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validationError(message, field) {
  return ApiError.badRequest(message, 'validation_error', { field });
}

/**
 * Validate and normalise a reading payload.
 *
 * Messages intentionally match the assignment wording so they can be shown
 * directly in the UI:
 *  - "Please enter a glucose value."
 *  - "Value must be between 40 and 600 mg/dl."
 *  - "Date cannot be in the future."
 */
export function validateReadingInput(body = {}) {
  const rawValue = body.value;

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    throw validationError('Please enter a glucose value.', 'value');
  }

  const value =
    typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string' && rawValue.trim() !== ''
        ? Number(rawValue.trim())
        : Number.NaN;

  if (!Number.isInteger(value) || value < 40 || value > 600) {
    throw validationError('Value must be between 40 and 600 mg/dl.', 'value');
  }

  const date = typeof body.date === 'string' ? body.date.trim() : '';

  if (date.length === 0) {
    throw validationError('Please choose a date.', 'date');
  }
  if (!isValidISODate(date)) {
    throw validationError('Please choose a valid date.', 'date');
  }
  if (date > todayISO()) {
    throw validationError('Date cannot be in the future.', 'date');
  }

  const slot = typeof body.slot === 'string' ? body.slot.trim() : '';

  if (!isValidSlot(slot)) {
    throw validationError('Please choose a valid time slot.', 'slot');
  }

  return { date, slot, value };
}

export function assertUuid(id) {
  if (!UUID_PATTERN.test(id)) {
    throw ApiError.notFound('Reading not found.', 'reading_not_found');
  }
}
