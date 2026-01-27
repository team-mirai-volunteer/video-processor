import type { StorageGateway } from '@clip-video/domain/gateways/storage.gateway.js';
import type { VideoRepositoryGateway } from '@clip-video/domain/gateways/video-repository.gateway.js';
import { Video } from '@clip-video/domain/models/video.js';
import type { SubmitVideoResponse } from '@video-processor/shared';
import { ConflictError, ValidationError } from '../errors/errors.js';

export interface SubmitVideoInput {
  googleDriveUrl: string;
}

export interface SubmitVideoUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
  storageGateway: StorageGateway;
  generateId: () => string;
}

export class SubmitVideoUseCase {
  private readonly videoRepository: VideoRepositoryGateway;
  private readonly storageGateway: StorageGateway;
  private readonly generateId: () => string;

  constructor(deps: SubmitVideoUseCaseDeps) {
    this.videoRepository = deps.videoRepository;
    this.storageGateway = deps.storageGateway;
    this.generateId = deps.generateId;
  }

  async execute(input: SubmitVideoInput): Promise<SubmitVideoResponse> {
    // Create video domain object
    const videoResult = Video.create({ googleDriveUrl: input.googleDriveUrl }, this.generateId);

    if (!videoResult.success) {
      throw new ValidationError(videoResult.error.message);
    }

    const video = videoResult.value;

    // Check if video already exists
    const existingVideo = await this.videoRepository.findByGoogleDriveFileId(
      video.googleDriveFileId
    );

    if (existingVideo) {
      throw new ConflictError(
        `Video with Google Drive file ID ${video.googleDriveFileId} already exists`
      );
    }

    // Get video metadata from Google Drive
    const metadata = await this.storageGateway.getFileMetadata(video.googleDriveFileId);

    // Apply metadata to video
    const videoWithMetadataResult = video.withMetadata({
      title: metadata.name,
      fileSizeBytes: metadata.size,
    });

    const videoToSave = videoWithMetadataResult.success ? videoWithMetadataResult.value : video;

    // Save video
    await this.videoRepository.save(videoToSave);

    return {
      id: videoToSave.id,
      googleDriveFileId: videoToSave.googleDriveFileId,
      googleDriveUrl: videoToSave.googleDriveUrl,
      status: videoToSave.status,
      createdAt: videoToSave.createdAt,
    };
  }
}
