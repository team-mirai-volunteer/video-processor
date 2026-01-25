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
   * Extract audio from video
   * @param videoBuffer The video content
   * @param format Output format ('wav' | 'flac')
   * @returns Audio data as buffer (16kHz, mono, 16bit)
   */
  extractAudio(videoBuffer: Buffer, format: 'wav' | 'flac'): Promise<Buffer>;
}
