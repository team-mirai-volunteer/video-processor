/**
 * Processing job status enum
 */
export const ProcessingJobStatus = {
  PENDING: 'pending',
  ANALYZING: 'analyzing',
  EXTRACTING: 'extracting',
  UPLOADING: 'uploading',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type ProcessingJobStatus = (typeof ProcessingJobStatus)[keyof typeof ProcessingJobStatus];

/**
 * ProcessingJob entity representing a video processing request
 */
export interface ProcessingJob {
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

/**
 * Processing job creation input
 */
export interface CreateProcessingJobInput {
  videoId: string;
  clipInstructions: string;
}
