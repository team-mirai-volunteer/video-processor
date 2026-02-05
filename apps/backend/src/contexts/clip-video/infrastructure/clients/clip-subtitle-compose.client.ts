import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  ClipSubtitleComposeError,
  ClipSubtitleComposeParams,
  ClipSubtitleComposeResult,
  ClipSubtitleComposerGateway,
} from '@clip-video/domain/gateways/clip-subtitle-composer.gateway.js';
import { type Result, err, ok } from '@shared/domain/types/result.js';
import { FFmpegSubtitleGeneratorClient } from '@shared/infrastructure/clients/ffmpeg-subtitle-generator.client.js';
import ffmpeg from 'fluent-ffmpeg';

/**
 * Clip Subtitle Compose Client
 * Composes subtitles onto a video clip using PNG overlay method
 *
 * 処理フロー:
 * 1. 字幕セグメントごとにPNG画像を生成 (FFmpegSubtitleGeneratorClient)
 * 2. 元クリップ動画に字幕画像をoverlayで合成
 */
export class ClipSubtitleComposeClient implements ClipSubtitleComposerGateway {
  private readonly subtitleGenerator: FFmpegSubtitleGeneratorClient;

  constructor() {
    this.subtitleGenerator = new FFmpegSubtitleGeneratorClient();
  }

  /**
   * Compose subtitles onto a video clip
   */
  async compose(
    params: ClipSubtitleComposeParams
  ): Promise<Result<ClipSubtitleComposeResult, ClipSubtitleComposeError>> {
    // Validate input video exists
    if (!fs.existsSync(params.inputVideoPath)) {
      return err({
        type: 'INPUT_VIDEO_NOT_FOUND',
        message: `Input video not found: ${params.inputVideoPath}`,
      });
    }

    // Validate segments
    if (params.segments.length === 0) {
      return err({
        type: 'INVALID_SEGMENTS',
        message: 'Segments array cannot be empty',
      });
    }

    const tempDir = path.dirname(params.inputVideoPath);
    const subtitleImages: { path: string; startTime: number; endTime: number }[] = [];

    try {
      // 1. 各セグメントのPNG画像を生成
      console.log(
        `[ClipSubtitleComposeClient] Generating ${params.segments.length} subtitle images...`
      );

      for (const segment of params.segments) {
        const imagePath = path.join(tempDir, `subtitle_${segment.index}.png`);

        const result = await this.subtitleGenerator.generate({
          text: segment.text,
          width: params.width,
          height: params.height,
          style: params.style,
        });

        if (!result.success) {
          const errorMessage =
            'message' in result.error
              ? result.error.message
              : `Font not found: ${result.error.fontFamily}`;
          return err({
            type: 'SUBTITLE_GENERATION_ERROR',
            message: `Failed to generate subtitle image for segment ${segment.index}: ${errorMessage}`,
          });
        }

        // 画像をファイルに保存
        await fs.promises.writeFile(imagePath, result.value.imageBuffer);

        subtitleImages.push({
          path: imagePath,
          startTime: segment.startTimeSeconds,
          endTime: segment.endTimeSeconds,
        });

        console.log(
          `[ClipSubtitleComposeClient] Generated subtitle ${segment.index}: "${segment.text.substring(0, 20)}..." (${segment.startTimeSeconds}s - ${segment.endTimeSeconds}s)`
        );
      }

      // 2. 動画に字幕画像をoverlay合成
      console.log('[ClipSubtitleComposeClient] Composing subtitles onto video...');

      const durationSeconds = await this.executeFFmpegCompose(
        params.inputVideoPath,
        params.outputPath,
        subtitleImages
      );

      console.log(
        `[ClipSubtitleComposeClient] Composition complete. Duration: ${durationSeconds}s`
      );

      return ok({
        durationSeconds,
        outputPath: params.outputPath,
      });
    } catch (error) {
      if (error instanceof Error && 'type' in error) {
        return err(error as ClipSubtitleComposeError);
      }
      const message = error instanceof Error ? error.message : String(error);
      return err({
        type: 'COMPOSE_FAILED',
        message: `Failed to compose subtitles: ${message}`,
      });
    } finally {
      // 一時的な字幕画像を削除
      for (const img of subtitleImages) {
        try {
          await fs.promises.unlink(img.path);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Execute FFmpeg to compose subtitle images onto video using overlay filter
   */
  private executeFFmpegCompose(
    inputPath: string,
    outputPath: string,
    subtitleImages: { path: string; startTime: number; endTime: number }[]
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      let durationSeconds = 0;

      // Build complex filter for overlaying subtitle images
      const { filterComplex } = this.buildOverlayFilter(subtitleImages);

      console.log('[ClipSubtitleComposeClient] FFmpeg filter_complex:', filterComplex);

      const command = ffmpeg(inputPath);

      // Add subtitle images as inputs
      for (const img of subtitleImages) {
        command.input(img.path);
      }

      command
        .complexFilter(filterComplex)
        .outputOptions(['-map', `[v${subtitleImages.length}]`, '-map', '0:a?', '-c:a', 'copy'])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('[ClipSubtitleComposeClient] FFmpeg command:', commandLine);
        })
        .on('codecData', (data) => {
          if (data.duration) {
            const parts = data.duration.split(':');
            if (parts.length === 3) {
              const hours = Number.parseFloat(parts[0] || '0');
              const minutes = Number.parseFloat(parts[1] || '0');
              const seconds = Number.parseFloat(parts[2] || '0');
              durationSeconds = hours * 3600 + minutes * 60 + seconds;
            }
          }
        })
        .on('end', () => resolve(durationSeconds))
        .on('error', (err: Error) => {
          reject({
            type: 'FFMPEG_ERROR',
            message: `FFmpeg error: ${err.message}`,
            stderr: err.message,
          });
        })
        .run();
    });
  }

  /**
   * Build FFmpeg complex filter for overlaying multiple subtitle images
   *
   * Example output for 3 subtitles:
   * [0:v][1:v]overlay=enable='between(t,0,2)':x=0:y=0[v1];
   * [v1][2:v]overlay=enable='between(t,2,4)':x=0:y=0[v2];
   * [v2][3:v]overlay=enable='between(t,4,6)':x=0:y=0[v3]
   */
  private buildOverlayFilter(
    subtitleImages: { path: string; startTime: number; endTime: number }[]
  ): { filterComplex: string } {
    const filters: string[] = [];

    for (const [i, img] of subtitleImages.entries()) {
      const inputIndex = i + 1; // 0 is the video, 1+ are subtitle images
      const prevOutput = i === 0 ? '0:v' : `v${i}`;
      const currentOutput = `v${i + 1}`;

      // enable expression for time range
      const enableExpr = `between(t,${img.startTime},${img.endTime})`;

      // overlay filter: position at center-bottom (x=0, y=0 since PNG is already positioned)
      const filter = `[${prevOutput}][${inputIndex}:v]overlay=enable='${enableExpr}':x=0:y=0[${currentOutput}]`;
      filters.push(filter);
    }

    return {
      filterComplex: filters.join(';'),
    };
  }
}
