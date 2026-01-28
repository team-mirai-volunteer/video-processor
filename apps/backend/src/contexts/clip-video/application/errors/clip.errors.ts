/**
 * Error codes for ExtractClipsUseCase
 */
export const CLIP_ERROR_CODES = {
  VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
  TRANSCRIPTION_NOT_FOUND: 'TRANSCRIPTION_NOT_FOUND',
  REFINED_TRANSCRIPTION_NOT_FOUND: 'REFINED_TRANSCRIPTION_NOT_FOUND',
  AI_ANALYSIS_FAILED: 'AI_ANALYSIS_FAILED',
  VIDEO_FETCH_FAILED: 'VIDEO_FETCH_FAILED',
  CLIP_EXTRACTION_FAILED: 'CLIP_EXTRACTION_FAILED',
  CLIP_UPLOAD_FAILED: 'CLIP_UPLOAD_FAILED',
  GCS_DOWNLOAD_FAILED: 'GCS_DOWNLOAD_FAILED',
  TEMP_FILE_CREATION_FAILED: 'TEMP_FILE_CREATION_FAILED',
  FFMPEG_EXTRACTION_FAILED: 'FFMPEG_EXTRACTION_FAILED',
} as const;

export type ClipErrorCode = (typeof CLIP_ERROR_CODES)[keyof typeof CLIP_ERROR_CODES];

export interface ClipError {
  path: string;
  code: ClipErrorCode;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Create a ClipError object
 */
export function createClipError(
  code: ClipErrorCode,
  message: string,
  severity: 'error' | 'warning' = 'error'
): ClipError {
  return {
    path: 'ExtractClipsUseCase',
    code,
    message,
    severity,
  };
}
