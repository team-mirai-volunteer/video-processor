import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { NotFoundError, ValidationError } from '@clip-video/application/errors/errors.js';
import type { ClipRepositoryGateway } from '@clip-video/domain/gateways/clip-repository.gateway.js';
import type { ClipSubtitleComposerGateway } from '@clip-video/domain/gateways/clip-subtitle-composer.gateway.js';
import type { ClipSubtitleRepositoryGateway } from '@clip-video/domain/gateways/clip-subtitle-repository.gateway.js';
import type { TempStorageGateway } from '@shared/domain/gateways/temp-storage.gateway.js';
import ffmpeg from 'fluent-ffmpeg';

export interface ComposeSubtitledClipInput {
  clipId: string;
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
    const { clipId } = input;

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

    // 4. Create temp directory for processing
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'subtitle-compose-'));
    const inputVideoPath = path.join(tempDir, 'input.mp4');
    const outputVideoPath = path.join(tempDir, 'output.mp4');

    try {
      // 5. Download source video from GCS
      const videoBuffer = await this.deps.tempStorage.download(sourceGcsUri);
      await fs.promises.writeFile(inputVideoPath, videoBuffer);

      // 6. Get video dimensions using ffprobe
      const { width, height } = await this.getVideoDimensions(inputVideoPath);

      // 7. Compose subtitles onto video
      const composeResult = await this.deps.clipSubtitleComposer.compose({
        inputVideoPath,
        segments: subtitle.segments,
        outputPath: outputVideoPath,
        width,
        height,
      });

      if (!composeResult.success) {
        throw new Error(`Failed to compose subtitles: ${composeResult.error.message}`);
      }

      // 8. Upload composed video to GCS
      const gcsPath = `subtitled/${clip.videoId}/${clipId}.mp4`;
      const uploadResult = await this.deps.tempStorage.uploadFromStream(
        {
          videoId: clip.videoId,
          path: gcsPath,
          contentType: 'video/mp4',
        },
        fs.createReadStream(outputVideoPath)
      );

      // 9. Generate signed URL for the uploaded video
      const signedUrl = await this.deps.tempStorage.getSignedUrl(uploadResult.gcsUri);

      // 10. Update clip with subtitled video info
      const updatedClip = clip.withSubtitledVideoGcsInfo(uploadResult.gcsUri, signedUrl);
      await this.deps.clipRepository.save(updatedClip);

      return {
        clipId,
        subtitledVideoUrl: signedUrl,
      };
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
