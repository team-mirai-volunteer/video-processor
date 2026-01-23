import { Router, type Router as RouterType } from 'express';
import type { HealthCheckResponse } from '@video-processor/shared';
import { checkDatabaseConnection } from '../../infrastructure/database/connection.js';

const router: RouterType = Router();

/**
 * GET /health
 * Health check endpoint
 */
router.get('/', async (_req, res) => {
  const dbHealthy = await checkDatabaseConnection();

  const response: HealthCheckResponse = {
    status: dbHealthy ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
  };

  res.status(dbHealthy ? 200 : 503).json(response);
});

export default router;
