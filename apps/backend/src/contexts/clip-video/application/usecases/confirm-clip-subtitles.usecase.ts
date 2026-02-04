import type { ClipSubtitleRepositoryGateway } from '@clip-video/domain/gateways/clip-subtitle-repository.gateway.js';
import type { ConfirmClipSubtitleResponse } from '@video-processor/shared';
import {
  SubtitleAlreadyConfirmedError,
  SubtitleNotFoundError,
} from '../errors/clip-subtitle.errors.js';

export interface ConfirmClipSubtitlesUseCaseDeps {
  clipSubtitleRepository: ClipSubtitleRepositoryGateway;
}

export class ConfirmClipSubtitlesUseCase {
  private readonly clipSubtitleRepository: ClipSubtitleRepositoryGateway;

  constructor(deps: ConfirmClipSubtitlesUseCaseDeps) {
    this.clipSubtitleRepository = deps.clipSubtitleRepository;
  }

  async execute(clipId: string): Promise<ConfirmClipSubtitleResponse> {
    // 1. Find existing subtitle
    const existingSubtitle = await this.clipSubtitleRepository.findByClipId(clipId);
    if (!existingSubtitle) {
      throw new SubtitleNotFoundError(clipId);
    }

    // 2. Confirm the subtitle
    const confirmResult = existingSubtitle.confirm();
    if (!confirmResult.success) {
      throw new SubtitleAlreadyConfirmedError(clipId);
    }

    const confirmedSubtitle = confirmResult.value;

    // 3. Save to repository
    await this.clipSubtitleRepository.save(confirmedSubtitle);

    return {
      subtitle: {
        id: confirmedSubtitle.id,
        clipId: confirmedSubtitle.clipId,
        segments: confirmedSubtitle.segments,
        status: confirmedSubtitle.status,
        createdAt: confirmedSubtitle.createdAt,
        updatedAt: confirmedSubtitle.updatedAt,
      },
    };
  }
}
