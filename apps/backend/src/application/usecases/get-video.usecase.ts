import type { GetVideoResponse } from '@video-processor/shared';
import type { ClipRepositoryGateway } from '../../domain/gateways/clip-repository.gateway.js';
import type { ProcessingJobRepositoryGateway } from '../../domain/gateways/processing-job-repository.gateway.js';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { NotFoundError } from '../errors.js';

export interface GetVideoUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
  clipRepository: ClipRepositoryGateway;
  processingJobRepository: ProcessingJobRepositoryGateway;
}

export class GetVideoUseCase {
  private readonly videoRepository: VideoRepositoryGateway;
  private readonly clipRepository: ClipRepositoryGateway;
  private readonly processingJobRepository: ProcessingJobRepositoryGateway;

  constructor(deps: GetVideoUseCaseDeps) {
    this.videoRepository = deps.videoRepository;
    this.clipRepository = deps.clipRepository;
    this.processingJobRepository = deps.processingJobRepository;
  }

  async execute(id: string): Promise<GetVideoResponse> {
    const video = await this.videoRepository.findById(id);

    if (!video) {
      throw new NotFoundError('Video', id);
    }

    const [clips, processingJobs] = await Promise.all([
      this.clipRepository.findByVideoId(id),
      this.processingJobRepository.findByVideoId(id),
    ]);

    return {
      id: video.id,
      googleDriveFileId: video.googleDriveFileId,
      googleDriveUrl: video.googleDriveUrl,
      title: video.title,
      description: video.description,
      durationSeconds: video.durationSeconds,
      fileSizeBytes: video.fileSizeBytes,
      status: video.status,
      errorMessage: video.errorMessage,
      clips: clips.map((clip) => ({
        id: clip.id,
        videoId: clip.videoId,
        googleDriveFileId: clip.googleDriveFileId,
        googleDriveUrl: clip.googleDriveUrl,
        title: clip.title,
        startTimeSeconds: clip.startTimeSeconds,
        endTimeSeconds: clip.endTimeSeconds,
        durationSeconds: clip.durationSeconds,
        transcript: clip.transcript,
        status: clip.status,
        errorMessage: clip.errorMessage,
        createdAt: clip.createdAt,
        updatedAt: clip.updatedAt,
      })),
      processingJobs: processingJobs.map((job) => ({
        id: job.id,
        status: job.status,
        clipInstructions: job.clipInstructions,
        completedAt: job.completedAt,
      })),
      createdAt: video.createdAt,
      updatedAt: video.updatedAt,
    };
  }
}
