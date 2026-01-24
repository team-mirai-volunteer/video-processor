import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import ffmpeg from 'fluent-ffmpeg';
import type { VideoProcessingService } from '../../application/services/video-processing.service.js';

/**
 * FFmpeg client implementation using fluent-ffmpeg
 * Requires ffmpeg to be installed on the system
 */
export class FFmpegClient implements VideoProcessingService {
  /**
   * Extract a clip from video
   * @param videoBuffer The full video content
   * @param startTimeSeconds Start time in seconds
   * @param endTimeSeconds End time in seconds
   * @returns The extracted clip as a buffer
   */
  async extractClip(
    videoBuffer: Buffer,
    startTimeSeconds: number,
    endTimeSeconds: number
  ): Promise<Buffer> {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ffmpeg-'));
    const inputPath = path.join(tempDir, 'input.mp4');
    const outputPath = path.join(tempDir, 'output.mp4');

    try {
      await fs.promises.writeFile(inputPath, videoBuffer);

      const duration = endTimeSeconds - startTimeSeconds;

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .setStartTime(startTimeSeconds)
          .setDuration(duration)
          .outputOptions(['-c:v copy', '-c:a copy', '-avoid_negative_ts make_zero'])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .run();
      });

      const result = await fs.promises.readFile(outputPath);
      return result;
    } finally {
      await this.cleanup(tempDir);
    }
  }

  /**
   * Get video duration in seconds
   * @param videoBuffer The video content
   * @returns Duration in seconds
   */
  async getVideoDuration(videoBuffer: Buffer): Promise<number> {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ffmpeg-'));
    const inputPath = path.join(tempDir, 'input.mp4');

    try {
      await fs.promises.writeFile(inputPath, videoBuffer);

      const metadata = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });

      return metadata.format.duration ?? 0;
    } finally {
      await this.cleanup(tempDir);
    }
  }

  /**
   * Cleanup temporary directory and its contents
   */
  private async cleanup(tempDir: string): Promise<void> {
    try {
      const files = await fs.promises.readdir(tempDir);
      await Promise.all(files.map((file) => fs.promises.unlink(path.join(tempDir, file))));
      await fs.promises.rmdir(tempDir);
    } catch {
      // Ignore cleanup errors
    }
  }
}
