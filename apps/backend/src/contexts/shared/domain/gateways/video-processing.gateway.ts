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
   */
  extractClipFromFile(
    inputPath: string,
    outputPath: string,
    startTimeSeconds: number,
    endTimeSeconds: number
  ): Promise<void>;
}
