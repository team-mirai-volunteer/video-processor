export const TRANSCRIPT_ERROR_CODES = {
  VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
  VIDEO_DOWNLOAD_FAILED: 'VIDEO_DOWNLOAD_FAILED',
  AUDIO_EXTRACTION_FAILED: 'AUDIO_EXTRACTION_FAILED',
  TRANSCRIPTION_FAILED: 'TRANSCRIPTION_FAILED',
  GCS_UPLOAD_FAILED: 'GCS_UPLOAD_FAILED',
} as const;

export type TranscriptErrorCode =
  (typeof TRANSCRIPT_ERROR_CODES)[keyof typeof TRANSCRIPT_ERROR_CODES];

export interface TranscriptError {
  path: string;
  code: TranscriptErrorCode;
  message: string;
  severity: 'error' | 'warning';
}
