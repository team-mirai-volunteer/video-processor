import type { VideoListItem, VideoStatus } from '@video-processor/shared';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { VideoRepository } from '../../infrastructure/repositories/video.repository.js';
import { ClipRepository } from '../../infrastructure/repositories/clip.repository.js';

/**
 * Get videos input
 */
export interface GetVideosInput {
  page?: number;
  limit?: number;
  status?: VideoStatus;
}

/**
 * Get videos output with pagination
 */
export interface GetVideosOutput {
  data: VideoListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Get videos use case
 * Retrieves a paginated list of videos
 */
export class GetVideosUseCase {
  private videoRepository: VideoRepositoryGateway;
  private clipRepository: ClipRepository;

  constructor(
    videoRepository?: VideoRepositoryGateway,
    clipRepository?: ClipRepository
  ) {
    this.videoRepository = videoRepository ?? new VideoRepository();
    this.clipRepository = clipRepository ?? new ClipRepository();
  }

  async execute(input: GetVideosInput = {}): Promise<GetVideosOutput> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const { videos, total } = await this.videoRepository.findAll({
      page,
      limit,
      status: input.status,
    });

    // Get clip counts for each video
    const videosWithClipCount: VideoListItem[] = await Promise.all(
      videos.map(async (video) => {
        const clips = await this.clipRepository.findByVideoId(video.id);
        return {
          id: video.id,
          googleDriveUrl: video.googleDriveUrl,
          title: video.title,
          status: video.status,
          clipCount: clips.length,
          createdAt: video.createdAt,
        };
      })
    );

    return {
      data: videosWithClipCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

/**
 * Get video detail input
 */
export interface GetVideoDetailInput {
  id: string;
}

/**
 * Get video detail use case
 * Retrieves a single video with its relations
 */
export class GetVideoDetailUseCase {
  private videoRepository: VideoRepositoryGateway;

  constructor(videoRepository?: VideoRepositoryGateway) {
    this.videoRepository = videoRepository ?? new VideoRepository();
  }

  async execute(input: GetVideoDetailInput) {
    const video = await this.videoRepository.findByIdWithRelations(input.id);

    if (!video) {
      throw new Error('Video not found');
    }

    return video;
  }
}
