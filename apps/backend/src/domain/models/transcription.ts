import { type Result, err, ok } from '../types/result.js';

/**
 * A segment of transcription with timestamp
 */
export interface TranscriptionSegment {
  text: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  confidence: number;
}

export type TranscriptionError =
  | { type: 'INVALID_DURATION'; message: string }
  | { type: 'EMPTY_TEXT'; message: string };

export interface TranscriptionProps {
  id: string;
  videoId: string;
  fullText: string;
  segments: TranscriptionSegment[];
  languageCode: string;
  durationSeconds: number;
  createdAt: Date;
}

export interface CreateTranscriptionParams {
  videoId: string;
  fullText: string;
  segments: TranscriptionSegment[];
  languageCode: string;
  durationSeconds: number;
}

export class Transcription {
  readonly id: string;
  readonly videoId: string;
  readonly fullText: string;
  readonly segments: TranscriptionSegment[];
  readonly languageCode: string;
  readonly durationSeconds: number;
  readonly createdAt: Date;

  private constructor(props: TranscriptionProps) {
    this.id = props.id;
    this.videoId = props.videoId;
    this.fullText = props.fullText;
    this.segments = props.segments;
    this.languageCode = props.languageCode;
    this.durationSeconds = props.durationSeconds;
    this.createdAt = props.createdAt;
  }

  /**
   * Create a new Transcription
   */
  static create(
    params: CreateTranscriptionParams,
    generateId: () => string
  ): Result<Transcription, TranscriptionError> {
    if (params.durationSeconds < 0) {
      return err({
        type: 'INVALID_DURATION',
        message: 'Duration cannot be negative',
      });
    }

    if (!params.fullText || params.fullText.trim().length === 0) {
      return err({
        type: 'EMPTY_TEXT',
        message: 'Transcription text cannot be empty',
      });
    }

    return ok(
      new Transcription({
        id: generateId(),
        videoId: params.videoId,
        fullText: params.fullText,
        segments: params.segments,
        languageCode: params.languageCode,
        durationSeconds: params.durationSeconds,
        createdAt: new Date(),
      })
    );
  }

  /**
   * Reconstruct Transcription from database
   */
  static fromProps(props: TranscriptionProps): Transcription {
    return new Transcription(props);
  }

  /**
   * Convert to plain object
   */
  toProps(): TranscriptionProps {
    return {
      id: this.id,
      videoId: this.videoId,
      fullText: this.fullText,
      segments: this.segments,
      languageCode: this.languageCode,
      durationSeconds: this.durationSeconds,
      createdAt: this.createdAt,
    };
  }
}
