import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // The integration suites share one PostgreSQL database, so run files
    // one at a time and reset tables between tests.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      REDIS_URL: '',
    },
  },
});
