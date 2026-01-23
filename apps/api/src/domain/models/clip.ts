import type { Clip as SharedClip, ClipStatus } from '@video-processor/shared';

/**
 * Clip domain entity
 * Re-exports and extends shared Clip type with domain-specific methods
 */
export interface Clip extends SharedClip {}

/**
 * Clip creation parameters
 */
export interface CreateClipParams {
  videoId: string;
  title?: string | null;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  transcript?: string | null;
}

/**
 * Clip update parameters
 */
export interface UpdateClipParams {
  googleDriveFileId?: string | null;
  googleDriveUrl?: string | null;
  title?: string | null;
  transcript?: string | null;
  status?: ClipStatus;
  errorMessage?: string | null;
}

export { ClipStatus } from '@video-processor/shared';
