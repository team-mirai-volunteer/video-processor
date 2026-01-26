import type { TranscriptionRepositoryGateway } from '../../domain/gateways/transcription-repository.gateway.js';
import type { TranscriptionGateway } from '../../domain/gateways/transcription.gateway.js';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { Transcription } from '../../domain/models/transcription.js';
import { createLogger } from '../../infrastructure/logging/logger.js';
import { NotFoundError } from '../errors.js';

const log = createLogger('TranscribeAudioUseCase');

export interface TranscribeAudioUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
  transcriptionRepository: TranscriptionRepositoryGateway;
  transcriptionGateway: TranscriptionGateway;
  generateId: () => string;
}

export interface TranscribeAudioInput {
  videoId: string;
  audioGcsUri: string;
  onProgress?: (percent: number) => void;
}

export interface TranscribeAudioResult {
  videoId: string;
  transcriptionId: string;
  fullText: string;
  segmentsCount: number;
  durationSeconds: number;
}

/**
 * UseCase for transcribing audio to text using Speech-to-Text API.
 *
 * Can be used:
 * - Standalone: to transcribe audio from any source
 * - As part of CreateTranscriptUseCase: after audio extraction
 */
export class TranscribeAudioUseCase {
  private readonly videoRepository: VideoRepositoryGateway;
  private readonly transcriptionRepository: TranscriptionRepositoryGateway;
  private readonly transcriptionGateway: TranscriptionGateway;
  private readonly generateId: () => string;

  constructor(deps: TranscribeAudioUseCaseDeps) {
    this.videoRepository = deps.videoRepository;
    this.transcriptionRepository = deps.transcriptionRepository;
    this.transcriptionGateway = deps.transcriptionGateway;
    this.generateId = deps.generateId;
  }

  /**
   * Transcribe audio from GCS URI
   * Efficient: audio is already in GCS, no upload required
   */
  async execute(input: TranscribeAudioInput): Promise<TranscribeAudioResult> {
    const { videoId, audioGcsUri, onProgress } = input;
    log.info('Starting execution', { videoId, audioGcsUri });

    // Get video to verify it exists
    const video = await this.videoRepository.findById(videoId);
    if (!video) {
      throw new NotFoundError('Video', videoId);
    }
    log.info('Found video', { videoId: video.id });

    // Transcribe audio from GCS URI (Batch API, no upload required)
    log.info('Starting transcription from GCS URI (Batch API)...');
    const transcriptionResult = await this.transcriptionGateway.transcribeLongAudioFromGcsUri({
      gcsUri: audioGcsUri,
      onProgress,
    });
    log.info('Transcription completed', {
      fullTextLength: transcriptionResult.fullText.length,
      segmentsCount: transcriptionResult.segments.length,
      durationSeconds: transcriptionResult.durationSeconds,
    });

    // Create Transcription domain object
    const transcriptionDomain = Transcription.create(
      {
        videoId: video.id,
        fullText: transcriptionResult.fullText,
        segments: transcriptionResult.segments,
        languageCode: transcriptionResult.languageCode,
        durationSeconds: transcriptionResult.durationSeconds,
      },
      this.generateId
    );

    if (!transcriptionDomain.success) {
      throw new Error(transcriptionDomain.error.message);
    }

    // Save transcription to database
    await this.transcriptionRepository.save(transcriptionDomain.value);
    log.info('Transcription saved', { transcriptionId: transcriptionDomain.value.id });

    return {
      videoId: video.id,
      transcriptionId: transcriptionDomain.value.id,
      fullText: transcriptionResult.fullText,
      segmentsCount: transcriptionResult.segments.length,
      durationSeconds: transcriptionResult.durationSeconds,
    };
  }
}
