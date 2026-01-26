import type { NextFunction, Request, Response } from 'express';

const WEBAPP_API_KEY = process.env.WEBAPP_API_KEY;

/**
 * API Key authentication middleware
 * Validates the X-API-Key header against the configured API_KEY environment variable
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  // Skip auth if WEBAPP_API_KEY is not configured (development mode)
  if (!WEBAPP_API_KEY) {
    next();
    return;
  }

  // Skip auth for health check endpoint
  if (req.path === '/health') {
    next();
    return;
  }

  const providedKey = req.header('X-API-Key');

  if (!providedKey) {
    res.status(401).json({ error: 'API key is required' });
    return;
  }

  if (providedKey !== WEBAPP_API_KEY) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  next();
}
