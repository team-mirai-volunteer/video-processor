import type { TranscriptionRepositoryGateway } from '../../domain/gateways/transcription-repository.gateway.js';
import type { TranscriptionGateway } from '../../domain/gateways/transcription.gateway.js';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { Transcription } from '../../domain/models/transcription.js';
import { NotFoundError } from '../errors.js';

export interface TranscribeAudioUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
  transcriptionRepository: TranscriptionRepositoryGateway;
  transcriptionGateway: TranscriptionGateway;
  generateId: () => string;
}

export interface TranscribeAudioInput {
  videoId: string;
  audioBuffer: Buffer;
  mimeType: 'audio/wav' | 'audio/flac';
}

export interface TranscribeAudioFromGcsInput {
  videoId: string;
  audioGcsUri: string;
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

  private log(message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const logData = data ? ` ${JSON.stringify(data)}` : '';
    console.log(`[TranscribeAudioUseCase] [${timestamp}] ${message}${logData}`);
  }

  async execute(input: TranscribeAudioInput): Promise<TranscribeAudioResult> {
    const { videoId, audioBuffer, mimeType } = input;
    this.log('Starting execution', { videoId, mimeType, audioSizeBytes: audioBuffer.length });

    // Get video to verify it exists
    const video = await this.videoRepository.findById(videoId);
    if (!video) {
      throw new NotFoundError('Video', videoId);
    }
    this.log('Found video', { videoId: video.id });

    // Transcribe audio using Speech-to-Text (Batch API for long audio support)
    this.log('Starting transcription (Batch API)...');
    const transcriptionResult = await this.transcriptionGateway.transcribeLongAudio({
      audioBuffer,
      mimeType,
    });
    this.log('Transcription completed', {
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
    this.log('Transcription saved', { transcriptionId: transcriptionDomain.value.id });

    return {
      videoId: video.id,
      transcriptionId: transcriptionDomain.value.id,
      fullText: transcriptionResult.fullText,
      segmentsCount: transcriptionResult.segments.length,
      durationSeconds: transcriptionResult.durationSeconds,
    };
  }

  /**
   * Transcribe audio from GCS URI
   * More efficient when audio is already in GCS (no upload required)
   */
  async executeWithGcsUri(input: TranscribeAudioFromGcsInput): Promise<TranscribeAudioResult> {
    const { videoId, audioGcsUri } = input;
    this.log('Starting execution with GCS URI', { videoId, audioGcsUri });

    // Get video to verify it exists
    const video = await this.videoRepository.findById(videoId);
    if (!video) {
      throw new NotFoundError('Video', videoId);
    }
    this.log('Found video', { videoId: video.id });

    // Transcribe audio from GCS URI (Batch API, no upload required)
    this.log('Starting transcription from GCS URI (Batch API)...');
    const transcriptionResult = await this.transcriptionGateway.transcribeLongAudioFromGcsUri({
      gcsUri: audioGcsUri,
    });
    this.log('Transcription completed', {
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
    this.log('Transcription saved', { transcriptionId: transcriptionDomain.value.id });

    return {
      videoId: video.id,
      transcriptionId: transcriptionDomain.value.id,
      fullText: transcriptionResult.fullText,
      segmentsCount: transcriptionResult.segments.length,
      durationSeconds: transcriptionResult.durationSeconds,
    };
  }
}
