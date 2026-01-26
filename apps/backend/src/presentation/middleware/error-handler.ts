import type { NextFunction, Request, Response } from 'express';
import { ApplicationError } from '../../application/errors.js';
import { logger } from '../../infrastructure/logging/logger.js';

/**
 * Error response type
 */
interface ErrorResponseBody {
  error: string;
  stack?: string;
}

/**
 * Global error handler middleware
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  // Handle application errors (user-caused errors) as WARNING
  if (err instanceof ApplicationError) {
    logger.warn('[ErrorHandler] Application error', {
      errorName: err.name,
      message: err.message,
      statusCode: err.statusCode,
    });
    const body: ErrorResponseBody = { error: err.message };
    res.status(err.statusCode).json(body);
    return;
  }

  // Handle unexpected errors as ERROR
  logger.error('[ErrorHandler] Unexpected error', err);

  const body: ErrorResponseBody = {
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
  };

  if (process.env.NODE_ENV !== 'production') {
    body.stack = err.stack;
  }

  res.status(500).json(body);
}
