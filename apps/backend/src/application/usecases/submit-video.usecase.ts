import type { SubmitVideoResponse } from '@video-processor/shared';
import type { ProcessingJobRepositoryGateway } from '../../domain/gateways/processing-job-repository.gateway.js';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { ProcessingJob } from '../../domain/models/processing-job.js';
import { Video } from '../../domain/models/video.js';
import { ConflictError, ValidationError } from '../errors.js';

export interface SubmitVideoInput {
  googleDriveUrl: string;
  clipInstructions: string;
}

export interface SubmitVideoUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
  processingJobRepository: ProcessingJobRepositoryGateway;
  generateId: () => string;
}

export class SubmitVideoUseCase {
  private readonly videoRepository: VideoRepositoryGateway;
  private readonly processingJobRepository: ProcessingJobRepositoryGateway;
  private readonly generateId: () => string;

  constructor(deps: SubmitVideoUseCaseDeps) {
    this.videoRepository = deps.videoRepository;
    this.processingJobRepository = deps.processingJobRepository;
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

    // Create processing job
    const processingJobResult = ProcessingJob.create(
      {
        videoId: video.id,
        clipInstructions: input.clipInstructions,
      },
      this.generateId
    );

    if (!processingJobResult.success) {
      throw new ValidationError(processingJobResult.error.message);
    }

    const processingJob = processingJobResult.value;

    // Save both
    await this.videoRepository.save(video);
    await this.processingJobRepository.save(processingJob);

    return {
      id: video.id,
      googleDriveFileId: video.googleDriveFileId,
      googleDriveUrl: video.googleDriveUrl,
      status: video.status,
      processingJob: {
        id: processingJob.id,
        status: processingJob.status,
        clipInstructions: processingJob.clipInstructions,
      },
      createdAt: video.createdAt,
    };
  }
}
