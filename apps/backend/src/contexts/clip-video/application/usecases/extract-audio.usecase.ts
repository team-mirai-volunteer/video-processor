import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { TempStorageGateway } from '@clip-video/domain/gateways/temp-storage.gateway.js';
import type { VideoProcessingGateway } from '@clip-video/domain/gateways/video-processing.gateway.js';
import type { VideoRepositoryGateway } from '@clip-video/domain/gateways/video-repository.gateway.js';
import { createLogger } from '@shared/infrastructure/logging/logger.js';
import { NotFoundError } from '../errors/errors.js';

const log = createLogger('ExtractAudioUseCase');

export interface ExtractAudioUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
  tempStorageGateway: TempStorageGateway;
  videoProcessingGateway: VideoProcessingGateway;
}

/**
 * Result of audio extraction
 * Audio is uploaded to GCS instead of returned as buffer
 */
export interface ExtractAudioResult {
  videoId: string;
  audioGcsUri: string;
  format: 'wav' | 'flac';
}

/**
 * UseCase for extracting audio from a cached video.
 * Requires video to be already cached in GCS.
 *
 * Can be used:
 * - Standalone: to extract audio for other purposes
 * - As part of CreateTranscriptUseCase: to get audio for transcription
 */
export class ExtractAudioUseCase {
  private readonly videoRepository: VideoRepositoryGateway;
  private readonly tempStorageGateway: TempStorageGateway;
  private readonly videoProcessingGateway: VideoProcessingGateway;

  constructor(deps: ExtractAudioUseCaseDeps) {
    this.videoRepository = deps.videoRepository;
    this.tempStorageGateway = deps.tempStorageGateway;
    this.videoProcessingGateway = deps.videoProcessingGateway;
  }

  /**
   * Extract audio and upload directly to GCS
   * Memory efficient: suitable for large videos (1GB+)
   *
   * Flow:
   * 1. Get signed URL for GCS video (no download)
   * 2. FFmpeg streams directly from URL to temp file
   * 3. Stream upload from temp file to GCS
   */
  async execute(videoId: string, format: 'wav' | 'flac' = 'flac'): Promise<ExtractAudioResult> {
    log.info('Starting stream execution', { videoId, format });

    // Get video
    const video = await this.videoRepository.findById(videoId);
    if (!video) {
      throw new NotFoundError('Video', videoId);
    }
    log.info('Found video', { videoId: video.id });

    // Check if video is cached
    if (!video.gcsUri) {
      throw new Error(`Video ${videoId} is not cached in GCS. Run CacheVideoUseCase first.`);
    }

    // Check if cache exists
    const exists = await this.tempStorageGateway.exists(video.gcsUri);
    if (!exists) {
      throw new Error(
        `Video cache not found at ${video.gcsUri}. Cache may have expired. Run CacheVideoUseCase again.`
      );
    }

    // Create temp directory for output only
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'extract-audio-'));
    const outputPath = path.join(tempDir, `output.${format}`);

    try {
      // 1. Get signed URL for direct FFmpeg access (valid for 60 minutes)
      log.info('Getting signed URL for video...', { gcsUri: video.gcsUri });
      const signedUrl = await this.tempStorageGateway.getSignedUrl(video.gcsUri, 60);
      log.info('Got signed URL for video');

      // 2. FFmpeg streams directly from URL to temp file (no video download!)
      log.info('Extracting audio from URL directly...', { format });
      let lastSavedPercent = 0;
      await this.videoProcessingGateway.extractAudioFromUrl(
        signedUrl,
        outputPath,
        format,
        async (progress) => {
          // Update progress every 10%
          const percent = progress.percent ?? 0;
          if (percent >= lastSavedPercent + 10 || (percent >= 100 && lastSavedPercent < 100)) {
            const roundedPercent = Math.round(percent);
            log.info('Audio extraction progress', {
              timemark: progress.timemark,
              percent: roundedPercent,
            });
            lastSavedPercent = Math.floor(percent / 10) * 10;

            // Save progress to DB for UI polling
            const currentVideo = await this.videoRepository.findById(videoId);
            if (currentVideo) {
              const updatedVideo = currentVideo.withProgressMessage(
                `音声抽出中... ${roundedPercent}% (${progress.timemark})`
              );
              await this.videoRepository.save(updatedVideo);
            }
          }
        }
      );
      const outputStats = await fs.promises.stat(outputPath);
      log.info('Audio extracted to temp file', { sizeBytes: outputStats.size });

      // 3. Stream upload to GCS
      log.info('Uploading audio to GCS...');
      const uploadStream = fs.createReadStream(outputPath);
      const contentType = format === 'wav' ? 'audio/wav' : 'audio/flac';
      const { gcsUri: audioGcsUri } = await this.tempStorageGateway.uploadFromStream(
        { videoId, contentType, path: `audio.${format}` },
        uploadStream
      );
      log.info('Audio uploaded to GCS', { audioGcsUri });

      // 4. Save audioGcsUri to video for later use
      const updatedVideo = await this.videoRepository.findById(videoId);
      if (updatedVideo) {
        await this.videoRepository.save(updatedVideo.withAudioGcsUri(audioGcsUri));
        log.info('Audio GCS URI saved to video', { audioGcsUri });
      }

      return {
        videoId: video.id,
        audioGcsUri,
        format,
      };
    } finally {
      // Cleanup temp directory
      await this.cleanup(tempDir);
    }
  }

  /**
   * Cleanup temporary directory and its contents
   */
  private async cleanup(tempDir: string): Promise<void> {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      log.debug('Temp directory cleaned up', { tempDir });
    } catch {
      // Ignore cleanup errors
    }
  }
}
