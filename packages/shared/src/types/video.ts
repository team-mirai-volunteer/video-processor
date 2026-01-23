/**
 * Video status enum
 */
export const VideoStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type VideoStatus = (typeof VideoStatus)[keyof typeof VideoStatus];

/**
 * Video entity representing a source video from Google Drive
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
 * Video creation input
 */
export interface CreateVideoInput {
  googleDriveUrl: string;
  clipInstructions: string;
}

/**
 * Video with related entities
 */
export interface VideoWithRelations extends Video {
  clips: import('./clip.js').Clip[];
  processingJobs: import('./processing-job.js').ProcessingJob[];
}

/**
 * Video list item (summary)
 */
export interface VideoListItem {
  id: string;
  googleDriveUrl: string;
  title: string | null;
  status: VideoStatus;
  clipCount: number;
  createdAt: Date;
}
