import type { ClipSubtitleRepositoryGateway } from '@clip-video/domain/gateways/clip-subtitle-repository.gateway.js';
import type { GetClipSubtitleResponse } from '@video-processor/shared';

export interface GetClipSubtitlesUseCaseDeps {
  clipSubtitleRepository: ClipSubtitleRepositoryGateway;
}

export class GetClipSubtitlesUseCase {
  private readonly clipSubtitleRepository: ClipSubtitleRepositoryGateway;

  constructor(deps: GetClipSubtitlesUseCaseDeps) {
    this.clipSubtitleRepository = deps.clipSubtitleRepository;
  }

  async execute(clipId: string): Promise<GetClipSubtitleResponse> {
    const subtitle = await this.clipSubtitleRepository.findByClipId(clipId);

    if (!subtitle) {
      return { subtitle: null };
    }

    return {
      subtitle: {
        id: subtitle.id,
        clipId: subtitle.clipId,
        segments: subtitle.segments,
        status: subtitle.status,
        createdAt: subtitle.createdAt,
        updatedAt: subtitle.updatedAt,
      },
    };
  }
}
