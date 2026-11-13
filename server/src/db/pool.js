import pg from 'pg';
import env from '../config/env.js';
import logger from '../lib/logger.js';

const { Pool } = pg;

// PostgreSQL DATE values are calendar dates, not instants. Return them as
// "YYYY-MM-DD" strings so they never shift across timezones.
pg.types.setTypeParser(1082, (value) => value);

/**
 * One shared pool for the whole API process. Connections are created lazily.
 * `DATABASE_URL` is resolved in config/env.js (test environments use
 * TEST_DATABASE_URL).
 */
export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (error) => {
  // A background connection failed; keep the API alive and let the pool retry.
  logger.error('Unexpected PostgreSQL pool error', error.message);
});

export function query(text, params) {
  return pool.query(text, params);
}

/** Run `fn(client)` inside BEGIN/COMMIT, rolling back on any error. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
}

export default pool;
