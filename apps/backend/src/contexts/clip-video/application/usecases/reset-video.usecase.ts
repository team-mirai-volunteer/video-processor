import type { RefinedTranscriptionRepositoryGateway } from '@clip-video/domain/gateways/refined-transcription-repository.gateway.js';
import type { TranscriptionRepositoryGateway } from '@clip-video/domain/gateways/transcription-repository.gateway.js';
import type { VideoRepositoryGateway } from '@clip-video/domain/gateways/video-repository.gateway.js';
import type { Video } from '@clip-video/domain/models/video.js';
import { createLogger } from '@shared/infrastructure/logging/logger.js';
import type { VideoStatus } from '@video-processor/shared';
import { NotFoundError } from '../errors/errors.js';

const log = createLogger('ResetVideoUseCase');

/**
 * Reset step options:
 * - 'cache': Reset from step 1 (clear gcsUri and all subsequent data)
 * - 'audio': Reset from step 2 (keep cache, clear transcription and refinement)
 * - 'transcribe': Reset from step 3 (keep cache, clear transcription and refinement)
 * - 'refine': Reset from step 4 (keep cache and transcription, clear only refinement)
 * - 'all': Full reset (same as 'cache')
 */
export type ResetStep = 'cache' | 'audio' | 'transcribe' | 'refine' | 'all';

export interface ResetVideoUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
  transcriptionRepository: TranscriptionRepositoryGateway;
  refinedTranscriptionRepository: RefinedTranscriptionRepositoryGateway;
}

export interface ResetVideoResult {
  videoId: string;
  status: VideoStatus;
  resetStep: ResetStep;
}

/**
 * UseCase for resetting a video to a specific step.
 * Allows partial reset to re-run specific processing steps.
 */
export class ResetVideoUseCase {
  private readonly videoRepository: VideoRepositoryGateway;
  private readonly transcriptionRepository: TranscriptionRepositoryGateway;
  private readonly refinedTranscriptionRepository: RefinedTranscriptionRepositoryGateway;

  constructor(deps: ResetVideoUseCaseDeps) {
    this.videoRepository = deps.videoRepository;
    this.transcriptionRepository = deps.transcriptionRepository;
    this.refinedTranscriptionRepository = deps.refinedTranscriptionRepository;
  }

  async execute(videoId: string, step: ResetStep = 'all'): Promise<ResetVideoResult> {
    log.info('Resetting video', { videoId, step });

    const video = await this.videoRepository.findById(videoId);
    if (!video) {
      throw new NotFoundError('Video', videoId);
    }

    let updatedVideo: Video;

    switch (step) {
      case 'refine':
        // Only clear refined transcription
        await this.clearRefinedTranscription(videoId);
        updatedVideo = video.withStatus('transcribed').withProgressMessage(null);
        break;

      case 'transcribe':
      case 'audio':
        // Clear transcription and refinement, keep cache
        await this.clearTranscription(videoId);
        updatedVideo = video.withStatus('pending').withProgressMessage(null);
        break;

      case 'cache':
      case 'all':
        // Full reset
        await this.clearTranscription(videoId);
        updatedVideo = video.reset();
        break;
    }

    await this.videoRepository.save(updatedVideo);
    log.info('Video reset complete', { videoId, step, newStatus: updatedVideo.status });

    return {
      videoId,
      status: updatedVideo.status,
      resetStep: step,
    };
  }

  private async clearRefinedTranscription(videoId: string): Promise<void> {
    const transcription = await this.transcriptionRepository.findByVideoId(videoId);
    if (transcription) {
      log.info('Deleting refined transcription', { transcriptionId: transcription.id });
      await this.refinedTranscriptionRepository.deleteByTranscriptionId(transcription.id);
    }
  }

  private async clearTranscription(videoId: string): Promise<void> {
    log.info('Deleting transcription if exists', { videoId });
    await this.transcriptionRepository.deleteByVideoId(videoId);
  }
}
