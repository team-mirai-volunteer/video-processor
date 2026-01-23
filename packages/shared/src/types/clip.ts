/**
 * Clip status enum
 */
export const ClipStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type ClipStatus = (typeof ClipStatus)[keyof typeof ClipStatus];

/**
 * Clip entity representing a short video segment extracted from a source video
 */
export interface Clip {
  id: string;
  videoId: string;
  googleDriveFileId: string | null;
  googleDriveUrl: string | null;
  title: string | null;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  transcript: string | null;
  status: ClipStatus;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Clip creation input from AI analysis
 */
export interface CreateClipInput {
  videoId: string;
  title: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  transcript: string | null;
}

/**
 * Clip timestamp extracted by AI
 */
export interface ClipTimestamp {
  title: string;
  startTime: string; // HH:MM:SS format
  endTime: string; // HH:MM:SS format
  transcript: string;
  reason: string;
}

/**
 * AI response for clip extraction
 */
export interface AIClipExtractionResponse {
  clips: ClipTimestamp[];
}
