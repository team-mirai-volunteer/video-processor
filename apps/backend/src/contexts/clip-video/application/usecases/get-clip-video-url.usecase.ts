import type { ClipRepositoryGateway } from '@clip-video/domain/gateways/clip-repository.gateway.js';
import type { StorageGateway } from '@clip-video/domain/gateways/storage.gateway.js';
import type { TempStorageGateway } from '@shared/domain/gateways/temp-storage.gateway.js';
import { createLogger } from '@shared/infrastructure/logging/logger.js';
import type { GetClipVideoUrlResponse } from '@video-processor/shared';
import { ClipNotFoundError, ClipVideoNotFoundError } from '../errors/clip-subtitle.errors.js';

const log = createLogger('GetClipVideoUrlUseCase');

const CACHE_EXPIRY_HOURS = 24;
const SIGNED_URL_EXPIRY_MINUTES = 60;

export interface GetClipVideoUrlUseCaseDeps {
  clipRepository: ClipRepositoryGateway;
  storageGateway: StorageGateway;
  tempStorageGateway: TempStorageGateway;
}

export class GetClipVideoUrlUseCase {
  private readonly clipRepository: ClipRepositoryGateway;
  private readonly storageGateway: StorageGateway;
  private readonly tempStorageGateway: TempStorageGateway;

  constructor(deps: GetClipVideoUrlUseCaseDeps) {
    this.clipRepository = deps.clipRepository;
    this.storageGateway = deps.storageGateway;
    this.tempStorageGateway = deps.tempStorageGateway;
  }

  async execute(clipId: string): Promise<GetClipVideoUrlResponse> {
    log.info('Getting video URL for clip', { clipId });

    // 1. Get clip
    const clip = await this.clipRepository.findById(clipId);
    if (!clip) {
      throw new ClipNotFoundError(clipId);
    }

    // 2. Check if clip has Google Drive file
    if (!clip.googleDriveFileId) {
      throw new ClipVideoNotFoundError(clipId);
    }

    // 3. Check if we have a valid GCS cache
    if (clip.clipVideoGcsUri && clip.clipVideoGcsExpiresAt) {
      const now = new Date();
      if (clip.clipVideoGcsExpiresAt > now) {
        log.info('Using cached GCS video', { clipId, gcsUri: clip.clipVideoGcsUri });
        const signedUrl = await this.tempStorageGateway.getSignedUrl(
          clip.clipVideoGcsUri,
          SIGNED_URL_EXPIRY_MINUTES
        );
        return {
          videoUrl: signedUrl,
          expiresAt: new Date(Date.now() + SIGNED_URL_EXPIRY_MINUTES * 60 * 1000),
          durationSeconds: clip.durationSeconds,
        };
      }
    }

    // 4. Download from Google Drive and upload to GCS
    log.info('Downloading clip video from Google Drive', {
      clipId,
      googleDriveFileId: clip.googleDriveFileId,
    });

    const stream = await this.storageGateway.downloadFileAsStream(clip.googleDriveFileId);

    const uploadResult = await this.tempStorageGateway.uploadFromStream(
      {
        videoId: `clips/${clipId}`,
        contentType: 'video/mp4',
        path: 'video.mp4',
      },
      stream
    );

    log.info('Video uploaded to GCS', { clipId, gcsUri: uploadResult.gcsUri });

    // 5. Update clip with GCS cache info
    const expiresAt = new Date(Date.now() + CACHE_EXPIRY_HOURS * 60 * 60 * 1000);
    const updatedClip = clip.withGcsCache(uploadResult.gcsUri, expiresAt);
    await this.clipRepository.save(updatedClip);

    // 6. Generate signed URL
    const signedUrl = await this.tempStorageGateway.getSignedUrl(
      uploadResult.gcsUri,
      SIGNED_URL_EXPIRY_MINUTES
    );

    return {
      videoUrl: signedUrl,
      expiresAt: new Date(Date.now() + SIGNED_URL_EXPIRY_MINUTES * 60 * 1000),
      durationSeconds: clip.durationSeconds,
    };
  }
}
