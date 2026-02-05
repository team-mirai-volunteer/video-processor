import type { VideoRepositoryGateway } from '@clip-video/domain/gateways/video-repository.gateway.js';
import type { GetVideosResponse, VideoStatus } from '@video-processor/shared';

export interface GetVideosInput {
  page?: number;
  limit?: number;
  status?: VideoStatus;
}

export interface GetVideosUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 500;

export class GetVideosUseCase {
  private readonly videoRepository: VideoRepositoryGateway;

  constructor(deps: GetVideosUseCaseDeps) {
    this.videoRepository = deps.videoRepository;
  }

  async execute(input: GetVideosInput): Promise<GetVideosResponse> {
    const page = Math.max(1, input.page ?? DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, input.limit ?? DEFAULT_LIMIT));

    const result = await this.videoRepository.findMany({
      page,
      limit,
      status: input.status,
    });

    const totalPages = Math.ceil(result.total / limit);

    return {
      data: result.videos.map(({ video, clipCount }) => ({
        id: video.id,
        googleDriveUrl: video.googleDriveUrl,
        title: video.title,
        status: video.status,
        clipCount,
        createdAt: video.createdAt,
      })),
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages,
      },
    };
  }
}
