import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { createLogger } from '../../infrastructure/logging/logger.js';
import { NotFoundError } from '../errors.js';
import type { CacheVideoUseCase } from './cache-video.usecase.js';
import type { ExtractAudioUseCase } from './extract-audio.usecase.js';
import type { RefineTranscriptUseCase } from './refine-transcript.usecase.js';
import type { TranscribeAudioUseCase } from './transcribe-audio.usecase.js';

const log = createLogger('CreateTranscriptUseCase');

export interface CreateTranscriptUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
  cacheVideoUseCase: CacheVideoUseCase;
  extractAudioUseCase: ExtractAudioUseCase;
  transcribeAudioUseCase: TranscribeAudioUseCase;
  refineTranscriptUseCase?: RefineTranscriptUseCase;
}

export interface CreateTranscriptResult {
  videoId: string;
  transcriptionId: string;
}

/**
 * Orchestrator UseCase that combines all transcription steps:
 * 1. Cache video (Drive -> GCS)
 * 2. Extract audio (GCS -> audio buffer)
 * 3. Transcribe audio (audio -> text)
 * 4. Refine transcript (optional)
 *
 * Each step can also be executed independently via individual UseCases.
 */
export class CreateTranscriptUseCase {
  private readonly videoRepository: VideoRepositoryGateway;
  private readonly cacheVideoUseCase: CacheVideoUseCase;
  private readonly extractAudioUseCase: ExtractAudioUseCase;
  private readonly transcribeAudioUseCase: TranscribeAudioUseCase;
  private readonly refineTranscriptUseCase?: RefineTranscriptUseCase;

  constructor(deps: CreateTranscriptUseCaseDeps) {
    this.videoRepository = deps.videoRepository;
    this.cacheVideoUseCase = deps.cacheVideoUseCase;
    this.extractAudioUseCase = deps.extractAudioUseCase;
    this.transcribeAudioUseCase = deps.transcribeAudioUseCase;
    this.refineTranscriptUseCase = deps.refineTranscriptUseCase;
  }

  async execute(videoId: string): Promise<CreateTranscriptResult> {
    log.info('Starting execution', { videoId });

    // Get video
    const video = await this.videoRepository.findById(videoId);
    if (!video) {
      throw new NotFoundError('Video', videoId);
    }
    log.info('Found video', { videoId: video.id, googleDriveFileId: video.googleDriveFileId });

    // Keep track of the latest video state for phase updates
    let currentVideo = video;

    try {
      // Update status to transcribing with downloading phase
      currentVideo = currentVideo.withStatus('transcribing').withTranscriptionPhase('downloading');
      await this.videoRepository.save(currentVideo);
      log.info('Status updated to transcribing, phase: downloading');

      // Step 1: Cache video (Drive -> GCS via stream)
      const cacheResult = await this.cacheVideoUseCase.execute(videoId);
      log.info('Video cached', {
        gcsUri: cacheResult.gcsUri,
        cached: cacheResult.cached,
      });

      // Re-fetch video to get updated gcsUri from CacheVideoUseCase
      const cachedVideo = await this.videoRepository.findById(videoId);
      if (!cachedVideo) {
        throw new NotFoundError('Video', videoId);
      }
      currentVideo = cachedVideo;

      // Update phase to extracting_audio
      currentVideo = currentVideo.withTranscriptionPhase('extracting_audio');
      await this.videoRepository.save(currentVideo);
      log.info('Phase updated to extracting_audio');

      // Step 2: Extract audio (stream version - memory efficient)
      const audioResult = await this.extractAudioUseCase.execute(videoId, 'flac');
      log.info('Audio extracted and uploaded to GCS', { audioGcsUri: audioResult.audioGcsUri });

      // Update phase to transcribing
      currentVideo = currentVideo.withTranscriptionPhase('transcribing');
      await this.videoRepository.save(currentVideo);
      log.info('Phase updated to transcribing');

      // Step 3: Transcribe audio from GCS URI (no re-upload required)
      const transcribeResult = await this.transcribeAudioUseCase.execute({
        videoId,
        audioGcsUri: audioResult.audioGcsUri,
      });
      log.info('Transcription completed', {
        transcriptionId: transcribeResult.transcriptionId,
        segmentsCount: transcribeResult.segmentsCount,
      });

      // Step 4: Refine transcript (optional)
      if (this.refineTranscriptUseCase) {
        // Update phase to refining
        currentVideo = currentVideo.withTranscriptionPhase('refining');
        await this.videoRepository.save(currentVideo);
        log.info('Phase updated to refining');

        log.info('Starting transcript refinement...');
        try {
          await this.refineTranscriptUseCase.execute(videoId);
          log.info('Transcript refinement completed');
        } catch (refineError) {
          // Log but don't fail - refinement is optional
          log.warn('Transcript refinement failed', {
            error: refineError instanceof Error ? refineError.message : 'Unknown error',
          });
        }
      }

      // Update video status to transcribed (phase will be cleared)
      currentVideo = currentVideo.withStatus('transcribed');
      await this.videoRepository.save(currentVideo);
      log.info('Video status updated to transcribed');

      return {
        videoId: currentVideo.id,
        transcriptionId: transcribeResult.transcriptionId,
      };
    } catch (error) {
      log.error('Processing failed', error as Error, { videoId });

      // Update video to failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.videoRepository.save(currentVideo.withStatus('failed', errorMessage));

      throw error;
    }
  }
}
