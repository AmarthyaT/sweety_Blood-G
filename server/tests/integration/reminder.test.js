import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { runReminderScan } from '../../src/jobs/reminder.service.js';
import { addDays, todayISO } from '../../src/utils/dates.js';
import { authHeader, registerUser } from '../helpers/users.js';
import { resetDatabase, setupDatabase, teardownDatabase } from '../helpers/db.js';

const app = createApp();

beforeAll(setupDatabase);
beforeEach(resetDatabase);
afterAll(teardownDatabase);

async function addReadings(userId, date, slots) {
  for (const [index, slot] of slots.entries()) {
    await pool.query(
      `INSERT INTO readings (user_id, reading_date, slot, value)
       VALUES ($1, $2, $3, $4)`,
      [userId, date, slot, 100 + index],
    );
  }
}

/** The scan only considers accounts that existed on the scanned day. */
async function backdateUser(userId, date = '2026-01-01') {
  await pool.query('UPDATE users SET created_at = $2::date WHERE id = $1', [userId, date]);
}

describe('daily reminder job', () => {
  it('logs patients with fewer than four readings and is idempotent', async () => {
    const incomplete = await registerUser(app, {
      name: 'Incomplete Patient',
      email: 'incomplete@example.com',
    });
    const complete = await registerUser(app, {
      name: 'Complete Patient',
      email: 'complete@example.com',
    });
    const date = '2026-10-15';
    await backdateUser(incomplete.user.id);
    await backdateUser(complete.user.id);

    await addReadings(incomplete.user.id, date, ['morning', 'after_lunch', 'after_dinner']);
    await addReadings(complete.user.id, date, [
      'morning',
      'after_breakfast',
      'after_lunch',
      'after_dinner',
    ]);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const first = await runReminderScan(date);
    expect(first).toEqual({ date, incompletePatients: 1, logsWritten: 1 });

    const second = await runReminderScan(date);
    expect(second).toEqual({ date, incompletePatients: 1, logsWritten: 1 });

    logSpy.mockRestore();

    const { rows } = await pool.query(
      'SELECT user_id, reading_count, message FROM reminder_logs WHERE log_date = $1',
      [date],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(incomplete.user.id);
    expect(rows[0].reading_count).toBe(3);
    expect(rows[0].message).toBe(
      'Reminder: Incomplete Patient logged 3 of 4 readings on 15 Oct 2026.',
    );
  });

  it('handles days with no readings at all', async () => {
    const patient = await registerUser(app, {
      name: 'Quiet Patient',
      email: 'quiet@example.com',
    });
    await backdateUser(patient.user.id);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const summary = await runReminderScan('2026-10-01');
    logSpy.mockRestore();

    expect(summary.incompletePatients).toBe(1);
    expect(summary.logsWritten).toBe(1);

    const { rows } = await pool.query('SELECT message FROM reminder_logs');
    expect(rows[0].message).toContain('Quiet Patient logged 0 of 4 readings');
    expect(patient.user.role).toBe('patient');
  });

  it('does not remind accounts created after the scanned day', async () => {
    const newPatient = await registerUser(app, {
      name: 'New Patient',
      email: 'new@example.com',
    });
    const yesterday = addDays(todayISO(), -1);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const summary = await runReminderScan(yesterday);
    logSpy.mockRestore();

    expect(summary.incompletePatients).toBe(0);
    expect(summary.logsWritten).toBe(0);
    expect(newPatient.user.role).toBe('patient');
  });
});
