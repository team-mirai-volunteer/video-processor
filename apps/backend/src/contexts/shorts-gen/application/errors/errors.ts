import { ApplicationError } from '@shared/application/errors/errors.js';

/**
 * Validation error (400 Bad Request)
 */
export class ValidationError extends ApplicationError {
  readonly statusCode = 400;
}

/**
 * Not found error (404 Not Found)
 */
export class NotFoundError extends ApplicationError {
  readonly statusCode = 404;

  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
  }
}

/**
 * Conflict error (409 Conflict)
 */
export class ConflictError extends ApplicationError {
  readonly statusCode = 409;

  constructor(resource: string, id: string) {
    super(`${resource} already exists for ${id}`);
  }
}

/**
 * AI generation error (500 Internal Server Error)
 */
export class AiGenerationError extends ApplicationError {
  readonly statusCode = 500;

  constructor(
    message: string,
    readonly originalError?: string
  ) {
    super(message);
  }
}
