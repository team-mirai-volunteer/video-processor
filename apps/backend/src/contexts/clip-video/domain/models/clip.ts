import { type Result, err, ok } from '@shared/domain/types/result.js';
import type { ClipStatus } from '@video-processor/shared';

export type ClipError =
  | { type: 'INVALID_TIME_RANGE'; message: string }
  | { type: 'DURATION_OUT_OF_RANGE'; message: string };

export interface ClipProps {
  id: string;
  videoId: string;
  googleDriveFileId: string | null;
  googleDriveUrl: string | null;
  title: string | null;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  transcript: string | null;
  status: ClipStatus;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  // 字幕付き動画関連
  subtitledVideoGcsUri: string | null;
  subtitledVideoUrl: string | null;
  subtitledVideoDriveId: string | null;
  subtitledVideoDriveUrl: string | null;
  // 動画プレイヤー用キャッシュ
  clipVideoGcsUri: string | null;
  clipVideoGcsExpiresAt: Date | null;
}

export interface CreateClipParams {
  videoId: string;
  title: string | null;
  startTimeSeconds: number;
  endTimeSeconds: number;
  transcript: string | null;
}

const MIN_CLIP_DURATION_SECONDS = 20;
const MAX_CLIP_DURATION_SECONDS = 60;

export class Clip {
  readonly id: string;
  readonly videoId: string;
  readonly googleDriveFileId: string | null;
  readonly googleDriveUrl: string | null;
  readonly title: string | null;
  readonly startTimeSeconds: number;
  readonly endTimeSeconds: number;
  readonly durationSeconds: number;
  readonly transcript: string | null;
  readonly status: ClipStatus;
  readonly errorMessage: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  // 字幕付き動画関連
  readonly subtitledVideoGcsUri: string | null;
  readonly subtitledVideoUrl: string | null;
  readonly subtitledVideoDriveId: string | null;
  readonly subtitledVideoDriveUrl: string | null;
  // 動画プレイヤー用キャッシュ
  readonly clipVideoGcsUri: string | null;
  readonly clipVideoGcsExpiresAt: Date | null;

  private constructor(props: ClipProps) {
    this.id = props.id;
    this.videoId = props.videoId;
    this.googleDriveFileId = props.googleDriveFileId;
    this.googleDriveUrl = props.googleDriveUrl;
    this.title = props.title;
    this.startTimeSeconds = props.startTimeSeconds;
    this.endTimeSeconds = props.endTimeSeconds;
    this.durationSeconds = props.durationSeconds;
    this.transcript = props.transcript;
    this.status = props.status;
    this.errorMessage = props.errorMessage;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.subtitledVideoGcsUri = props.subtitledVideoGcsUri;
    this.subtitledVideoUrl = props.subtitledVideoUrl;
    this.subtitledVideoDriveId = props.subtitledVideoDriveId;
    this.subtitledVideoDriveUrl = props.subtitledVideoDriveUrl;
    this.clipVideoGcsUri = props.clipVideoGcsUri;
    this.clipVideoGcsExpiresAt = props.clipVideoGcsExpiresAt;
  }

  /**
   * Create a new Clip
   */
  static create(params: CreateClipParams, generateId: () => string): Result<Clip, ClipError> {
    if (params.startTimeSeconds >= params.endTimeSeconds) {
      return err({
        type: 'INVALID_TIME_RANGE',
        message: 'Start time must be before end time',
      });
    }

    const durationSeconds = params.endTimeSeconds - params.startTimeSeconds;

    if (
      durationSeconds < MIN_CLIP_DURATION_SECONDS ||
      durationSeconds > MAX_CLIP_DURATION_SECONDS
    ) {
      return err({
        type: 'DURATION_OUT_OF_RANGE',
        message: `Clip duration must be between ${MIN_CLIP_DURATION_SECONDS} and ${MAX_CLIP_DURATION_SECONDS} seconds`,
      });
    }

    const now = new Date();
    return ok(
      new Clip({
        id: generateId(),
        videoId: params.videoId,
        googleDriveFileId: null,
        googleDriveUrl: null,
        title: params.title,
        startTimeSeconds: params.startTimeSeconds,
        endTimeSeconds: params.endTimeSeconds,
        durationSeconds,
        transcript: params.transcript,
        status: 'pending',
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
        subtitledVideoGcsUri: null,
        subtitledVideoUrl: null,
        subtitledVideoDriveId: null,
        subtitledVideoDriveUrl: null,
        clipVideoGcsUri: null,
        clipVideoGcsExpiresAt: null,
      })
    );
  }

  /**
   * Create a clip with flexible duration (for AI-generated clips)
   */
  static createWithFlexibleDuration(
    params: CreateClipParams,
    generateId: () => string
  ): Result<Clip, ClipError> {
    if (params.startTimeSeconds >= params.endTimeSeconds) {
      return err({
        type: 'INVALID_TIME_RANGE',
        message: 'Start time must be before end time',
      });
    }

    const durationSeconds = params.endTimeSeconds - params.startTimeSeconds;
    const now = new Date();

    return ok(
      new Clip({
        id: generateId(),
        videoId: params.videoId,
        googleDriveFileId: null,
        googleDriveUrl: null,
        title: params.title,
        startTimeSeconds: params.startTimeSeconds,
        endTimeSeconds: params.endTimeSeconds,
        durationSeconds,
        transcript: params.transcript,
        status: 'pending',
        errorMessage: null,
        createdAt: now,
        updatedAt: now,
        subtitledVideoGcsUri: null,
        subtitledVideoUrl: null,
        subtitledVideoDriveId: null,
        subtitledVideoDriveUrl: null,
        clipVideoGcsUri: null,
        clipVideoGcsExpiresAt: null,
      })
    );
  }

  /**
   * Reconstruct Clip from database
   */
  static fromProps(props: ClipProps): Clip {
    return new Clip(props);
  }

  /**
   * Update clip with Google Drive info
   */
  withGoogleDriveInfo(fileId: string, url: string): Clip {
    return new Clip({
      ...this.toProps(),
      googleDriveFileId: fileId,
      googleDriveUrl: url,
      updatedAt: new Date(),
    });
  }

  /**
   * Update clip status
   */
  withStatus(status: ClipStatus, errorMessage?: string): Clip {
    return new Clip({
      ...this.toProps(),
      status,
      errorMessage: errorMessage ?? this.errorMessage,
      updatedAt: new Date(),
    });
  }

  /**
   * Update clip with GCS cache info for video playback
   */
  withGcsCache(gcsUri: string, expiresAt: Date): Clip {
    return new Clip({
      ...this.toProps(),
      clipVideoGcsUri: gcsUri,
      clipVideoGcsExpiresAt: expiresAt,
      updatedAt: new Date(),
    });
  }

  /**
   * Convert to plain object
   */
  toProps(): ClipProps {
    return {
      id: this.id,
      videoId: this.videoId,
      googleDriveFileId: this.googleDriveFileId,
      googleDriveUrl: this.googleDriveUrl,
      title: this.title,
      startTimeSeconds: this.startTimeSeconds,
      endTimeSeconds: this.endTimeSeconds,
      durationSeconds: this.durationSeconds,
      transcript: this.transcript,
      status: this.status,
      errorMessage: this.errorMessage,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      subtitledVideoGcsUri: this.subtitledVideoGcsUri,
      subtitledVideoUrl: this.subtitledVideoUrl,
      subtitledVideoDriveId: this.subtitledVideoDriveId,
      subtitledVideoDriveUrl: this.subtitledVideoDriveUrl,
      clipVideoGcsUri: this.clipVideoGcsUri,
      clipVideoGcsExpiresAt: this.clipVideoGcsExpiresAt,
    };
  }
}
