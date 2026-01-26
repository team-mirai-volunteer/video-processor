import type { StorageGateway } from '../../domain/gateways/storage.gateway.js';
import type { TempStorageGateway } from '../../domain/gateways/temp-storage.gateway.js';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { createLogger } from '../../infrastructure/logging/logger.js';
import { NotFoundError } from '../errors.js';

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

  async execute(videoId: string): Promise<CacheVideoResult> {
    log.info('Starting execution', { videoId });

    // Get video
    const video = await this.videoRepository.findById(videoId);
    if (!video) {
      throw new NotFoundError('Video', videoId);
    }
    log.info('Found video', { videoId: video.id, googleDriveFileId: video.googleDriveFileId });

    // Check if already cached and not expired
    if (video.gcsUri && video.gcsExpiresAt && video.gcsExpiresAt > new Date()) {
      log.info('Checking existing cache...', { gcsUri: video.gcsUri });
      const exists = await this.tempStorageGateway.exists(video.gcsUri);
      if (exists) {
        log.info('Video already cached in GCS');
        return {
          videoId: video.id,
          gcsUri: video.gcsUri,
          expiresAt: video.gcsExpiresAt,
          cached: true,
        };
      }
    }

    // Stream from Google Drive to GCS
    log.info('Starting stream transfer from Google Drive to GCS...');
    const stream = await this.storageGateway.downloadFileAsStream(video.googleDriveFileId);

    const { gcsUri, expiresAt } = await this.tempStorageGateway.uploadFromStream(
      { videoId: video.id },
      stream
    );
    log.info('Stream transfer completed', { gcsUri, expiresAt: expiresAt.toISOString() });

    // Update video with GCS info
    const updatedVideo = video.withGcsInfo(gcsUri, expiresAt);
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
