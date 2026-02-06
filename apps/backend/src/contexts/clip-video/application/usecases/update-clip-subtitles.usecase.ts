import type { ClipSubtitleRepositoryGateway } from '@clip-video/domain/gateways/clip-subtitle-repository.gateway.js';
import type { ClipSubtitleSegment } from '@clip-video/domain/models/clip-subtitle.js';
import type { UpdateClipSubtitleResponse } from '@video-processor/shared';
import { SubtitleNotFoundError, SubtitleValidationError } from '../errors/clip-subtitle.errors.js';

export interface UpdateClipSubtitlesUseCaseDeps {
  clipSubtitleRepository: ClipSubtitleRepositoryGateway;
}

export interface UpdateClipSubtitlesInput {
  clipId: string;
  segments: ClipSubtitleSegment[];
}

export class UpdateClipSubtitlesUseCase {
  private readonly clipSubtitleRepository: ClipSubtitleRepositoryGateway;

  constructor(deps: UpdateClipSubtitlesUseCaseDeps) {
    this.clipSubtitleRepository = deps.clipSubtitleRepository;
  }

  async execute(input: UpdateClipSubtitlesInput): Promise<UpdateClipSubtitleResponse> {
    const { clipId, segments } = input;

    // 1. Find existing subtitle
    const existingSubtitle = await this.clipSubtitleRepository.findByClipId(clipId);
    if (!existingSubtitle) {
      throw new SubtitleNotFoundError(clipId);
    }

    // 2. Update segments
    const updateResult = existingSubtitle.withSegments(segments);
    if (!updateResult.success) {
      throw new SubtitleValidationError(updateResult.error.message);
    }

    const updatedSubtitle = updateResult.value;

    // 3. Save to repository
    await this.clipSubtitleRepository.save(updatedSubtitle);

    return {
      subtitle: {
        id: updatedSubtitle.id,
        clipId: updatedSubtitle.clipId,
        segments: updatedSubtitle.segments,
        status: updatedSubtitle.status,
        createdAt: updatedSubtitle.createdAt,
        updatedAt: updatedSubtitle.updatedAt,
      },
    };
  }
}
