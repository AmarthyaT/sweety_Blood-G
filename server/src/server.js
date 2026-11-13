import env from './config/env.js';
import logger from './lib/logger.js';
import { createApp } from './app.js';
import { initCache, closeCache } from './lib/cache.js';
import { closePool } from './db/pool.js';

async function start() {
  const cacheReady = await initCache();
  logger.info(
    cacheReady ? 'Redis connected: report cache enabled.' : 'Redis not connected: cache disabled.',
  );

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(`Sweety API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down...`);

    const forceExit = setTimeout(() => process.exit(1), 10_000);
    forceExit.unref();

    server.close(async () => {
      await closePool().catch(() => {});
      await closeCache().catch(() => {});
      process.exit(0);
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error) => {
  logger.error('Failed to start API', error);
  process.exit(1);
});
