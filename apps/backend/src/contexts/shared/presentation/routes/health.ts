import type { HealthResponse } from '@video-processor/shared';
import { type Router as ExpressRouter, Router } from 'express';

const router: ExpressRouter = Router();

/**
 * GET /health
 * Health check endpoint
 */
router.get('/', (_req, res) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

export default router;
