/**
 * BullMQ worker. Runs as a separate process:
 *   npm run worker
 *
 * It schedules the daily reminder scan (when ENABLE_REMINDER_JOB=true) and
 * processes scan jobs. The API never depends on this process.
 */
import { Worker } from 'bullmq';
import env from '../config/env.js';
import logger from '../lib/logger.js';
import { closePool } from '../db/pool.js';
import { createRedisConnection } from './connection.js';
import {
  REMINDER_QUEUE_NAME,
  runReminderScan,
} from './reminder.service.js';
import {
  closeReminderQueue,
  scheduleReminderJob,
} from './reminder.queue.js';

if (!env.redisUrl) {
  logger.error('REDIS_URL is required to run the reminder worker.');
  process.exit(1);
}

const connection = createRedisConnection();

const worker = new Worker(
  REMINDER_QUEUE_NAME,
  async (job) => {
    logger.info(`Processing reminder job ${job.id} (${job.name})`);
    return runReminderScan(job.data?.date);
  },
  { connection, concurrency: 1 },
);

worker.on('completed', (job, result) => {
  logger.info(`Reminder job ${job.id} completed`, result);
});

worker.on('failed', (job, error) => {
  logger.error(`Reminder job ${job?.id} failed: ${error.message}`);
});

async function start() {
  if (env.enableReminderJob) {
    await scheduleReminderJob(env.reminderCron);
  } else {
    logger.info('ENABLE_REMINDER_JOB is false: worker is running but will not schedule scans.');
  }
  logger.info('Reminder worker is ready.');
}

async function shutdown(signal) {
  logger.info(`${signal} received, closing reminder worker...`);
  await worker.close().catch(() => {});
  await closeReminderQueue().catch(() => {});
  await connection.quit().catch(() => {});
  await closePool().catch(() => {});
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((error) => {
  logger.error('Worker failed to start', error);
  process.exit(1);
});
