/**
 * Video status enum
 */
export type VideoStatus =
  | 'pending'
  | 'transcribing'
  | 'transcribed'
  | 'extracting'
  | 'processing'
  | 'completed'
  | 'failed';

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
  transcription: Transcription | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Transcription segment with timestamp
 */
export interface TranscriptionSegment {
  text: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  confidence: number;
}

/**
 * Transcription entity
 */
export interface Transcription {
  id: string;
  videoId: string;
  fullText: string;
  segments: TranscriptionSegment[];
  languageCode: string;
  durationSeconds: number;
  createdAt: Date;
}
