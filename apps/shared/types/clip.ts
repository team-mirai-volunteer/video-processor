/**
 * Clip status enum
 */
export type ClipStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Compose status for subtitled video
 */
export type ComposeStatus = 'idle' | 'processing' | 'completed' | 'failed';

/**
 * Progress phase for subtitle composition
 */
export type ComposeProgressPhase = 'downloading' | 'converting' | 'composing' | 'uploading';

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
  // 字幕付き動画関連
  subtitledVideoGcsUri: string | null;
  subtitledVideoUrl: string | null;
  subtitledVideoDriveId: string | null;
  subtitledVideoDriveUrl: string | null;
  // 動画プレイヤー用キャッシュ
  clipVideoGcsUri: string | null;
  clipVideoGcsExpiresAt: Date | null;
  // 字幕合成進捗
  composeStatus: ComposeStatus | null;
  composeProgressPhase: ComposeProgressPhase | null;
  composeProgressPercent: number | null;
  composeErrorMessage: string | null;
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

/**
 * Response for compose status endpoint
 */
export interface ClipComposeStatusResponse {
  composeStatus: ComposeStatus | null;
  composeProgressPhase: ComposeProgressPhase | null;
  composeProgressPercent: number | null;
  composeErrorMessage: string | null;
  subtitledVideoUrl: string | null;
}
