import type { StorageGateway } from '@clip-video/domain/gateways/storage.gateway.js';
import type { TempStorageGateway } from '@clip-video/domain/gateways/temp-storage.gateway.js';
import type { VideoRepositoryGateway } from '@clip-video/domain/gateways/video-repository.gateway.js';
import type { Video } from '@clip-video/domain/models/video.js';
import { createLogger } from '@shared/infrastructure/logging/logger.js';
import { NotFoundError } from '../errors/errors.js';

const log = createLogger('CacheVideoUseCase');

export interface CacheVideoUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
  storageGateway: StorageGateway;
  tempStorageGateway: TempStorageGateway;
}

export interface CacheVideoResult {
  videoId: string;
  gcsUri: string;
  expiresAt: Date;
  cached: boolean; // true if already cached, false if newly cached
}

/**
 * Format bytes to human readable string (e.g., "256MB", "1.2GB")
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

/**
 * Throttler for progress updates to avoid excessive DB writes.
 * Updates when:
 * - 5 seconds have passed since last update
 * - Progress has changed by 10% or more
 */
class ProgressThrottler {
  private lastUpdate = 0;
  private lastPercent = 0;

  shouldUpdate(percent: number): boolean {
    const now = Date.now();
    const timeDiff = now - this.lastUpdate >= 5000;
    const percentDiff = percent - this.lastPercent >= 10;

    if (timeDiff || percentDiff) {
      this.lastUpdate = now;
      this.lastPercent = percent;
      return true;
    }
    return false;
  }
}

/**
 * UseCase for caching video from Google Drive to GCS.
 * Uses stream transfer to avoid memory issues with large files.
 *
 * Can be used:
 * - Standalone: to pre-cache videos before processing
 * - As part of CreateTranscriptUseCase: to ensure video is cached
 */
export class CacheVideoUseCase {
  private readonly videoRepository: VideoRepositoryGateway;
  private readonly storageGateway: StorageGateway;
  private readonly tempStorageGateway: TempStorageGateway;

  constructor(deps: CacheVideoUseCaseDeps) {
    this.videoRepository = deps.videoRepository;
    this.storageGateway = deps.storageGateway;
    this.tempStorageGateway = deps.tempStorageGateway;
  }

  /**
   * Update progress message in DB (non-blocking)
   */
  private async updateProgress(video: Video, message: string | null): Promise<Video> {
    const updatedVideo = video.withProgressMessage(message);
    await this.videoRepository.save(updatedVideo);
    return updatedVideo;
  }

  async execute(videoId: string): Promise<CacheVideoResult> {
    log.info('Starting execution', { videoId });

    // Get video
    let video = await this.videoRepository.findById(videoId);
    if (!video) {
      throw new NotFoundError('Video', videoId);
    }
    log.info('Found video', { videoId: video.id, googleDriveFileId: video.googleDriveFileId });

    // Update progress: checking cache
    video = await this.updateProgress(video, 'キャッシュ確認中...');

    // Check if already cached and not expired
    if (video.gcsUri && video.gcsExpiresAt && video.gcsExpiresAt > new Date()) {
      log.info('Checking existing cache...', { gcsUri: video.gcsUri });
      const exists = await this.tempStorageGateway.exists(video.gcsUri);
      if (exists) {
        log.info('Video already cached in GCS');
        // Clear progress message
        await this.updateProgress(video, null);
        return {
          videoId: video.id,
          gcsUri: video.gcsUri,
          expiresAt: video.gcsExpiresAt,
          cached: true,
        };
      }
    }

    // Update progress: starting download
    video = await this.updateProgress(video, 'ダウンロード中...');

    // Get file size for progress calculation
    const totalBytes = video.fileSizeBytes ?? 0;
    log.info('Starting stream transfer from Google Drive to GCS...', { totalBytes });

    // Stream from Google Drive to GCS with progress tracking
    const stream = await this.storageGateway.downloadFileAsStream(video.googleDriveFileId);
    const throttler = new ProgressThrottler();

    const { gcsUri, expiresAt } = await this.tempStorageGateway.uploadFromStreamWithProgress(
      { videoId: video.id },
      stream,
      (bytesTransferred: number) => {
        // Calculate progress percentage
        const percent = totalBytes > 0 ? Math.floor((bytesTransferred / totalBytes) * 100) : 0;

        // Only update if throttler allows
        if (throttler.shouldUpdate(percent)) {
          const message =
            totalBytes > 0
              ? `ダウンロード中... ${formatBytes(bytesTransferred)} / ${formatBytes(totalBytes)} (${percent}%)`
              : `ダウンロード中... ${formatBytes(bytesTransferred)}`;

          // Update progress asynchronously (don't await to avoid blocking stream)
          this.updateProgress(video, message).catch((err) => {
            log.warn('Failed to update progress', { error: String(err) });
          });
        }
      }
    );
    log.info('Stream transfer completed', { gcsUri, expiresAt: expiresAt.toISOString() });

    // Update video with GCS info and clear progress message
    const updatedVideo = video.withGcsInfo(gcsUri, expiresAt).withProgressMessage(null);
    await this.videoRepository.save(updatedVideo);
    log.info('Video record updated with GCS info');

    return {
      videoId: video.id,
      gcsUri,
      expiresAt,
      cached: false,
    };
  }
}
