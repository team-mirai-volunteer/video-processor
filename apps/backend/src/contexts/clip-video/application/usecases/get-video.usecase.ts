import type { ClipRepositoryGateway } from '@clip-video/domain/gateways/clip-repository.gateway.js';
import type { ProcessingJobRepositoryGateway } from '@clip-video/domain/gateways/processing-job-repository.gateway.js';
import type { TranscriptionRepositoryGateway } from '@clip-video/domain/gateways/transcription-repository.gateway.js';
import type { VideoRepositoryGateway } from '@clip-video/domain/gateways/video-repository.gateway.js';
import type { GetVideoResponse } from '@video-processor/shared';
import { NotFoundError } from '../errors/errors.js';

export interface GetVideoUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
  clipRepository: ClipRepositoryGateway;
  processingJobRepository: ProcessingJobRepositoryGateway;
  transcriptionRepository: TranscriptionRepositoryGateway;
}

export class GetVideoUseCase {
  private readonly videoRepository: VideoRepositoryGateway;
  private readonly clipRepository: ClipRepositoryGateway;
  private readonly processingJobRepository: ProcessingJobRepositoryGateway;
  private readonly transcriptionRepository: TranscriptionRepositoryGateway;

  constructor(deps: GetVideoUseCaseDeps) {
    this.videoRepository = deps.videoRepository;
    this.clipRepository = deps.clipRepository;
    this.processingJobRepository = deps.processingJobRepository;
    this.transcriptionRepository = deps.transcriptionRepository;
  }

  async execute(id: string): Promise<GetVideoResponse> {
    const video = await this.videoRepository.findById(id);

    if (!video) {
      throw new NotFoundError('Video', id);
    }

    const [clips, processingJobs, transcription] = await Promise.all([
      this.clipRepository.findByVideoId(id),
      this.processingJobRepository.findByVideoId(id),
      this.transcriptionRepository.findByVideoId(id),
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
      transcriptionPhase: video.transcriptionPhase,
      errorMessage: video.errorMessage,
      progressMessage: video.progressMessage,
      gcsUri: video.gcsUri,
      gcsExpiresAt: video.gcsExpiresAt,
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
      transcription: transcription
        ? {
            id: transcription.id,
            videoId: transcription.videoId,
            fullText: transcription.fullText,
            segments: transcription.segments,
            languageCode: transcription.languageCode,
            durationSeconds: transcription.durationSeconds,
            createdAt: transcription.createdAt,
          }
        : null,
      createdAt: video.createdAt,
      updatedAt: video.updatedAt,
    };
  }
}
