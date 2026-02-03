import type { ClipRepositoryGateway } from '@clip-video/domain/gateways/clip-repository.gateway.js';
import type { GetAllClipsResponse } from '@video-processor/shared';

export interface GetAllClipsInput {
  page?: number;
  limit?: number;
}

export interface GetAllClipsUseCaseDeps {
  clipRepository: ClipRepositoryGateway;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export class GetAllClipsUseCase {
  private readonly clipRepository: ClipRepositoryGateway;

  constructor(deps: GetAllClipsUseCaseDeps) {
    this.clipRepository = deps.clipRepository;
  }

  async execute(input: GetAllClipsInput): Promise<GetAllClipsResponse> {
    const page = Math.max(1, input.page ?? DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, input.limit ?? DEFAULT_LIMIT));

    const result = await this.clipRepository.findAllPaginated({ page, limit });

    const totalPages = Math.ceil(result.total / limit);

    return {
      data: result.clips.map(({ clip, videoTitle }) => ({
        id: clip.id,
        title: clip.title,
        transcript: clip.transcript,
        googleDriveUrl: clip.googleDriveUrl,
        status: clip.status,
        videoId: clip.videoId,
        videoTitle,
        createdAt: clip.createdAt,
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
