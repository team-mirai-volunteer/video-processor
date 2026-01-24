import type { NextFunction, Request, Response } from 'express';
import { ApplicationError } from '../../application/errors.js';

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
  // Log error
  console.error('[Error]', {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });

  // Handle application errors
  if (err instanceof ApplicationError) {
    const body: ErrorResponseBody = { error: err.message };
    res.status(err.statusCode).json(body);
    return;
  }

  // Handle unexpected errors
  const body: ErrorResponseBody = {
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
  };

  if (process.env.NODE_ENV !== 'production') {
    body.stack = err.stack;
  }

  res.status(500).json(body);
}
