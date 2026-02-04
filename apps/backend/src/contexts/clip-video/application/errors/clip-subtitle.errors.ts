import { ApplicationError } from '@shared/application/errors/errors.js';

/**
 * Clip not found error (404)
 */
export class ClipNotFoundError extends ApplicationError {
  readonly statusCode = 404;

  constructor(clipId: string) {
    super(`Clip with id ${clipId} not found`);
  }
}

/**
 * Subtitle not found error (404)
 */
export class SubtitleNotFoundError extends ApplicationError {
  readonly statusCode = 404;

  constructor(clipId: string) {
    super(`Subtitle for clip ${clipId} not found`);
  }
}

/**
 * Transcription not found error (404)
 */
export class TranscriptionNotFoundError extends ApplicationError {
  readonly statusCode = 404;

  constructor(videoId: string) {
    super(`Transcription for video ${videoId} not found`);
  }
}

/**
 * Refined transcription not found error (404)
 */
export class RefinedTranscriptionNotFoundError extends ApplicationError {
  readonly statusCode = 404;

  constructor(videoId: string) {
    super(`Refined transcription for video ${videoId} not found`);
  }
}

/**
 * Subtitle already confirmed error (409)
 */
export class SubtitleAlreadyConfirmedError extends ApplicationError {
  readonly statusCode = 409;

  constructor(clipId: string) {
    super(`Subtitle for clip ${clipId} is already confirmed and cannot be modified`);
  }
}

/**
 * Subtitle validation error (400)
 */
export class SubtitleValidationError extends ApplicationError {
  readonly statusCode = 400;
}

/**
 * Subtitle generation error (500)
 */
export class SubtitleGenerationError extends ApplicationError {
  readonly statusCode = 500;

  constructor(message: string) {
    super(`Failed to generate subtitles: ${message}`);
  }
}

/**
 * Clip video URL error (404)
 */
export class ClipVideoNotFoundError extends ApplicationError {
  readonly statusCode = 404;

  constructor(clipId: string) {
    super(`Video for clip ${clipId} not found or not uploaded to Drive`);
  }
}
