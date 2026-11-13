import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(serverRoot, '..');

// Load the repository-root .env first, then allow server/.env to override it.
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config({ path: path.join(serverRoot, '.env'), override: true });

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isTest = nodeEnv === 'test';
const isProduction = nodeEnv === 'production';

function toInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value, fallback = false) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const jwtSecret = process.env.JWT_SECRET ?? 'dev-only-secret-change-me';

if (isProduction && jwtSecret === 'dev-only-secret-change-me') {
  // Fail fast instead of shipping a known secret.
  throw new Error('JWT_SECRET must be set to a real secret in production.');
}

export const env = {
  nodeEnv,
  isTest,
  isProduction,
  port: toInt(process.env.PORT, 4000),
  databaseUrl:
    (isTest ? process.env.TEST_DATABASE_URL : null) ??
    process.env.DATABASE_URL ??
    'postgres://sweety:sweety@localhost:5432/sweety',
  testDatabaseUrl:
    process.env.TEST_DATABASE_URL ??
    'postgres://sweety:sweety@localhost:5432/sweety_test',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  bcryptRounds: toInt(process.env.BCRYPT_ROUNDS, isTest ? 4 : 10),
  clientOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  redisUrl: process.env.REDIS_URL ?? '',
  reportCacheTtlSeconds: toInt(process.env.REPORT_CACHE_TTL_SECONDS, 300),
  enableReminderJob: toBool(process.env.ENABLE_REMINDER_JOB, false),
  reminderCron: process.env.REMINDER_CRON ?? '0 8 * * *',
};

export default env;
