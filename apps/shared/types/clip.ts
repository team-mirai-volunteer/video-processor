/**
 * Clip status enum
 */
export type ClipStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Clip entity type
 * Represents a short video clip extracted from the original video
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
 * Clip summary for list views
 */
export interface ClipSummary {
  id: string;
  title: string | null;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  googleDriveUrl: string | null;
  transcript: string | null;
  status: ClipStatus;
}

/**
 * Clip data extracted by AI
 */
export interface ClipExtractionData {
  title: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  transcript: string;
  reason: string;
}

/**
 * AI response format for clip extraction
 */
export interface ClipExtractionResponse {
  clips: ClipExtractionData[];
}
