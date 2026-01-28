import { type Result, err, ok } from '@shared/domain/types/result.js';

/**
 * A sentence segment with timestamp (merged from word-level segments)
 */
export interface RefinedSentence {
  text: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  originalSegmentIndices: number[];
}

export type RefinedTranscriptionError =
  | { type: 'EMPTY_SENTENCES'; message: string }
  | { type: 'EMPTY_TEXT'; message: string }
  | { type: 'INVALID_DICTIONARY_VERSION'; message: string };

export interface RefinedTranscriptionProps {
  id: string;
  transcriptionId: string;
  fullText: string;
  sentences: RefinedSentence[];
  dictionaryVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRefinedTranscriptionParams {
  transcriptionId: string;
  fullText: string;
  sentences: RefinedSentence[];
  dictionaryVersion: string;
}

export class RefinedTranscription {
  readonly id: string;
  readonly transcriptionId: string;
  readonly fullText: string;
  readonly sentences: RefinedSentence[];
  readonly dictionaryVersion: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: RefinedTranscriptionProps) {
    this.id = props.id;
    this.transcriptionId = props.transcriptionId;
    this.fullText = props.fullText;
    this.sentences = props.sentences;
    this.dictionaryVersion = props.dictionaryVersion;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Create a new RefinedTranscription
   */
  static create(
    params: CreateRefinedTranscriptionParams,
    generateId: () => string
  ): Result<RefinedTranscription, RefinedTranscriptionError> {
    if (!params.fullText || params.fullText.trim().length === 0) {
      return err({
        type: 'EMPTY_TEXT',
        message: 'Refined transcription text cannot be empty',
      });
    }

    if (!params.sentences || params.sentences.length === 0) {
      return err({
        type: 'EMPTY_SENTENCES',
        message: 'Refined transcription must have at least one sentence',
      });
    }

    if (!params.dictionaryVersion || params.dictionaryVersion.trim().length === 0) {
      return err({
        type: 'INVALID_DICTIONARY_VERSION',
        message: 'Dictionary version cannot be empty',
      });
    }

    const now = new Date();
    return ok(
      new RefinedTranscription({
        id: generateId(),
        transcriptionId: params.transcriptionId,
        fullText: params.fullText,
        sentences: params.sentences,
        dictionaryVersion: params.dictionaryVersion,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  /**
   * Reconstruct RefinedTranscription from database
   */
  static fromProps(props: RefinedTranscriptionProps): RefinedTranscription {
    return new RefinedTranscription(props);
  }

  /**
   * Convert to plain object
   */
  toProps(): RefinedTranscriptionProps {
    return {
      id: this.id,
      transcriptionId: this.transcriptionId,
      fullText: this.fullText,
      sentences: this.sentences,
      dictionaryVersion: this.dictionaryVersion,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
