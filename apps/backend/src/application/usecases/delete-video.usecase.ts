import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { NotFoundError } from '../errors.js';

export interface DeleteVideoUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
}

export class DeleteVideoUseCase {
  private readonly videoRepository: VideoRepositoryGateway;

  constructor(deps: DeleteVideoUseCaseDeps) {
    this.videoRepository = deps.videoRepository;
  }

  async execute(id: string): Promise<void> {
    const video = await this.videoRepository.findById(id);

    if (!video) {
      throw new NotFoundError('Video', id);
    }

    await this.videoRepository.delete(id);
  }
}
