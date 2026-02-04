import type { ClipRepositoryGateway } from '@clip-video/domain/gateways/clip-repository.gateway.js';
import type { VideoRepositoryGateway } from '@clip-video/domain/gateways/video-repository.gateway.js';
import type { GetClipResponse, GetClipsResponse } from '@video-processor/shared';
import { NotFoundError } from '../errors/errors.js';

export interface GetClipsUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
  clipRepository: ClipRepositoryGateway;
}

export class GetClipsUseCase {
  private readonly videoRepository: VideoRepositoryGateway;
  private readonly clipRepository: ClipRepositoryGateway;

  constructor(deps: GetClipsUseCaseDeps) {
    this.videoRepository = deps.videoRepository;
    this.clipRepository = deps.clipRepository;
  }

  async executeForVideo(videoId: string): Promise<GetClipsResponse> {
    const video = await this.videoRepository.findById(videoId);

    if (!video) {
      throw new NotFoundError('Video', videoId);
    }

    const clips = await this.clipRepository.findByVideoId(videoId);

    return {
      data: clips.map((clip) => ({
        id: clip.id,
        title: clip.title,
        startTimeSeconds: clip.startTimeSeconds,
        endTimeSeconds: clip.endTimeSeconds,
        durationSeconds: clip.durationSeconds,
        googleDriveUrl: clip.googleDriveUrl,
        transcript: clip.transcript,
        status: clip.status,
      })),
    };
  }

  async executeForClip(clipId: string): Promise<GetClipResponse> {
    const clip = await this.clipRepository.findById(clipId);

    if (!clip) {
      throw new NotFoundError('Clip', clipId);
    }

    return {
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
      subtitledVideoGcsUri: clip.subtitledVideoGcsUri,
      subtitledVideoUrl: clip.subtitledVideoUrl,
      subtitledVideoDriveId: clip.subtitledVideoDriveId,
      subtitledVideoDriveUrl: clip.subtitledVideoDriveUrl,
      clipVideoGcsUri: clip.clipVideoGcsUri,
      clipVideoGcsExpiresAt: clip.clipVideoGcsExpiresAt,
    };
  }
}
