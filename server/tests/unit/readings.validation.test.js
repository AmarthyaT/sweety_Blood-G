import { describe, expect, it } from 'vitest';
import { validateReadingInput } from '../../src/modules/readings/readings.validation.js';
import { addDays, todayISO } from '../../src/utils/dates.js';

function expectMessage(payload, message) {
  try {
    validateReadingInput(payload);
    throw new Error('Expected validation to fail');
  } catch (error) {
    expect(error.message).toBe(message);
    expect(error.status).toBe(400);
  }
}

describe('reading validation', () => {
  const valid = { date: '2026-10-15', slot: 'after_lunch', value: 140 };

  it('accepts a valid reading and normalises numeric strings', () => {
    expect(validateReadingInput({ ...valid, value: '140' })).toEqual({
      date: '2026-10-15',
      slot: 'after_lunch',
      value: 140,
    });
  });

  it('requires a value', () => {
    expectMessage({ ...valid, value: undefined }, 'Please enter a glucose value.');
    expectMessage({ ...valid, value: null }, 'Please enter a glucose value.');
    expectMessage({ ...valid, value: '' }, 'Please enter a glucose value.');
  });

  it('rejects values outside 40-600 and non-whole numbers', () => {
    const message = 'Value must be between 40 and 600 mg/dl.';
    expectMessage({ ...valid, value: 39 }, message);
    expectMessage({ ...valid, value: 601 }, message);
    expectMessage({ ...valid, value: 40.5 }, message);
    expectMessage({ ...valid, value: 'abc' }, message);
    expectMessage({ ...valid, value: true }, message);
  });

  it('accepts the boundary values', () => {
    expect(validateReadingInput({ ...valid, value: 40 }).value).toBe(40);
    expect(validateReadingInput({ ...valid, value: 600 }).value).toBe(600);
  });

  it('rejects a date in the future', () => {
    expectMessage(
      { ...valid, date: addDays(todayISO(), 1) },
      'Date cannot be in the future.',
    );
  });

  it('requires a valid date and slot', () => {
    expectMessage({ ...valid, date: '' }, 'Please choose a date.');
    expectMessage({ ...valid, date: '2026-02-30' }, 'Please choose a valid date.');
    expectMessage({ ...valid, slot: 'midnight' }, 'Please choose a valid time slot.');
  });
});
