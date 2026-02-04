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
 * 動画登録のみ（処理は開始しない）
 */
export interface SubmitVideoRequest {
  googleDriveUrl: string;
}

/**
 * POST /api/videos response
 */
export interface SubmitVideoResponse {
  id: string;
  googleDriveFileId: string;
  googleDriveUrl: string;
  status: VideoStatus;
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
 * GET /api/clips query parameters
 * 全クリップ一覧取得用
 */
export interface GetAllClipsQuery {
  page?: number;
  limit?: number;
}

/**
 * Clip summary with video information for list views
 * 動画横断クリップ一覧用の型
 */
export interface AllClipSummary {
  id: string;
  title: string;
  transcript: string;
  googleDriveUrl: string | null;
  status: import('./clip.js').ClipStatus;
  videoId: string;
  videoTitle: string | null;
  durationSeconds: number;
  createdAt: Date;
}

/**
 * GET /api/clips response
 */
export type GetAllClipsResponse = PaginatedResponse<AllClipSummary>;

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
  title: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  transcript: string;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Extract Clips API
// ============================================================================

/**
 * POST /api/videos/:videoId/extract-clips request body
 */
export interface ExtractClipsRequest {
  clipInstructions: string;
  /** true=複数クリップを許可, false=単一クリップのみ (デフォルト: false) */
  multipleClips?: boolean;
}

/**
 * POST /api/videos/:videoId/extract-clips response
 */
export interface ExtractClipsResponse {
  videoId: string;
  status: VideoStatus;
}

// ============================================================================
// Transcription API
// ============================================================================

/**
 * POST /api/videos/:videoId/transcribe response
 */
export interface TranscribeVideoResponse {
  videoId: string;
  status: VideoStatus;
}

/**
 * GET /api/videos/:videoId/transcription response
 */
export interface GetTranscriptionResponse {
  id: string;
  videoId: string;
  fullText: string;
  segments: import('./video.js').TranscriptionSegment[];
  languageCode: string;
  durationSeconds: number;
  createdAt: Date;
}

// ============================================================================
// Refined Transcription API
// ============================================================================

/**
 * A sentence segment with timestamp (merged from word-level segments)
 */
export interface RefinedSentence {
  text: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  originalSegmentIndices: number[];
}

/**
 * POST /api/videos/:videoId/refine-transcript response
 */
export interface RefineTranscriptResponse {
  videoId: string;
  status: 'refining' | 'refined' | 'failed';
}

/**
 * GET /api/videos/:videoId/transcription/refined response
 */
export interface GetRefinedTranscriptionResponse {
  id: string;
  transcriptionId: string;
  fullText: string;
  sentences: RefinedSentence[];
  dictionaryVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Pipeline Step APIs
// ============================================================================

/**
 * POST /api/videos/:videoId/cache response
 */
export interface CacheVideoResponse {
  videoId: string;
  gcsUri: string;
  expiresAt: string; // ISO 8601
  cached: boolean;
}

/**
 * POST /api/videos/:videoId/extract-audio response
 */
export interface ExtractAudioResponse {
  videoId: string;
  format: 'flac';
  audioGcsUri: string;
}

/**
 * POST /api/videos/:videoId/transcribe-audio response
 */
export interface TranscribeAudioResponse {
  videoId: string;
  transcriptionId: string;
  segmentsCount: number;
  durationSeconds: number;
}
