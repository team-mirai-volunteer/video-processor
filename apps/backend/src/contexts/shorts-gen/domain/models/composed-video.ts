import { type Result, err, ok } from '@shared/domain/types/result.js';

/**
 * Status for composed video processing
 */
export type ComposedVideoStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type ShortsComposedVideoError =
  | { type: 'INVALID_PROJECT_ID'; message: string }
  | { type: 'INVALID_SCRIPT_ID'; message: string }
  | { type: 'INVALID_STATUS'; message: string }
  | { type: 'INVALID_FILE_URL'; message: string }
  | { type: 'INVALID_DURATION'; message: string }
  | { type: 'INVALID_STATE_TRANSITION'; message: string };

export interface ShortsComposedVideoProps {
  id: string;
  projectId: string;
  scriptId: string;
  fileUrl: string | null;
  durationSeconds: number | null;
  status: ComposedVideoStatus;
  errorMessage: string | null;
  bgmKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateShortsComposedVideoParams {
  projectId: string;
  scriptId: string;
  bgmKey?: string | null;
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Valid state transitions
const VALID_TRANSITIONS: Record<ComposedVideoStatus, ComposedVideoStatus[]> = {
  pending: ['processing', 'failed'],
  processing: ['completed', 'failed'],
  completed: ['pending', 'processing'], // Allow re-generation
  failed: ['pending', 'processing'], // Allow retry directly
};

export class ShortsComposedVideo {
  readonly id: string;
  readonly projectId: string;
  readonly scriptId: string;
  readonly fileUrl: string | null;
  readonly durationSeconds: number | null;
  readonly status: ComposedVideoStatus;
  readonly errorMessage: string | null;
  readonly bgmKey: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ShortsComposedVideoProps) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.scriptId = props.scriptId;
    this.fileUrl = props.fileUrl;
    this.durationSeconds = props.durationSeconds;
    this.status = props.status;
    this.errorMessage = props.errorMessage;
    this.bgmKey = props.bgmKey;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Create a new ShortsComposedVideo
   */
  static create(
    params: CreateShortsComposedVideoParams,
    generateId: () => string
  ): Result<ShortsComposedVideo, ShortsComposedVideoError> {
    if (!params.projectId || params.projectId.trim().length === 0) {
      return err({
        type: 'INVALID_PROJECT_ID',
        message: 'Project ID cannot be empty',
      });
    }

    if (!params.scriptId || params.scriptId.trim().length === 0) {
      return err({
        type: 'INVALID_SCRIPT_ID',
        message: 'Script ID cannot be empty',
      });
    }

    const now = new Date();
    return ok(
      new ShortsComposedVideo({
        id: generateId(),
        projectId: params.projectId.trim(),
        scriptId: params.scriptId.trim(),
        fileUrl: null,
        durationSeconds: null,
        status: 'pending',
        errorMessage: null,
        bgmKey: params.bgmKey ?? null,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  /**
   * Reconstruct ShortsComposedVideo from database
   */
  static fromProps(props: ShortsComposedVideoProps): ShortsComposedVideo {
    return new ShortsComposedVideo(props);
  }

  /**
   * Start processing
   */
  startProcessing(): Result<ShortsComposedVideo, ShortsComposedVideoError> {
    if (!VALID_TRANSITIONS[this.status].includes('processing')) {
      return err({
        type: 'INVALID_STATE_TRANSITION',
        message: `Cannot transition from ${this.status} to processing`,
      });
    }

    return ok(
      new ShortsComposedVideo({
        ...this.toProps(),
        status: 'processing',
        errorMessage: null,
        updatedAt: new Date(),
      })
    );
  }

  /**
   * Complete processing with result
   */
  complete(
    fileUrl: string,
    durationSeconds: number
  ): Result<ShortsComposedVideo, ShortsComposedVideoError> {
    if (!VALID_TRANSITIONS[this.status].includes('completed')) {
      return err({
        type: 'INVALID_STATE_TRANSITION',
        message: `Cannot transition from ${this.status} to completed`,
      });
    }

    if (!isValidUrl(fileUrl)) {
      return err({
        type: 'INVALID_FILE_URL',
        message: 'File URL must be a valid URL',
      });
    }

    if (durationSeconds <= 0) {
      return err({
        type: 'INVALID_DURATION',
        message: 'Duration must be a positive number',
      });
    }

    return ok(
      new ShortsComposedVideo({
        ...this.toProps(),
        status: 'completed',
        fileUrl,
        durationSeconds,
        errorMessage: null,
        updatedAt: new Date(),
      })
    );
  }

  /**
   * Mark as failed with error message
   */
  fail(errorMessage: string): Result<ShortsComposedVideo, ShortsComposedVideoError> {
    if (!VALID_TRANSITIONS[this.status].includes('failed')) {
      return err({
        type: 'INVALID_STATE_TRANSITION',
        message: `Cannot transition from ${this.status} to failed`,
      });
    }

    return ok(
      new ShortsComposedVideo({
        ...this.toProps(),
        status: 'failed',
        errorMessage,
        updatedAt: new Date(),
      })
    );
  }

  /**
   * Reset to pending for retry/regeneration
   */
  reset(): Result<ShortsComposedVideo, ShortsComposedVideoError> {
    if (!VALID_TRANSITIONS[this.status].includes('pending')) {
      return err({
        type: 'INVALID_STATE_TRANSITION',
        message: `Cannot transition from ${this.status} to pending`,
      });
    }

    return ok(
      new ShortsComposedVideo({
        ...this.toProps(),
        status: 'pending',
        fileUrl: null,
        durationSeconds: null,
        errorMessage: null,
        updatedAt: new Date(),
      })
    );
  }

  /**
   * Update BGM key
   */
  withBgmKey(bgmKey: string | null): ShortsComposedVideo {
    return new ShortsComposedVideo({
      ...this.toProps(),
      bgmKey,
      updatedAt: new Date(),
    });
  }

  /**
   * Check if video is ready for playback
   */
  isReady(): boolean {
    return this.status === 'completed' && this.fileUrl !== null;
  }

  /**
   * Check if video is currently processing
   */
  isProcessing(): boolean {
    return this.status === 'processing';
  }

  /**
   * Convert to plain object
   */
  toProps(): ShortsComposedVideoProps {
    return {
      id: this.id,
      projectId: this.projectId,
      scriptId: this.scriptId,
      fileUrl: this.fileUrl,
      durationSeconds: this.durationSeconds,
      status: this.status,
      errorMessage: this.errorMessage,
      bgmKey: this.bgmKey,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
