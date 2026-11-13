/**
 * Run the reminder scan once, without BullMQ. Useful for demos, manual
 * backfills and verifying the job logic:
 *
 *   npm run job:run            # scans yesterday
 *   npm run job:run -- 2026-11-10
 */
import { closePool } from '../db/pool.js';
import { runReminderScan } from './reminder.service.js';

const dateISO = process.argv[2];

runReminderScan(dateISO)
  .then(async (summary) => {
    console.log('Reminder scan summary:', summary);
    await closePool();
  })
  .catch(async (error) => {
    console.error('Reminder scan failed:', error);
    await closePool().catch(() => {});
    process.exitCode = 1;
  });
