/**
 * Base class for application-level errors
 * These are expected errors that should be handled gracefully
 */
export abstract class ApplicationError extends Error {
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
