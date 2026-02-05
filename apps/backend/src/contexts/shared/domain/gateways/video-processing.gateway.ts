/** 余白カラープリセット */
export type PaddingColor = '#000000' | '#30bca7';

/** 出力フォーマット */
export type OutputFormat = 'original' | 'vertical';

/** クリップ抽出オプション */
export interface ClipExtractionOptions {
  /** 出力フォーマット。'vertical' の場合は9:16に変換 */
  outputFormat?: OutputFormat;
  /** 余白の色（プリセットから選択）。outputFormat: 'vertical' 時のみ有効 */
  paddingColor?: PaddingColor;
}

/**
 * Gateway interface for video processing operations
 */
export interface VideoProcessingGateway {
  /**
   * Extract a clip from video
   * @param videoBuffer The full video content
   * @param startTimeSeconds Start time in seconds
   * @param endTimeSeconds End time in seconds
   * @returns The extracted clip as a buffer
   */
  extractClip(
    videoBuffer: Buffer,
    startTimeSeconds: number,
    endTimeSeconds: number
  ): Promise<Buffer>;

  /**
   * Get video duration in seconds
   * @param videoBuffer The video content
   * @returns Duration in seconds
   */
  getVideoDuration(videoBuffer: Buffer): Promise<number>;

  /**
   * Extract audio from a video file to a file
   * Memory efficient: no buffer loading required
   * @param inputPath Path to input video file
   * @param outputPath Path to output audio file
   * @param format Output format ('wav' | 'flac')
   */
  extractAudioFromFile(
    inputPath: string,
    outputPath: string,
    format: 'wav' | 'flac'
  ): Promise<void>;

  /**
   * Extract a clip from a video file to a file
   * Memory efficient: no buffer loading required
   * @param inputPath Path to input video file
   * @param outputPath Path to output video file
   * @param startTimeSeconds Start time in seconds
   * @param endTimeSeconds End time in seconds
   * @param options Optional clip extraction options (e.g., vertical format)
   */
  extractClipFromFile(
    inputPath: string,
    outputPath: string,
    startTimeSeconds: number,
    endTimeSeconds: number,
    options?: ClipExtractionOptions
  ): Promise<void>;

  /**
   * Extract audio from a URL (e.g., signed GCS URL) to a file
   * Memory efficient: FFmpeg streams directly from URL without local download
   * @param inputUrl URL to input video (must be accessible via HTTP/HTTPS)
   * @param outputPath Path to output audio file
   * @param format Output format ('wav' | 'flac')
   * @param onProgress Optional callback for progress updates
   */
  extractAudioFromUrl(
    inputUrl: string,
    outputPath: string,
    format: 'wav' | 'flac',
    onProgress?: (progress: { timemark: string; percent?: number }) => void
  ): Promise<void>;
}
