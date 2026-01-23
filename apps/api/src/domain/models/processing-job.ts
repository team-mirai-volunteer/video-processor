import type { ProcessingJob as SharedProcessingJob, ProcessingJobStatus } from '@video-processor/shared';

/**
 * ProcessingJob domain entity
 * Re-exports and extends shared ProcessingJob type with domain-specific methods
 */
export interface ProcessingJob extends SharedProcessingJob {}

/**
 * ProcessingJob creation parameters
 */
export interface CreateProcessingJobParams {
  videoId: string;
  clipInstructions: string;
}

/**
 * ProcessingJob update parameters
 */
export interface UpdateProcessingJobParams {
  status?: ProcessingJobStatus;
  aiResponse?: string | null;
  errorMessage?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export { ProcessingJobStatus } from '@video-processor/shared';
