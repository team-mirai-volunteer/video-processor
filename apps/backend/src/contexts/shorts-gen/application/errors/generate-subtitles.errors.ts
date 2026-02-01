/**
 * GenerateSubtitlesUseCase エラーコード
 */
export const GENERATE_SUBTITLES_ERROR_CODES = {
  SCRIPT_NOT_FOUND: 'GENERATE_SUBTITLES_SCRIPT_NOT_FOUND',
  PROJECT_NOT_FOUND: 'GENERATE_SUBTITLES_PROJECT_NOT_FOUND',
  NO_SCENES: 'GENERATE_SUBTITLES_NO_SCENES',
  NO_SUBTITLES: 'GENERATE_SUBTITLES_NO_SUBTITLES',
  GENERATION_FAILED: 'GENERATE_SUBTITLES_GENERATION_FAILED',
  UPLOAD_FAILED: 'GENERATE_SUBTITLES_UPLOAD_FAILED',
  ASSET_SAVE_FAILED: 'GENERATE_SUBTITLES_ASSET_SAVE_FAILED',
} as const;

export type GenerateSubtitlesErrorCode =
  (typeof GENERATE_SUBTITLES_ERROR_CODES)[keyof typeof GENERATE_SUBTITLES_ERROR_CODES];

/**
 * GenerateSubtitlesUseCase エラー
 */
export class GenerateSubtitlesError extends Error {
  constructor(
    public readonly code: GenerateSubtitlesErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'GenerateSubtitlesError';
  }
}
