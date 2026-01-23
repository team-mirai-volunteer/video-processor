import { extractFileIdFromUrl } from '@video-processor/shared/utils';
import type { Video } from '../../domain/models/video.js';
import type { ProcessingJob } from '../../domain/models/processing-job.js';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { VideoRepository } from '../../infrastructure/repositories/video.repository.js';
import { ProcessingJobRepository } from '../../infrastructure/repositories/processing-job.repository.js';

/**
 * Submit video request input
 */
export interface SubmitVideoInput {
  googleDriveUrl: string;
  clipInstructions: string;
}

/**
 * Submit video response
 */
export interface SubmitVideoOutput {
  video: Video;
  processingJob: ProcessingJob;
}

/**
 * Submit video use case
 * Registers a new video and creates a processing job
 */
export class SubmitVideoUseCase {
  private videoRepository: VideoRepositoryGateway;
  private processingJobRepository: ProcessingJobRepository;

  constructor(
    videoRepository?: VideoRepositoryGateway,
    processingJobRepository?: ProcessingJobRepository
  ) {
    this.videoRepository = videoRepository ?? new VideoRepository();
    this.processingJobRepository = processingJobRepository ?? new ProcessingJobRepository();
  }

  async execute(input: SubmitVideoInput): Promise<SubmitVideoOutput> {
    // Extract file ID from URL
    const fileId = extractFileIdFromUrl(input.googleDriveUrl);
    if (!fileId) {
      throw new Error('Invalid Google Drive URL');
    }

    // Check if video already exists
    const existingVideo = await this.videoRepository.findByGoogleDriveFileId(fileId);
    if (existingVideo) {
      // If video exists, create a new processing job for it
      const processingJob = await this.processingJobRepository.create({
        videoId: existingVideo.id,
        clipInstructions: input.clipInstructions,
      });

      return {
        video: existingVideo,
        processingJob,
      };
    }

    // Create new video
    const video = await this.videoRepository.create({
      googleDriveFileId: fileId,
      googleDriveUrl: input.googleDriveUrl,
    });

    // Create processing job
    const processingJob = await this.processingJobRepository.create({
      videoId: video.id,
      clipInstructions: input.clipInstructions,
    });

    return {
      video,
      processingJob,
    };
  }
}
