import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { NotFoundError, ValidationError } from '@clip-video/application/errors/errors.js';
import type { ClipRepositoryGateway } from '@clip-video/domain/gateways/clip-repository.gateway.js';
import type { ClipSubtitleComposerGateway } from '@clip-video/domain/gateways/clip-subtitle-composer.gateway.js';
import type { ClipSubtitleRepositoryGateway } from '@clip-video/domain/gateways/clip-subtitle-repository.gateway.js';
import type { TempStorageGateway } from '@shared/domain/gateways/temp-storage.gateway.js';
import { createLogger } from '@shared/infrastructure/logging/logger.js';
import type {
  ComposeProgressPhase,
  OutlineColor,
  OutputFormat,
  PaddingColor,
  SubtitleFontSize,
} from '@video-processor/shared';
import ffmpeg from 'fluent-ffmpeg';

const log = createLogger('ComposeSubtitledClipUseCase');

export interface ComposeSubtitledClipInput {
  clipId: string;
  outputFormat?: OutputFormat;
  paddingColor?: PaddingColor;
  outlineColor?: OutlineColor;
  fontSize?: SubtitleFontSize;
}

export interface ComposeSubtitledClipOutput {
  clipId: string;
  subtitledVideoUrl: string;
}

export interface ComposeSubtitledClipUseCaseDeps {
  clipRepository: ClipRepositoryGateway;
  clipSubtitleRepository: ClipSubtitleRepositoryGateway;
  clipSubtitleComposer: ClipSubtitleComposerGateway;
  tempStorage: TempStorageGateway;
}

/**
 * Create a throttled progress reporter that only updates DB
 * when the rounded percent value actually changes.
 */
function createProgressReporter(
  clipId: string,
  phase: ComposeProgressPhase,
  rangeStart: number,
  rangeEnd: number,
  updateFn: (clipId: string, phase: ComposeProgressPhase, percent: number) => Promise<void>
): (internalPercent: number) => void {
  let lastReported = -1;
  return (internalPercent: number) => {
    const mapped = rangeStart + (internalPercent / 100) * (rangeEnd - rangeStart);
    const rounded = Math.round(mapped);
    if (rounded !== lastReported) {
      lastReported = rounded;
      updateFn(clipId, phase, rounded).catch(() => {});
    }
  };
}

/**
 * ComposeSubtitledClipUseCase
 * Composes subtitles onto a clip video and uploads to GCS
 */
export class ComposeSubtitledClipUseCase {
  constructor(private readonly deps: ComposeSubtitledClipUseCaseDeps) {}

  async execute(input: ComposeSubtitledClipInput): Promise<ComposeSubtitledClipOutput> {
    const {
      clipId,
      outputFormat = 'original',
      paddingColor = '#000000',
      outlineColor = '#30bca7',
      fontSize = 'medium',
    } = input;

    log.info('Starting subtitle composition', { clipId, outputFormat });

    // 1. Get clip
    const clip = await this.deps.clipRepository.findById(clipId);
    if (!clip) {
      throw new NotFoundError('Clip', clipId);
    }

    // 2. Get confirmed subtitle for clip
    const subtitle = await this.deps.clipSubtitleRepository.findByClipId(clipId);
    if (!subtitle) {
      throw new NotFoundError('ClipSubtitle', clipId);
    }
    if (subtitle.status !== 'confirmed') {
      throw new ValidationError(`Subtitle is not confirmed for clip: ${clipId}`);
    }

    // 3. Check if clip has video in GCS (clipVideoGcsUri or from Google Drive)
    const sourceGcsUri = clip.clipVideoGcsUri;
    if (!sourceGcsUri) {
      throw new NotFoundError('ClipVideo', clipId);
    }

    // Mark as processing
    await this.deps.clipRepository.updateComposeStatus(clipId, 'processing');

    // 4. Create temp directory for processing
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'subtitle-compose-'));
    const inputVideoPath = path.join(tempDir, 'input.mp4');
    const outputVideoPath = path.join(tempDir, 'output.mp4');

    const updateProgress = this.deps.clipRepository.updateComposeProgress.bind(
      this.deps.clipRepository
    );

    try {
      // === Phase: downloading (0-20%) ===
      await updateProgress(clipId, 'downloading', 0);
      log.info('Downloading source video from GCS', { clipId, sourceGcsUri });

      // Get file size for progress tracking
      let totalFileSize = 0;
      try {
        totalFileSize = await this.deps.tempStorage.getFileSize(sourceGcsUri);
      } catch {
        // File size unavailable — skip granular download progress
      }

      const downloadReporter = createProgressReporter(clipId, 'downloading', 0, 20, updateProgress);

      // 5. Download source video from GCS (using stream with progress tracking)
      const gcsStream = this.deps.tempStorage.downloadAsStream(sourceGcsUri);
      const writeStream = fs.createWriteStream(inputVideoPath);

      if (totalFileSize > 0) {
        let bytesReceived = 0;
        const progressTracker = new Transform({
          transform(chunk, _encoding, callback) {
            bytesReceived += chunk.length;
            downloadReporter((bytesReceived / totalFileSize) * 100);
            this.push(chunk);
            callback();
          },
        });
        await pipeline(gcsStream, progressTracker, writeStream);
      } else {
        await pipeline(gcsStream, writeStream);
      }

      await updateProgress(clipId, 'downloading', 20);
      log.info('Download completed', { clipId });

      // 6. Apply format conversion if requested (before subtitle composition)
      let subtitleInputPath = inputVideoPath;
      const needsConversion = outputFormat === 'vertical' || outputFormat === 'horizontal';

      if (needsConversion) {
        // === Phase: converting (20-40%) ===
        await updateProgress(clipId, 'converting', 20);
        log.info('Converting video format', { clipId, outputFormat });

        const convertedPath = path.join(tempDir, `${outputFormat}.mp4`);
        const { width: srcWidth, height: srcHeight } =
          await this.getVideoDimensions(inputVideoPath);
        const target =
          outputFormat === 'vertical'
            ? { width: 1080, height: 1920 }
            : { width: 1920, height: 1080 };

        const convertReporter = createProgressReporter(
          clipId,
          'converting',
          20,
          40,
          updateProgress
        );

        await this.convertToFormat(
          inputVideoPath,
          convertedPath,
          srcWidth,
          srcHeight,
          target.width,
          target.height,
          paddingColor,
          convertReporter
        );
        subtitleInputPath = convertedPath;

        await updateProgress(clipId, 'converting', 40);
        log.info('Format conversion completed', { clipId });
      }

      // === Phase: composing (40-80% or 20-80%) ===
      const composeStartPercent = needsConversion ? 40 : 20;
      await updateProgress(clipId, 'composing', composeStartPercent);
      log.info('Composing subtitles onto video', { clipId });

      // 7. Get video dimensions for subtitle composition
      const { width, height } = await this.getVideoDimensions(subtitleInputPath);

      const composeReporter = createProgressReporter(
        clipId,
        'composing',
        composeStartPercent,
        80,
        updateProgress
      );

      // 8. Compose subtitles onto video
      const composeResult = await this.deps.clipSubtitleComposer.compose({
        inputVideoPath: subtitleInputPath,
        segments: subtitle.segments,
        outputPath: outputVideoPath,
        width,
        height,
        style: {
          outlineColor,
        },
        fontSize,
        onProgress: composeReporter,
      });

      if (!composeResult.success) {
        throw new Error(`Failed to compose subtitles: ${composeResult.error.message}`);
      }

      await updateProgress(clipId, 'composing', 80);
      log.info('Subtitle composition completed', { clipId });

      const finalOutputPath = outputVideoPath;

      // === Phase: uploading (80-100%) ===
      await updateProgress(clipId, 'uploading', 80);
      log.info('Uploading composed video to GCS', { clipId });

      // Get output file size for upload progress tracking
      const outputStat = await fs.promises.stat(finalOutputPath);
      const outputFileSize = outputStat.size;

      const uploadReporter = createProgressReporter(clipId, 'uploading', 80, 95, updateProgress);

      // 9. Upload composed video to GCS (with progress tracking)
      const gcsPath = `subtitled/${clip.videoId}/${clipId}.mp4`;
      const uploadResult = await this.deps.tempStorage.uploadFromStreamWithProgress(
        {
          videoId: clip.videoId,
          path: gcsPath,
          contentType: 'video/mp4',
        },
        fs.createReadStream(finalOutputPath),
        (bytesTransferred: number) => {
          if (outputFileSize > 0) {
            uploadReporter((bytesTransferred / outputFileSize) * 100);
          }
        }
      );

      await updateProgress(clipId, 'uploading', 95);

      // 10. Generate signed URL for the uploaded video
      const signedUrl = await this.deps.tempStorage.getSignedUrl(uploadResult.gcsUri);

      // 11. Update clip with subtitled video info and mark as completed
      const updatedClip = clip.completeCompose(uploadResult.gcsUri, signedUrl);
      await this.deps.clipRepository.save(updatedClip);

      log.info('Subtitle composition completed successfully', { clipId, signedUrl });

      return {
        clipId,
        subtitledVideoUrl: signedUrl,
      };
    } catch (error) {
      // Mark as failed
      log.error('Subtitle composition failed', error as Error, { clipId });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.deps.clipRepository.updateComposeStatus(clipId, 'failed', errorMessage);
      throw error;
    } finally {
      // Cleanup temp files
      await this.cleanup(tempDir);
    }
  }

  /**
   * Convert video to specified format with padding
   */
  private convertToFormat(
    inputPath: string,
    outputPath: string,
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number,
    targetHeight: number,
    paddingColor: string,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    const sourceAspectRatio = sourceWidth / sourceHeight;
    const targetAspectRatio = targetWidth / targetHeight;

    const scaleFilter =
      sourceAspectRatio > targetAspectRatio
        ? `scale=${targetWidth}:-2`
        : `scale=-2:${targetHeight}`;
    const padFilter = `pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:color=${paddingColor}`;
    const videoFilter = `${scaleFilter},${padFilter}`;

    let lastReportedPercent = -1;

    return new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(videoFilter)
        .outputOptions(['-c:a', 'copy'])
        .output(outputPath)
        .on('progress', (progress) => {
          if (onProgress && progress.percent != null) {
            const rounded = Math.round(progress.percent);
            if (rounded !== lastReportedPercent) {
              lastReportedPercent = rounded;
              onProgress(rounded);
            }
          }
        })
        .on('end', () => {
          onProgress?.(100);
          resolve();
        })
        .on('error', (err: Error) => reject(err))
        .run();
    });
  }

  /**
   * Get video dimensions using ffprobe
   */
  private getVideoDimensions(videoPath: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
        if (!videoStream || !videoStream.width || !videoStream.height) {
          reject(new Error('Could not determine video dimensions'));
          return;
        }

        resolve({
          width: videoStream.width,
          height: videoStream.height,
        });
      });
    });
  }

  /**
   * Cleanup temporary directory
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
