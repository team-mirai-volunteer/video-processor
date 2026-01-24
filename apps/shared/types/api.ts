import type { ClipSummary } from './clip.js';
import type { VideoStatus, VideoSummary, VideoWithRelations } from './video.js';

// ============================================================================
// Common Types
// ============================================================================

/**
 * Pagination metadata
 */
export interface Pagination {
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
  pagination: Pagination;
}

/**
 * Error response
 */
export interface ErrorResponse {
  error: string;
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * GET /health response
 */
export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

// ============================================================================
// Videos API
// ============================================================================

/**
 * POST /api/videos request body
 */
export interface SubmitVideoRequest {
  googleDriveUrl: string;
  clipInstructions: string;
}

/**
 * POST /api/videos response
 */
export interface SubmitVideoResponse {
  id: string;
  googleDriveFileId: string;
  googleDriveUrl: string;
  status: VideoStatus;
  processingJob: {
    id: string;
    status: string;
    clipInstructions: string;
  };
  createdAt: Date;
}

/**
 * GET /api/videos query parameters
 */
export interface GetVideosQuery {
  page?: number;
  limit?: number;
  status?: VideoStatus;
}

/**
 * GET /api/videos response
 */
export type GetVideosResponse = PaginatedResponse<VideoSummary>;

/**
 * GET /api/videos/:id response
 */
export type GetVideoResponse = VideoWithRelations;

// ============================================================================
// Clips API
// ============================================================================

/**
 * GET /api/videos/:id/clips response
 */
export interface GetClipsResponse {
  data: ClipSummary[];
}

/**
 * GET /api/clips/:id response
 */
export interface GetClipResponse {
  id: string;
  videoId: string;
  googleDriveFileId: string | null;
  googleDriveUrl: string | null;
  title: string | null;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  transcript: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}
