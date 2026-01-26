/**
 * Video status enum
 * - pending: 動画登録済み、処理待ち
 * - transcribing: トランスクリプト作成中
 * - transcribed: トランスクリプト完了、切り抜き待ち
 * - extracting: 切り抜き動画作成中
 * - completed: 全処理完了
 * - failed: エラー発生
 */
export type VideoStatus =
  | 'pending'
  | 'transcribing'
  | 'transcribed'
  | 'extracting'
  | 'completed'
  | 'failed';

/**
 * Transcription phase enum (detailed progress during transcribing status)
 * - downloading: 動画をダウンロード中
 * - extracting_audio: 音声を抽出中
 * - transcribing: 文字起こし中
 * - saving: 文字起こしを保存中
 * - uploading: ファイルをアップロード中
 * - refining: AIで校正中
 */
export type TranscriptionPhase =
  | 'downloading'
  | 'extracting_audio'
  | 'transcribing'
  | 'saving'
  | 'uploading'
  | 'refining';

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
  transcriptionPhase: TranscriptionPhase | null;
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
  transcriptionPhase: TranscriptionPhase | null;
  errorMessage: string | null;
  gcsUri: string | null;
  gcsExpiresAt: Date | null;
  clips: import('./clip.js').Clip[];
  processingJobs: import('./processing-job.js').ProcessingJobSummary[];
  transcription: Transcription | null;
  createdAt: Date;
  updatedAt: Date;
}
