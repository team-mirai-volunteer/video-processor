import type { Clip } from './clip.js';
import type { ProcessingJob } from './processing-job.js';
import type { Video, VideoListItem } from './video.js';

// ============================================
// Request Types
// ============================================

/**
 * POST /api/videos - Create video and start processing
 */
export interface CreateVideoRequest {
  googleDriveUrl: string;
  clipInstructions: string;
}

/**
 * GET /api/videos - Query parameters
 */
export interface GetVideosQuery {
  page?: number;
  limit?: number;
  status?: string;
}

// ============================================
// Response Types
// ============================================

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * POST /api/videos - Response
 */
export interface CreateVideoResponse {
  id: string;
  googleDriveFileId: string;
  googleDriveUrl: string;
  status: string;
  processingJob: {
    id: string;
    status: string;
    clipInstructions: string;
  };
  createdAt: Date;
}

/**
 * GET /api/videos - Response
 */
export type GetVideosResponse = PaginatedResponse<VideoListItem>;

/**
 * GET /api/videos/:id - Response
 */
export interface GetVideoDetailResponse extends Video {
  clips: Clip[];
  processingJobs: ProcessingJob[];
}

/**
 * GET /api/videos/:id/clips - Response
 */
export interface GetVideoClipsResponse {
  videoId: string;
  clips: Clip[];
}

/**
 * GET /api/clips/:id - Response
 */
export type GetClipDetailResponse = Clip;

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
}

// ============================================
// Error Response Types
// ============================================

/**
 * API error response
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ============================================
// Re-exports for convenience
// ============================================

export type { Clip } from './clip.js';
export type { ProcessingJob } from './processing-job.js';
export type { Video, VideoListItem, VideoWithRelations } from './video.js';
