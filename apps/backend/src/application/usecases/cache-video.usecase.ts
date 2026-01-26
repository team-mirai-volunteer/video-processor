import type { StorageGateway } from '../../domain/gateways/storage.gateway.js';
import type { TempStorageGateway } from '../../domain/gateways/temp-storage.gateway.js';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { NotFoundError } from '../errors.js';

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

  private log(message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const logData = data ? ` ${JSON.stringify(data)}` : '';
    console.log(`[CacheVideoUseCase] [${timestamp}] ${message}${logData}`);
  }

  async execute(videoId: string): Promise<CacheVideoResult> {
    this.log('Starting execution', { videoId });

    // Get video
    const video = await this.videoRepository.findById(videoId);
    if (!video) {
      throw new NotFoundError('Video', videoId);
    }
    this.log('Found video', { videoId: video.id, googleDriveFileId: video.googleDriveFileId });

    // Check if already cached and not expired
    if (video.gcsUri && video.gcsExpiresAt && video.gcsExpiresAt > new Date()) {
      this.log('Checking existing cache...', { gcsUri: video.gcsUri });
      const exists = await this.tempStorageGateway.exists(video.gcsUri);
      if (exists) {
        this.log('Video already cached in GCS');
        return {
          videoId: video.id,
          gcsUri: video.gcsUri,
          expiresAt: video.gcsExpiresAt,
          cached: true,
        };
      }
    }

    // Stream from Google Drive to GCS
    this.log('Starting stream transfer from Google Drive to GCS...');
    const stream = await this.storageGateway.downloadFileAsStream(video.googleDriveFileId);

    const { gcsUri, expiresAt } = await this.tempStorageGateway.uploadFromStream(
      { videoId: video.id },
      stream
    );
    this.log('Stream transfer completed', { gcsUri, expiresAt });

    // Update video with GCS info
    const updatedVideo = video.withGcsInfo(gcsUri, expiresAt);
    await this.videoRepository.save(updatedVideo);
    this.log('Video record updated with GCS info');

    return {
      videoId: video.id,
      gcsUri,
      expiresAt,
      cached: false,
    };
  }
}
