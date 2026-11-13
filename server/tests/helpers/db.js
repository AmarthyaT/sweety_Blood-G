import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, closePool } from '../../src/db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, '../../src/db/schema.sql');

export async function setupDatabase() {
  const schema = await fs.readFile(schemaPath, 'utf8');
  await pool.query(schema);
}

export async function resetDatabase() {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
}

export async function teardownDatabase() {
  await closePool();
}
