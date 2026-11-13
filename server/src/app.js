import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import env from './config/env.js';
import { query } from './db/pool.js';
import { cacheStatus } from './lib/cache.js';
import ApiError from './lib/ApiError.js';
import asyncHandler from './utils/asyncHandler.js';
import { errorHandler, notFound } from './middleware/errors.js';
import authRoutes from './modules/auth/auth.routes.js';
import readingsRoutes from './modules/readings/readings.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import doctorRoutes from './modules/doctor/doctor.routes.js';

/**
 * Build the Express application. Exported separately from server.js so API
 * tests can import it without opening a port.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header = curl/Postman/server-to-server: allow it.
        if (!origin || env.clientOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(ApiError.forbidden(`Origin ${origin} is not allowed.`, 'cors_origin'));
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.get(
    '/api/health',
    asyncHandler(async (_req, res) => {
      let db = 'down';
      try {
        await query('SELECT 1');
        db = 'up';
      } catch {
        db = 'down';
      }

      const cache = await cacheStatus();
      const healthy = db === 'up';

      res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'degraded',
        db,
        cache,
        uptimeSeconds: Math.round(process.uptime()),
      });
    }),
  );

  app.use('/api/auth', authRoutes);
  app.use('/api/readings', readingsRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/doctor', doctorRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
