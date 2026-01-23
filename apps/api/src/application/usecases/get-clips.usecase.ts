import type { Clip } from '../../domain/models/clip.js';
import type { ClipRepositoryGateway } from '../../domain/gateways/clip-repository.gateway.js';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { ClipRepository } from '../../infrastructure/repositories/clip.repository.js';
import { VideoRepository } from '../../infrastructure/repositories/video.repository.js';

/**
 * Get clips by video input
 */
export interface GetClipsByVideoInput {
  videoId: string;
}

/**
 * Get clips by video output
 */
export interface GetClipsByVideoOutput {
  videoId: string;
  clips: Clip[];
}

/**
 * Get clips by video use case
 * Retrieves all clips for a specific video
 */
export class GetClipsByVideoUseCase {
  private clipRepository: ClipRepositoryGateway;
  private videoRepository: VideoRepositoryGateway;

  constructor(
    clipRepository?: ClipRepositoryGateway,
    videoRepository?: VideoRepositoryGateway
  ) {
    this.clipRepository = clipRepository ?? new ClipRepository();
    this.videoRepository = videoRepository ?? new VideoRepository();
  }

  async execute(input: GetClipsByVideoInput): Promise<GetClipsByVideoOutput> {
    // Verify video exists
    const video = await this.videoRepository.findById(input.videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    const clips = await this.clipRepository.findByVideoId(input.videoId);

    return {
      videoId: input.videoId,
      clips,
    };
  }
}

/**
 * Get clip detail input
 */
export interface GetClipDetailInput {
  id: string;
}

/**
 * Get clip detail use case
 * Retrieves a single clip by ID
 */
export class GetClipDetailUseCase {
  private clipRepository: ClipRepositoryGateway;

  constructor(clipRepository?: ClipRepositoryGateway) {
    this.clipRepository = clipRepository ?? new ClipRepository();
  }

  async execute(input: GetClipDetailInput): Promise<Clip> {
    const clip = await this.clipRepository.findById(input.id);

    if (!clip) {
      throw new Error('Clip not found');
    }

    return clip;
  }
}
