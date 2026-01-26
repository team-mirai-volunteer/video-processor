import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { NotFoundError } from '../errors.js';
import type { CacheVideoUseCase } from './cache-video.usecase.js';
import type { ExtractAudioUseCase } from './extract-audio.usecase.js';
import type { RefineTranscriptUseCase } from './refine-transcript.usecase.js';
import type { TranscribeAudioUseCase } from './transcribe-audio.usecase.js';

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

  private log(message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const logData = data ? ` ${JSON.stringify(data)}` : '';
    console.log(`[CreateTranscriptUseCase] [${timestamp}] ${message}${logData}`);
  }

  async execute(videoId: string): Promise<CreateTranscriptResult> {
    this.log('Starting execution', { videoId });

    // Get video
    const video = await this.videoRepository.findById(videoId);
    if (!video) {
      throw new NotFoundError('Video', videoId);
    }
    this.log('Found video', { videoId: video.id, googleDriveFileId: video.googleDriveFileId });

    // Keep track of the latest video state for phase updates
    let currentVideo = video;

    try {
      // Update status to transcribing with downloading phase
      currentVideo = currentVideo.withStatus('transcribing').withTranscriptionPhase('downloading');
      await this.videoRepository.save(currentVideo);
      this.log('Status updated to transcribing, phase: downloading');

      // Step 1: Cache video (Drive -> GCS via stream)
      const cacheResult = await this.cacheVideoUseCase.execute(videoId);
      this.log('Video cached', {
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
      this.log('Phase updated to extracting_audio');

      // Step 2: Extract audio
      const audioResult = await this.extractAudioUseCase.execute(videoId, 'flac');
      this.log('Audio extracted', { sizeBytes: audioResult.audioBuffer.length });

      // Update phase to transcribing
      currentVideo = currentVideo.withTranscriptionPhase('transcribing');
      await this.videoRepository.save(currentVideo);
      this.log('Phase updated to transcribing');

      // Step 3: Transcribe audio
      const transcribeResult = await this.transcribeAudioUseCase.execute({
        videoId,
        audioBuffer: audioResult.audioBuffer,
        mimeType: 'audio/flac',
      });
      this.log('Transcription completed', {
        transcriptionId: transcribeResult.transcriptionId,
        segmentsCount: transcribeResult.segmentsCount,
      });

      // Step 4: Refine transcript (optional)
      if (this.refineTranscriptUseCase) {
        // Update phase to refining
        currentVideo = currentVideo.withTranscriptionPhase('refining');
        await this.videoRepository.save(currentVideo);
        this.log('Phase updated to refining');

        this.log('Starting transcript refinement...');
        try {
          await this.refineTranscriptUseCase.execute(videoId);
          this.log('Transcript refinement completed');
        } catch (refineError) {
          // Log but don't fail - refinement is optional
          this.log('Warning: Transcript refinement failed', {
            error: refineError instanceof Error ? refineError.message : 'Unknown error',
          });
        }
      }

      // Update video status to transcribed (phase will be cleared)
      currentVideo = currentVideo.withStatus('transcribed');
      await this.videoRepository.save(currentVideo);
      this.log('Video status updated to transcribed');

      return {
        videoId: currentVideo.id,
        transcriptionId: transcribeResult.transcriptionId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('Processing failed', { error: errorMessage });

      // Update video to failed
      await this.videoRepository.save(currentVideo.withStatus('failed', errorMessage));

      throw error;
    }
  }
}
