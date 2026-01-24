/**
 * Video status enum
 */
export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Video entity type
 * Represents the original video to be processed
 */
export interface Video {
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

/**
 * Video summary for list views
 */
export interface VideoSummary {
  id: string;
  googleDriveUrl: string;
  title: string | null;
  status: VideoStatus;
  clipCount: number;
  createdAt: Date;
}

/**
 * Video with related clips and processing jobs
 */
export interface VideoWithRelations {
  id: string;
  googleDriveFileId: string;
  googleDriveUrl: string;
  title: string | null;
  description: string | null;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  status: VideoStatus;
  errorMessage: string | null;
  clips: import('./clip.js').Clip[];
  processingJobs: import('./processing-job.js').ProcessingJobSummary[];
  createdAt: Date;
  updatedAt: Date;
}
