import type { Video as SharedVideo, VideoStatus } from '@video-processor/shared';

/**
 * Video domain entity
 * Re-exports and extends shared Video type with domain-specific methods
 */
export interface Video extends SharedVideo {}

/**
 * Video creation parameters
 */
export interface CreateVideoParams {
  googleDriveFileId: string;
  googleDriveUrl: string;
  title?: string | null;
  description?: string | null;
  durationSeconds?: number | null;
  fileSizeBytes?: bigint | null;
}

/**
 * Video update parameters
 */
export interface UpdateVideoParams {
  title?: string | null;
  description?: string | null;
  durationSeconds?: number | null;
  fileSizeBytes?: bigint | null;
  status?: VideoStatus;
  errorMessage?: string | null;
}

/**
 * Video filter options for queries
 */
export interface VideoFilterOptions {
  status?: VideoStatus;
  page?: number;
  limit?: number;
}

export { VideoStatus } from '@video-processor/shared';
