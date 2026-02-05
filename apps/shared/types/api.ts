import type { ClipSubtitle, ClipSubtitleSegment } from './clip-subtitle.js';
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
  title: string | null;
  transcript: string | null;
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
  title: string | null;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  transcript: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  // 字幕付き動画関連
  subtitledVideoGcsUri: string | null;
  subtitledVideoUrl: string | null;
  subtitledVideoDriveId: string | null;
  subtitledVideoDriveUrl: string | null;
  // 動画プレイヤー用キャッシュ
  clipVideoGcsUri: string | null;
  clipVideoGcsExpiresAt: Date | null;
}

// ============================================================================
// Extract Clips API
// ============================================================================

/** 余白カラープリセット */
export type PaddingColor = '#000000' | '#30bca7';

/** 出力フォーマット */
export type OutputFormat = 'original' | 'vertical' | 'horizontal';

/** 字幕フォントサイズ */
export type SubtitleFontSize = 'medium' | 'large';

/**
 * POST /api/videos/:videoId/extract-clips request body
 */
export interface ExtractClipsRequest {
  clipInstructions: string;
  /** true=複数クリップを許可, false=単一クリップのみ (デフォルト: false) */
  multipleClips?: boolean;
  /** 出力フォーマット。'vertical' の場合は9:16に変換 (デフォルト: 'original') */
  outputFormat?: OutputFormat;
  /** 余白の色（プリセットから選択）。outputFormat: 'vertical' 時のみ有効 (デフォルト: '#000000') */
  paddingColor?: PaddingColor;
}

/**
 * POST /api/videos/:videoId/extract-clips response
 */
export interface ExtractClipsResponse {
  videoId: string;
  status: VideoStatus;
}

// ============================================================================
// Extract Clip by Time API (タイムライン指定切り抜き)
// ============================================================================

/**
 * POST /api/videos/:videoId/extract-clip-by-time request body
 * タイムスタンプを直接指定してクリップを抽出
 */
export interface ExtractClipByTimeRequest {
  /** 開始時間（秒）。0以上 */
  startTimeSeconds: number;
  /** 終了時間（秒）。startTimeSecondsより大きい値 */
  endTimeSeconds: number;
  /** クリップのタイトル（オプション）。省略時は選択範囲のテキストから自動生成 */
  title?: string;
}

/**
 * POST /api/videos/:videoId/extract-clip-by-time response
 */
export interface ExtractClipByTimeResponse {
  videoId: string;
  clipId: string;
  status: 'extracting' | 'completed' | 'failed';
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

// ============================================================================
// Clip Subtitle API
// ============================================================================

/**
 * POST /api/clips/:clipId/subtitles/generate response
 */
export interface GenerateClipSubtitlesResponse {
  clipId: string;
  subtitle: ClipSubtitle;
}

/**
 * GET /api/clips/:clipId/subtitles response
 */
export interface GetClipSubtitleResponse {
  subtitle: ClipSubtitle | null;
}

/**
 * PUT /api/clips/:clipId/subtitles request body
 */
export interface UpdateClipSubtitleRequest {
  segments: ClipSubtitleSegment[];
}

/**
 * PUT /api/clips/:clipId/subtitles response
 */
export interface UpdateClipSubtitleResponse {
  subtitle: ClipSubtitle;
}

/**
 * POST /api/clips/:clipId/subtitles/confirm response
 */
export interface ConfirmClipSubtitleResponse {
  subtitle: ClipSubtitle;
}

/**
 * POST /api/clips/:clipId/compose request body
 */
export interface ComposeSubtitledClipRequest {
  outputFormat?: OutputFormat;
  paddingColor?: PaddingColor;
  /** 字幕フォントサイズ（デフォルト: 'medium'） */
  fontSize?: SubtitleFontSize;
}

/**
 * POST /api/clips/:clipId/compose response
 */
export interface ComposeSubtitledClipResponse {
  clipId: string;
  subtitledVideoUrl: string;
}

/**
 * POST /api/clips/:clipId/upload-to-drive response
 */
export interface UploadSubtitledClipResponse {
  clipId: string;
  driveFileId: string;
  driveUrl: string;
}

/**
 * GET /api/clips/:clipId/video-url response
 */
export interface GetClipVideoUrlResponse {
  videoUrl: string;
  expiresAt: Date;
  durationSeconds: number;
}
