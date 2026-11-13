import { query } from '../db/pool.js';
import { addDays, formatDayLabel, todayISO } from '../utils/dates.js';

export const REMINDER_QUEUE_NAME = 'sweety-daily-reminders';

/**
 * Patients who logged fewer than four readings on `dateISO`.
 * A LEFT JOIN keeps patients with zero readings in the result.
 */
export async function findPatientsWithFewerThanFour(dateISO) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, COUNT(r.id)::int AS reading_count
     FROM users u
     LEFT JOIN readings r
       ON r.user_id = u.id AND r.reading_date = $1
     WHERE u.role = 'patient'
       AND u.created_at < ($1::date + INTERVAL '1 day')
     GROUP BY u.id
     HAVING COUNT(r.id) < 4
     ORDER BY u.name ASC`,
    [dateISO],
  );

  return rows;
}

/**
 * The reminder job's business logic:
 *  1. find patients with fewer than 4 readings,
 *  2. write one idempotent reminder log per patient per day.
 *
 * Defaults to yesterday, because the job runs in the morning and yesterday is
 * a complete day worth reviewing. A date can be passed for manual runs.
 */
export async function runReminderScan(dateISO = addDays(todayISO(), -1)) {
  const patients = await findPatientsWithFewerThanFour(dateISO);
  const label = formatDayLabel(dateISO);
  let logged = 0;

  for (const patient of patients) {
    const message = `Reminder: ${patient.name} logged ${patient.reading_count} of 4 readings on ${label}.`;

    const result = await query(
      `INSERT INTO reminder_logs (user_id, log_date, reading_count, message)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, log_date)
       DO UPDATE SET reading_count = EXCLUDED.reading_count,
                     message = EXCLUDED.message,
                     created_at = now()
       RETURNING id`,
      [patient.id, dateISO, patient.reading_count, message],
    );

    if (result.rowCount > 0) {
      logged += 1;
      console.log(`[reminder] ${message}`);
    }
  }

  const summary = {
    date: dateISO,
    incompletePatients: patients.length,
    logsWritten: logged,
  };

  console.log(
    `[reminder] scan complete for ${label}: ${summary.incompletePatients} patient(s) incomplete, ${summary.logsWritten} log(s) written.`,
  );

  return summary;
}
