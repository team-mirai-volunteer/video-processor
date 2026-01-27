import { type Result, err, ok } from '@shared/domain/types/result.js';
import type { ProcessingJobStatus } from '@video-processor/shared';

export type ProcessingJobError =
  | { type: 'EMPTY_INSTRUCTIONS'; message: string }
  | { type: 'INVALID_STATUS_TRANSITION'; message: string };

export interface ProcessingJobProps {
  id: string;
  videoId: string;
  clipInstructions: string;
  status: ProcessingJobStatus;
  aiResponse: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProcessingJobParams {
  videoId: string;
  clipInstructions: string;
}

const VALID_STATUS_TRANSITIONS: Record<ProcessingJobStatus, ProcessingJobStatus[]> = {
  pending: ['analyzing', 'failed'],
  analyzing: ['extracting', 'failed'],
  extracting: ['uploading', 'failed'],
  uploading: ['completed', 'failed'],
  completed: [],
  failed: ['pending'], // Allow retry
};

export class ProcessingJob {
  readonly id: string;
  readonly videoId: string;
  readonly clipInstructions: string;
  readonly status: ProcessingJobStatus;
  readonly aiResponse: string | null;
  readonly errorMessage: string | null;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ProcessingJobProps) {
    this.id = props.id;
    this.videoId = props.videoId;
    this.clipInstructions = props.clipInstructions;
    this.status = props.status;
    this.aiResponse = props.aiResponse;
    this.errorMessage = props.errorMessage;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Create a new ProcessingJob
   */
  static create(
    params: CreateProcessingJobParams,
    generateId: () => string
  ): Result<ProcessingJob, ProcessingJobError> {
    if (!params.clipInstructions.trim()) {
      return err({
        type: 'EMPTY_INSTRUCTIONS',
        message: 'Clip instructions cannot be empty',
      });
    }

    const now = new Date();
    return ok(
      new ProcessingJob({
        id: generateId(),
        videoId: params.videoId,
        clipInstructions: params.clipInstructions,
        status: 'pending',
        aiResponse: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  /**
   * Reconstruct ProcessingJob from database
   */
  static fromProps(props: ProcessingJobProps): ProcessingJob {
    return new ProcessingJob(props);
  }

  /**
   * Check if status transition is valid
   */
  private canTransitionTo(newStatus: ProcessingJobStatus): boolean {
    return VALID_STATUS_TRANSITIONS[this.status].includes(newStatus);
  }

  /**
   * Update job status
   */
  withStatus(
    newStatus: ProcessingJobStatus,
    errorMessage?: string
  ): Result<ProcessingJob, ProcessingJobError> {
    if (!this.canTransitionTo(newStatus)) {
      return err({
        type: 'INVALID_STATUS_TRANSITION',
        message: `Cannot transition from ${this.status} to ${newStatus}`,
      });
    }

    const now = new Date();
    let startedAt = this.startedAt;
    let completedAt = this.completedAt;

    // Set startedAt when moving from pending
    if (this.status === 'pending' && newStatus !== 'pending') {
      startedAt = now;
    }

    // Set completedAt when reaching terminal state
    if (newStatus === 'completed' || newStatus === 'failed') {
      completedAt = now;
    }

    return ok(
      new ProcessingJob({
        ...this.toProps(),
        status: newStatus,
        errorMessage: errorMessage ?? this.errorMessage,
        startedAt,
        completedAt,
        updatedAt: now,
      })
    );
  }

  /**
   * Set AI response
   */
  withAiResponse(aiResponse: string): ProcessingJob {
    return new ProcessingJob({
      ...this.toProps(),
      aiResponse,
      updatedAt: new Date(),
    });
  }

  /**
   * Convert to plain object
   */
  toProps(): ProcessingJobProps {
    return {
      id: this.id,
      videoId: this.videoId,
      clipInstructions: this.clipInstructions,
      status: this.status,
      aiResponse: this.aiResponse,
      errorMessage: this.errorMessage,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
