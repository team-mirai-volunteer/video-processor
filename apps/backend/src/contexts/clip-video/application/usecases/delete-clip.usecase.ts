import type { ClipRepositoryGateway } from '@clip-video/domain/gateways/clip-repository.gateway.js';
import { NotFoundError } from '../errors/errors.js';

export interface DeleteClipInput {
  clipId: string;
}

export interface DeleteClipOutput {
  deletedClipId: string;
}

export interface DeleteClipUseCaseDeps {
  clipRepository: ClipRepositoryGateway;
}

export class DeleteClipUseCase {
  private readonly clipRepository: ClipRepositoryGateway;

  constructor(deps: DeleteClipUseCaseDeps) {
    this.clipRepository = deps.clipRepository;
  }

  async execute(input: DeleteClipInput): Promise<DeleteClipOutput> {
    const clip = await this.clipRepository.findById(input.clipId);

    if (!clip) {
      throw new NotFoundError('Clip', input.clipId);
    }

    await this.clipRepository.delete(input.clipId);

    return {
      deletedClipId: input.clipId,
    };
  }
}
