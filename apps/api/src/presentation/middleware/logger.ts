import type { Request, Response, NextFunction } from 'express';

/**
 * Logger middleware
 * Logs incoming requests with method, path, and timing information
 */
export function loggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, path, ip } = req;

  // Log request
  console.log(`[${new Date().toISOString()}] --> ${method} ${path} from ${ip}`);

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    console.log(`[${new Date().toISOString()}] <-- ${method} ${path} ${statusCode} ${duration}ms`);
  });

  next();
}
