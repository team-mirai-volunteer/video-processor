/**
 * Processing job status enum
 */
export type ProcessingJobStatus =
  | 'pending'
  | 'analyzing'
  | 'extracting'
  | 'uploading'
  | 'completed'
  | 'failed';

/**
 * ProcessingJob entity type
 * Represents a processing job (request unit)
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
 * ProcessingJob summary for nested views
 */
export interface ProcessingJobSummary {
  id: string;
  status: ProcessingJobStatus;
  clipInstructions: string;
  completedAt: Date | null;
}
