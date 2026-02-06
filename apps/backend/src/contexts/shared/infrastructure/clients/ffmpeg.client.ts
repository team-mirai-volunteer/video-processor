import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  ClipExtractionOptions,
  VideoProcessingGateway,
} from '@shared/domain/gateways/video-processing.gateway.js';
import ffmpeg from 'fluent-ffmpeg';

/**
 * FFmpeg client implementation using fluent-ffmpeg
 * Requires ffmpeg to be installed on the system
 */
export class FFmpegClient implements VideoProcessingGateway {
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
   * Extract audio from a video file to a file
   * Memory efficient: no buffer loading required
   * @param inputPath Path to input video file
   * @param outputPath Path to output audio file
   * @param format Output format ('wav' | 'flac')
   */
  async extractAudioFromFile(
    inputPath: string,
    outputPath: string,
    format: 'wav' | 'flac'
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(inputPath).noVideo().audioFrequency(16000).audioChannels(1);

      if (format === 'wav') {
        command.audioCodec('pcm_s16le');
      } else {
        command.audioCodec('flac');
      }

      command
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run();
    });
  }

  /**
   * Extract a clip from a video file to a file
   * Memory efficient: no buffer loading required
   * @param inputPath Path to input video file
   * @param outputPath Path to output video file
   * @param startTimeSeconds Start time in seconds
   * @param endTimeSeconds End time in seconds
   * @param options Optional clip extraction options (e.g., vertical format)
   */
  async extractClipFromFile(
    inputPath: string,
    outputPath: string,
    startTimeSeconds: number,
    endTimeSeconds: number,
    options?: ClipExtractionOptions
  ): Promise<void> {
    const duration = endTimeSeconds - startTimeSeconds;
    const outputFormat = options?.outputFormat ?? 'original';

    // Build output options
    const outputOptions = [
      '-c:v libx264', // Re-encode video for accurate cutting
      '-preset fast', // Balance between speed and compression
      '-crf 18', // High quality (lower = better, 18 is visually lossless)
      '-c:a aac', // Re-encode audio
      '-b:a 192k', // Audio bitrate
      '-avoid_negative_ts make_zero',
    ];

    // If vertical format, get video dimensions and build filter
    let videoFilter: string | undefined;
    if (outputFormat === 'vertical') {
      const { width, height } = await this.getVideoDimensions(inputPath);
      videoFilter = this.buildVerticalFilter(width, height, options?.paddingColor ?? '#000000');
    }

    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(inputPath).setStartTime(startTimeSeconds).setDuration(duration);

      if (videoFilter) {
        command.videoFilters(videoFilter);
      }

      command
        .outputOptions(outputOptions)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run();
    });
  }

  /**
   * Get video dimensions (width, height) using ffprobe
   */
  private async getVideoDimensions(inputPath: string): Promise<{ width: number; height: number }> {
    const metadata = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });

    const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
    if (!videoStream || !videoStream.width || !videoStream.height) {
      throw new Error('Could not determine video dimensions');
    }

    return { width: videoStream.width, height: videoStream.height };
  }

  /**
   * Build FFmpeg filter for 9:16 vertical format
   * @param sourceWidth Source video width
   * @param sourceHeight Source video height
   * @param paddingColor Padding color (e.g., '#000000')
   * @returns FFmpeg filter string
   */
  private buildVerticalFilter(
    sourceWidth: number,
    sourceHeight: number,
    paddingColor: string
  ): string {
    // Target: 1080x1920 (9:16)
    const targetWidth = 1080;
    const targetHeight = 1920;
    const sourceAspectRatio = sourceWidth / sourceHeight;
    const targetAspectRatio = targetWidth / targetHeight; // 0.5625

    let scaleFilter: string;
    if (sourceAspectRatio > targetAspectRatio) {
      // Source is wider than target -> scale by width
      scaleFilter = `scale=${targetWidth}:-2`;
    } else {
      // Source is taller than target -> scale by height
      scaleFilter = `scale=-2:${targetHeight}`;
    }

    // Pad to target dimensions, center the video
    const padFilter = `pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:color=${paddingColor}`;

    return `${scaleFilter},${padFilter}`;
  }

  /**
   * Extract audio from a URL (e.g., signed GCS URL) to a file
   * Memory efficient: FFmpeg streams directly from URL without local download
   * @param inputUrl URL to input video (must be accessible via HTTP/HTTPS)
   * @param outputPath Path to output audio file
   * @param format Output format ('wav' | 'flac')
   * @param onProgress Optional callback for progress updates (receives timemark string)
   */
  async extractAudioFromUrl(
    inputUrl: string,
    outputPath: string,
    format: 'wav' | 'flac',
    onProgress?: (progress: { timemark: string; percent?: number }) => void
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(inputUrl).noVideo().audioFrequency(16000).audioChannels(1);

      if (format === 'wav') {
        command.audioCodec('pcm_s16le');
      } else {
        command.audioCodec('flac');
      }

      command
        .output(outputPath)
        .on('progress', (progress) => {
          onProgress?.({ timemark: progress.timemark, percent: progress.percent });
        })
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run();
    });
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
