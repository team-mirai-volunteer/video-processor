import { type Result, err, ok } from '@shared/domain/types/result.js';
import type { TranscriptionPhase, VideoStatus } from '@video-processor/shared';

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
  transcriptionPhase: TranscriptionPhase | null;
  errorMessage: string | null;
  progressMessage: string | null;
  gcsUri: string | null;
  gcsExpiresAt: Date | null;
  audioGcsUri: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVideoParams {
  googleDriveUrl: string;
}

const GOOGLE_DRIVE_URL_PATTERN = /^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;

function extractGoogleDriveFileId(url: string): string | null {
  const match = url.match(GOOGLE_DRIVE_URL_PATTERN);
  return match?.[1] ?? null;
}

function isValidGoogleDriveUrl(url: string): boolean {
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
  readonly transcriptionPhase: TranscriptionPhase | null;
  readonly errorMessage: string | null;
  readonly progressMessage: string | null;
  readonly gcsUri: string | null;
  readonly gcsExpiresAt: Date | null;
  readonly audioGcsUri: string | null;
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
    this.transcriptionPhase = props.transcriptionPhase;
    this.errorMessage = props.errorMessage;
    this.progressMessage = props.progressMessage;
    this.gcsUri = props.gcsUri;
    this.gcsExpiresAt = props.gcsExpiresAt;
    this.audioGcsUri = props.audioGcsUri;
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
        transcriptionPhase: null,
        errorMessage: null,
        progressMessage: null,
        gcsUri: null,
        gcsExpiresAt: null,
        audioGcsUri: null,
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
      // Clear transcriptionPhase when status changes away from transcribing
      transcriptionPhase: status === 'transcribing' ? this.transcriptionPhase : null,
      errorMessage: errorMessage ?? this.errorMessage,
      updatedAt: new Date(),
    });
  }

  /**
   * Update transcription phase (detailed progress during transcribing)
   */
  withTranscriptionPhase(phase: TranscriptionPhase): Video {
    return new Video({
      ...this.toProps(),
      transcriptionPhase: phase,
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
      transcriptionPhase: this.transcriptionPhase,
      errorMessage: this.errorMessage,
      progressMessage: this.progressMessage,
      gcsUri: this.gcsUri,
      gcsExpiresAt: this.gcsExpiresAt,
      audioGcsUri: this.audioGcsUri,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Update progress message for displaying current processing status
   */
  withProgressMessage(message: string | null): Video {
    return new Video({
      ...this.toProps(),
      progressMessage: message,
      updatedAt: new Date(),
    });
  }

  /**
   * Update video with GCS info
   */
  withGcsInfo(gcsUri: string, gcsExpiresAt: Date): Video {
    return new Video({
      ...this.toProps(),
      gcsUri,
      gcsExpiresAt,
      updatedAt: new Date(),
    });
  }

  /**
   * Reset video to pending state, clearing all processing data
   */
  reset(): Video {
    return new Video({
      ...this.toProps(),
      status: 'pending',
      transcriptionPhase: null,
      errorMessage: null,
      progressMessage: null,
      gcsUri: null,
      gcsExpiresAt: null,
      audioGcsUri: null,
      updatedAt: new Date(),
    });
  }

  /**
   * Update video with audio GCS URI (from ExtractAudioUseCase)
   */
  withAudioGcsUri(audioGcsUri: string): Video {
    return new Video({
      ...this.toProps(),
      audioGcsUri,
      updatedAt: new Date(),
    });
  }
}
