import type { Request, Response, NextFunction } from 'express';
import type { ApiErrorResponse } from '@video-processor/shared';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, details?: Record<string, unknown>): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static notFound(message: string): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, 'CONFLICT', message);
  }

  static internal(message: string): ApiError {
    return new ApiError(500, 'INTERNAL_ERROR', message);
  }
}

/**
 * Error handler middleware
 * Catches and formats all errors into a consistent API response
 */
export function errorHandlerMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err);

  if (err instanceof ApiError) {
    const response: ApiErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Handle validation errors (from zod)
  if (err.name === 'ZodError') {
    const response: ApiErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: { errors: (err as unknown as { errors: unknown[] }).errors },
      },
    };
    res.status(400).json(response);
    return;
  }

  // Handle known error messages
  if (err.message === 'Video not found' || err.message === 'Clip not found') {
    const response: ApiErrorResponse = {
      error: {
        code: 'NOT_FOUND',
        message: err.message,
      },
    };
    res.status(404).json(response);
    return;
  }

  if (err.message === 'Invalid Google Drive URL') {
    const response: ApiErrorResponse = {
      error: {
        code: 'BAD_REQUEST',
        message: err.message,
      },
    };
    res.status(400).json(response);
    return;
  }

  // Default error response
  const response: ApiErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
    },
  };
  res.status(500).json(response);
}
