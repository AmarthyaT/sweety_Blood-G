import ApiError from '../../lib/ApiError.js';
import { withTransaction, query } from '../../db/pool.js';
import { cacheDeletePattern } from '../../lib/cache.js';
import { invalidateReportCache } from '../../lib/reportCache.js';
import { isValidISODate } from '../../utils/dates.js';
import { slotLabel, withArticle } from '../../utils/slots.js';
import { assertUuid, validateReadingInput } from './readings.validation.js';

const SLOT_ORDER = `
  CASE slot
    WHEN 'morning' THEN 1
    WHEN 'after_breakfast' THEN 2
    WHEN 'after_lunch' THEN 3
    WHEN 'after_dinner' THEN 4
  END`;

function mapReading(row) {
  return {
    id: row.id,
    date: row.reading_date,
    slot: row.slot,
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function duplicateError(slot) {
  return ApiError.conflict(
    `You already have ${withArticle(slotLabel(slot))} reading for this date.`,
    'slot_already_used',
  );
}

function dailyLimitError() {
  return ApiError.badRequest('You can add only 4 readings per day.', 'daily_limit_reached');
}

/**
 * Serialise writes for one user + day inside the transaction. This makes the
 * "one per slot" and "maximum four" checks reliable under concurrent requests;
 * the database constraints remain the final safety net.
 */
async function lockDay(client, userId, date) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${userId}:${date}`]);
}

function translateWriteError(error, slot) {
  if (error.code === '23505' && error.constraint === 'readings_user_date_slot_unique') {
    return duplicateError(slot);
  }
  if (error.code === '23514' && error.message.includes('Maximum 4 readings per day')) {
    return dailyLimitError();
  }
  if (error.code === '23514' && error.constraint === 'readings_value_check') {
    return ApiError.badRequest('Value must be between 40 and 600 mg/dl.', 'validation_error', {
      field: 'value',
    });
  }
  return null;
}

export async function listReadings(userId, params = {}) {
  const pageParam = String(params.page ?? '1');
  const page = /^\d+$/.test(pageParam) ? Number(pageParam) : Number.NaN;

  if (!Number.isSafeInteger(page) || page < 1) {
    throw ApiError.badRequest('Page must be a positive whole number.', 'invalid_page');
  }

  const limitParam = String(params.limit ?? '20');
  const limit = /^\d+$/.test(limitParam) ? Number(limitParam) : Number.NaN;

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw ApiError.badRequest('Limit must be a whole number between 1 and 100.', 'invalid_limit');
  }

  const values = [userId];
  let where = 'WHERE user_id = $1';

  if (params.date) {
    if (!isValidISODate(params.date)) {
      throw ApiError.badRequest('Please choose a valid date.', 'invalid_date');
    }
    values.push(params.date);
    where += ` AND reading_date = $${values.length}`;
  }

  const countResult = await query(`SELECT COUNT(*)::int AS total FROM readings ${where}`, values);
  const total = countResult.rows[0].total;
  const offset = (page - 1) * limit;

  const listValues = [...values, limit, offset];
  const { rows } = await query(
    `SELECT id, reading_date, slot, value, created_at, updated_at
     FROM readings
     ${where}
     ORDER BY reading_date DESC, ${SLOT_ORDER}
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    listValues,
  );

  return {
    readings: rows.map(mapReading),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

export async function createReading(userId, body) {
  const input = validateReadingInput(body);

  let reading;
  try {
    reading = await withTransaction(async (client) => {
      await lockDay(client, userId, input.date);

      const count = await client.query(
        'SELECT COUNT(*)::int AS count FROM readings WHERE user_id = $1 AND reading_date = $2',
        [userId, input.date],
      );
      if (count.rows[0].count >= 4) throw dailyLimitError();

      const duplicate = await client.query(
        'SELECT 1 FROM readings WHERE user_id = $1 AND reading_date = $2 AND slot = $3',
        [userId, input.date, input.slot],
      );
      if (duplicate.rowCount > 0) throw duplicateError(input.slot);

      const { rows } = await client.query(
        `INSERT INTO readings (user_id, reading_date, slot, value)
         VALUES ($1, $2, $3, $4)
         RETURNING id, reading_date, slot, value, created_at, updated_at`,
        [userId, input.date, input.slot, input.value],
      );
      return mapReading(rows[0]);
    });
  } catch (error) {
    const translated = translateWriteError(error, input.slot);
    if (translated) throw translated;
    throw error;
  }

  await invalidateReportCache(cacheDeletePattern, userId, 'reading created');
  return reading;
}

export async function updateReading(userId, readingId, body) {
  assertUuid(readingId);
  const input = validateReadingInput(body);

  let reading;
  try {
    reading = await withTransaction(async (client) => {
      await lockDay(client, userId, input.date);

      const existing = await client.query(
        `SELECT id, reading_date, slot
         FROM readings
         WHERE id = $1 AND user_id = $2
         FOR UPDATE`,
        [readingId, userId],
      );

      const current = existing.rows[0];
      if (!current) throw ApiError.notFound('Reading not found.', 'reading_not_found');

      const dateChanged = current.reading_date !== input.date;
      const slotChanged = current.slot !== input.slot;

      if (dateChanged || slotChanged) {
        const duplicate = await client.query(
          `SELECT 1 FROM readings
           WHERE user_id = $1 AND reading_date = $2 AND slot = $3 AND id <> $4`,
          [userId, input.date, input.slot, readingId],
        );
        if (duplicate.rowCount > 0) throw duplicateError(input.slot);
      }

      if (dateChanged) {
        const count = await client.query(
          'SELECT COUNT(*)::int AS count FROM readings WHERE user_id = $1 AND reading_date = $2',
          [userId, input.date],
        );
        if (count.rows[0].count >= 4) throw dailyLimitError();
      }

      const { rows } = await client.query(
        `UPDATE readings
         SET reading_date = $1, slot = $2, value = $3
         WHERE id = $4 AND user_id = $5
         RETURNING id, reading_date, slot, value, created_at, updated_at`,
        [input.date, input.slot, input.value, readingId, userId],
      );

      return mapReading(rows[0]);
    });
  } catch (error) {
    const translated = translateWriteError(error, input.slot);
    if (translated) throw translated;
    throw error;
  }

  await invalidateReportCache(cacheDeletePattern, userId, 'reading updated');
  return reading;
}

export async function deleteReading(userId, readingId) {
  assertUuid(readingId);

  const { rowCount } = await query('DELETE FROM readings WHERE id = $1 AND user_id = $2', [
    readingId,
    userId,
  ]);

  if (rowCount === 0) {
    throw ApiError.notFound('Reading not found.', 'reading_not_found');
  }

  await invalidateReportCache(cacheDeletePattern, userId, 'reading deleted');
}
