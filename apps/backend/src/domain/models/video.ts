import type { VideoStatus } from '@video-processor/shared';
import { type Result, err, ok } from '../types/result.js';

export type VideoError =
  | { type: 'INVALID_URL'; message: string }
  | { type: 'INVALID_FILE_ID'; message: string }
  | { type: 'INVALID_DURATION'; message: string };

export interface VideoProps {
  id: string;
  googleDriveFileId: string;
  googleDriveUrl: string;
  title: string | null;
  description: string | null;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  status: VideoStatus;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVideoParams {
  googleDriveUrl: string;
}

const GOOGLE_DRIVE_URL_PATTERN = /^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;

/**
 * Extract file ID from Google Drive URL
 */
export function extractGoogleDriveFileId(url: string): string | null {
  const match = url.match(GOOGLE_DRIVE_URL_PATTERN);
  return match?.[1] ?? null;
}

/**
 * Validate Google Drive URL format
 */
export function isValidGoogleDriveUrl(url: string): boolean {
  return GOOGLE_DRIVE_URL_PATTERN.test(url);
}

export class Video {
  readonly id: string;
  readonly googleDriveFileId: string;
  readonly googleDriveUrl: string;
  readonly title: string | null;
  readonly description: string | null;
  readonly durationSeconds: number | null;
  readonly fileSizeBytes: number | null;
  readonly status: VideoStatus;
  readonly errorMessage: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: VideoProps) {
    this.id = props.id;
    this.googleDriveFileId = props.googleDriveFileId;
    this.googleDriveUrl = props.googleDriveUrl;
    this.title = props.title;
    this.description = props.description;
    this.durationSeconds = props.durationSeconds;
    this.fileSizeBytes = props.fileSizeBytes;
    this.status = props.status;
    this.errorMessage = props.errorMessage;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Create a new Video from URL
   */
  static create(params: CreateVideoParams, generateId: () => string): Result<Video, VideoError> {
    if (!isValidGoogleDriveUrl(params.googleDriveUrl)) {
      return err({
        type: 'INVALID_URL',
        message: 'Invalid Google Drive URL format',
      });
    }

    const fileId = extractGoogleDriveFileId(params.googleDriveUrl);
    if (!fileId) {
      return err({
        type: 'INVALID_FILE_ID',
        message: 'Could not extract file ID from URL',
      });
    }

    const now = new Date();
    return ok(
      new Video({
        id: generateId(),
        googleDriveFileId: fileId,
        googleDriveUrl: params.googleDriveUrl,
        title: null,
        description: null,
        durationSeconds: null,
        fileSizeBytes: null,
        status: 'pending',
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  /**
   * Reconstruct Video from database
   */
  static fromProps(props: VideoProps): Video {
    return new Video(props);
  }

  /**
   * Update video metadata
   */
  withMetadata(metadata: {
    title?: string;
    description?: string;
    durationSeconds?: number;
    fileSizeBytes?: number;
  }): Result<Video, VideoError> {
    if (metadata.durationSeconds !== undefined && metadata.durationSeconds < 0) {
      return err({
        type: 'INVALID_DURATION',
        message: 'Duration cannot be negative',
      });
    }

    return ok(
      new Video({
        ...this.toProps(),
        title: metadata.title ?? this.title,
        description: metadata.description ?? this.description,
        durationSeconds: metadata.durationSeconds ?? this.durationSeconds,
        fileSizeBytes: metadata.fileSizeBytes ?? this.fileSizeBytes,
        updatedAt: new Date(),
      })
    );
  }

  /**
   * Update video status
   */
  withStatus(status: VideoStatus, errorMessage?: string): Video {
    return new Video({
      ...this.toProps(),
      status,
      errorMessage: errorMessage ?? this.errorMessage,
      updatedAt: new Date(),
    });
  }

  /**
   * Convert to plain object
   */
  toProps(): VideoProps {
    return {
      id: this.id,
      googleDriveFileId: this.googleDriveFileId,
      googleDriveUrl: this.googleDriveUrl,
      title: this.title,
      description: this.description,
      durationSeconds: this.durationSeconds,
      fileSizeBytes: this.fileSizeBytes,
      status: this.status,
      errorMessage: this.errorMessage,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
