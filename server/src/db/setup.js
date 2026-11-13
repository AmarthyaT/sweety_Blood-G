/**
 * Creates the application and test databases when they are missing, then
 * applies schema.sql to both. Run with `npm run db:setup`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import env from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, 'schema.sql');

const APP_DATABASE = readDatabaseName(env.databaseUrl);
const TEST_DATABASE = readDatabaseName(env.testDatabaseUrl);

function readDatabaseName(connectionString) {
  const url = new URL(connectionString);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(`Unsupported database name: "${name}"`);
  }
  return name;
}

function maintenanceUrl(connectionString) {
  const url = new URL(connectionString);
  url.pathname = '/postgres';
  return url.toString();
}

async function ensureDatabase(connectionString) {
  const databaseName = readDatabaseName(connectionString);
  const admin = new pg.Client({ connectionString: maintenanceUrl(connectionString) });
  await admin.connect();

  try {
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      databaseName,
    ]);

    if (existing.rowCount === 0) {
      // Identifiers cannot be parameterised; the name was whitelisted above.
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      console.log(`Created database "${databaseName}".`);
    } else {
      console.log(`Database "${databaseName}" already exists.`);
    }
  } finally {
    await admin.end();
  }
}

async function applySchema(connectionString) {
  const schema = await fs.readFile(schemaPath, 'utf8');
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query(schema);
    console.log(`Applied schema to "${readDatabaseName(connectionString)}".`);
  } finally {
    await client.end();
  }
}

async function main() {
  const targets = [env.databaseUrl];

  // Tests are not run inside the production image, and the test database is
  // not reachable there, so only provision it outside production.
  if (!env.isProduction) {
    targets.push(env.testDatabaseUrl);
  }

  for (const connectionString of targets) {
    await ensureDatabase(connectionString);
    await applySchema(connectionString);
  }
  console.log('\nDatabase setup complete.');
}

main().catch((error) => {
  console.error('Database setup failed:', error.message);
  process.exitCode = 1;
});
