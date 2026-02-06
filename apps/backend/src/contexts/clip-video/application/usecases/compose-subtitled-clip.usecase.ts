import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { NotFoundError, ValidationError } from '@clip-video/application/errors/errors.js';
import type { ClipRepositoryGateway } from '@clip-video/domain/gateways/clip-repository.gateway.js';
import type {
  ClipSubtitleComposerGateway,
  FormatConversionParams,
} from '@clip-video/domain/gateways/clip-subtitle-composer.gateway.js';
import type { ClipSubtitleRepositoryGateway } from '@clip-video/domain/gateways/clip-subtitle-repository.gateway.js';
import type { TempStorageGateway } from '@shared/domain/gateways/temp-storage.gateway.js';
import { createLogger } from '@shared/infrastructure/logging/logger.js';
import type {
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

    try {
      // === Phase: downloading (0-20%) ===
      await this.deps.clipRepository.updateComposeProgress(clipId, 'downloading', 0);
      log.info('Downloading source video from GCS', { clipId, sourceGcsUri });

      // 5. Download source video from GCS (using stream for memory efficiency)
      const gcsStream = this.deps.tempStorage.downloadAsStream(sourceGcsUri);
      const writeStream = fs.createWriteStream(inputVideoPath);
      await pipeline(gcsStream, writeStream);

      await this.deps.clipRepository.updateComposeProgress(clipId, 'downloading', 20);
      log.info('Download completed', { clipId });

      // === Phase: composing (20-80%) — フォーマット変換 + 字幕合成を1パスで実行 ===
      await this.deps.clipRepository.updateComposeProgress(clipId, 'composing', 20);
      log.info('Composing subtitles onto video', { clipId, outputFormat });

      // 6. Get source video dimensions
      const { width, height } = await this.getVideoDimensions(inputVideoPath);

      // 7. Build format conversion params (if needed)
      const needsConversion = outputFormat === 'vertical' || outputFormat === 'horizontal';
      let formatConversion: FormatConversionParams | undefined;
      if (needsConversion) {
        const target =
          outputFormat === 'vertical'
            ? { width: 1080, height: 1920 }
            : { width: 1920, height: 1080 };
        formatConversion = {
          targetWidth: target.width,
          targetHeight: target.height,
          paddingColor,
        };
      }

      // 8. Compose subtitles (+ format conversion) in single FFmpeg pass
      const composeResult = await this.deps.clipSubtitleComposer.compose({
        inputVideoPath,
        segments: subtitle.segments,
        outputPath: outputVideoPath,
        width,
        height,
        style: {
          outlineColor,
        },
        fontSize,
        formatConversion,
      });

      if (!composeResult.success) {
        throw new Error(`Failed to compose subtitles: ${composeResult.error.message}`);
      }

      await this.deps.clipRepository.updateComposeProgress(clipId, 'composing', 80);
      log.info('Subtitle composition completed', { clipId });

      const finalOutputPath = outputVideoPath;

      // === Phase: uploading (80-100%) ===
      await this.deps.clipRepository.updateComposeProgress(clipId, 'uploading', 80);
      log.info('Uploading composed video to GCS', { clipId });

      // 9. Upload composed video to GCS
      const gcsPath = `subtitled/${clip.videoId}/${clipId}.mp4`;
      const uploadResult = await this.deps.tempStorage.uploadFromStream(
        {
          videoId: clip.videoId,
          path: gcsPath,
          contentType: 'video/mp4',
        },
        fs.createReadStream(finalOutputPath)
      );

      await this.deps.clipRepository.updateComposeProgress(clipId, 'uploading', 95);

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
