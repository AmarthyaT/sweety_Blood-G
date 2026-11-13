import { Queue } from 'bullmq';
import logger from '../lib/logger.js';
import { createRedisConnection } from './connection.js';
import { REMINDER_QUEUE_NAME } from './reminder.service.js';

let queue = null;

export function getReminderQueue() {
  if (!queue) {
    const connection = createRedisConnection();
    if (!connection) {
      throw new Error('REDIS_URL is required for the reminder queue.');
    }
    queue = new Queue(REMINDER_QUEUE_NAME, { connection });
  }
  return queue;
}

/**
 * Register the repeatable daily scan. BullMQ's scheduler is idempotent, so
 * restarting the worker will not create duplicate schedules.
 */
export async function scheduleReminderJob(cronPattern) {
  const reminderQueue = getReminderQueue();

  if (typeof reminderQueue.upsertJobScheduler === 'function') {
    const scheduler = await reminderQueue.upsertJobScheduler(
      'daily-reminder-scan',
      { pattern: cronPattern },
      { name: 'scan', data: {}, opts: { removeOnComplete: 50, removeOnFail: 50 } },
    );
    logger.info(`Reminder job scheduled with cron "${cronPattern}".`);
    return scheduler;
  }

  // Fallback for older BullMQ versions.
  const job = await reminderQueue.add(
    'scan',
    {},
    {
      repeat: { pattern: cronPattern },
      removeOnComplete: 50,
      removeOnFail: 50,
    },
  );
  logger.info(`Reminder job scheduled with cron "${cronPattern}".`);
  return job;
}

export async function closeReminderQueue() {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
