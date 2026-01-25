import type { SubmitVideoResponse } from '@video-processor/shared';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { Video } from '../../domain/models/video.js';
import { ConflictError, ValidationError } from '../errors.js';

export interface SubmitVideoInput {
  googleDriveUrl: string;
}

export interface SubmitVideoUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
  generateId: () => string;
}

export class SubmitVideoUseCase {
  private readonly videoRepository: VideoRepositoryGateway;
  private readonly generateId: () => string;

  constructor(deps: SubmitVideoUseCaseDeps) {
    this.videoRepository = deps.videoRepository;
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

    // Save video (processing job is no longer created here)
    await this.videoRepository.save(video);

    return {
      id: video.id,
      googleDriveFileId: video.googleDriveFileId,
      googleDriveUrl: video.googleDriveUrl,
      status: video.status,
      createdAt: video.createdAt,
    };
  }
}
