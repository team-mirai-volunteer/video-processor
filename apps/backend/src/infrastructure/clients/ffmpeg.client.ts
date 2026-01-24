import type { VideoProcessingService } from '../../application/services/video-processing.service.js';

/**
 * FFmpeg client implementation
 * Note: This is a placeholder implementation.
 * In production, this would use fluent-ffmpeg or spawn ffmpeg directly.
 */
export class FFmpegClient implements VideoProcessingService {
  async extractClip(
    _videoBuffer: Buffer,
    startTimeSeconds: number,
    endTimeSeconds: number
  ): Promise<Buffer> {
    // TODO: Implement actual FFmpeg processing
    // Example using fluent-ffmpeg:
    // const inputPath = await this.writeToTempFile(videoBuffer);
    // const outputPath = this.getTempOutputPath();
    //
    // await new Promise((resolve, reject) => {
    //   ffmpeg(inputPath)
    //     .setStartTime(startTimeSeconds)
    //     .setDuration(endTimeSeconds - startTimeSeconds)
    //     .output(outputPath)
    //     .on('end', resolve)
    //     .on('error', reject)
    //     .run();
    // });
    //
    // const result = await fs.promises.readFile(outputPath);
    // await this.cleanup(inputPath, outputPath);
    // return result;

    throw new Error(
      `FFmpeg not configured. Cannot extract clip from ${startTimeSeconds}s to ${endTimeSeconds}s`
    );
  }

  async getVideoDuration(_videoBuffer: Buffer): Promise<number> {
    // TODO: Implement actual FFmpeg probe
    // Example using fluent-ffmpeg:
    // const inputPath = await this.writeToTempFile(videoBuffer);
    //
    // const metadata = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
    //   ffmpeg.ffprobe(inputPath, (err, data) => {
    //     if (err) reject(err);
    //     else resolve(data);
    //   });
    // });
    //
    // await fs.promises.unlink(inputPath);
    // return metadata.format.duration ?? 0;

    throw new Error(
      `FFmpeg not configured. Cannot get duration for video of size ${_videoBuffer.length}`
    );
  }
}
