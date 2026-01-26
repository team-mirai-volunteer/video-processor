import type { NextFunction, Request, Response } from 'express';
import { logger } from '../../infrastructure/logging/logger.js';

/**
 * Request logging middleware
 * Logs HTTP requests with appropriate severity based on status code
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const latency = Date.now() - start;
    const logData = {
      httpRequest: {
        requestMethod: req.method,
        requestUrl: req.originalUrl,
        status: res.statusCode,
        userAgent: req.get('user-agent'),
        latency: `${latency}ms`,
      },
    };

    const message = `[RequestLogger] ${req.method} ${req.path}`;

    // 5xx は ERROR、4xx は WARNING、それ以外は INFO
    if (res.statusCode >= 500) {
      logger.error(message, undefined, logData);
    } else if (res.statusCode >= 400) {
      logger.warn(message, logData);
    } else {
      logger.info(message, logData);
    }
  });

  next();
}
