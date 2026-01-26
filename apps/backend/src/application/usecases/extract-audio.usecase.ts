import type { TempStorageGateway } from '../../domain/gateways/temp-storage.gateway.js';
import type { VideoProcessingGateway } from '../../domain/gateways/video-processing.gateway.js';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { NotFoundError } from '../errors.js';

export interface ExtractAudioUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
  tempStorageGateway: TempStorageGateway;
  videoProcessingGateway: VideoProcessingGateway;
}

export interface ExtractAudioResult {
  videoId: string;
  audioBuffer: Buffer;
  format: 'wav' | 'flac';
}

/**
 * UseCase for extracting audio from a cached video.
 * Requires video to be already cached in GCS.
 *
 * Can be used:
 * - Standalone: to extract audio for other purposes
 * - As part of CreateTranscriptUseCase: to get audio for transcription
 */
export class ExtractAudioUseCase {
  private readonly videoRepository: VideoRepositoryGateway;
  private readonly tempStorageGateway: TempStorageGateway;
  private readonly videoProcessingGateway: VideoProcessingGateway;

  constructor(deps: ExtractAudioUseCaseDeps) {
    this.videoRepository = deps.videoRepository;
    this.tempStorageGateway = deps.tempStorageGateway;
    this.videoProcessingGateway = deps.videoProcessingGateway;
  }

  private log(message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const logData = data ? ` ${JSON.stringify(data)}` : '';
    console.log(`[ExtractAudioUseCase] [${timestamp}] ${message}${logData}`);
  }

  async execute(videoId: string, format: 'wav' | 'flac' = 'flac'): Promise<ExtractAudioResult> {
    this.log('Starting execution', { videoId, format });

    // Get video
    const video = await this.videoRepository.findById(videoId);
    if (!video) {
      throw new NotFoundError('Video', videoId);
    }
    this.log('Found video', { videoId: video.id });

    // Check if video is cached
    if (!video.gcsUri) {
      throw new Error(`Video ${videoId} is not cached in GCS. Run CacheVideoUseCase first.`);
    }

    // Check if cache exists
    const exists = await this.tempStorageGateway.exists(video.gcsUri);
    if (!exists) {
      throw new Error(
        `Video cache not found at ${video.gcsUri}. Cache may have expired. Run CacheVideoUseCase again.`
      );
    }

    // Download video from GCS
    this.log('Downloading video from GCS...', { gcsUri: video.gcsUri });
    const videoBuffer = await this.tempStorageGateway.download(video.gcsUri);
    this.log('Video downloaded', { sizeBytes: videoBuffer.length });

    // Extract audio
    this.log('Extracting audio...', { format });
    const audioBuffer = await this.videoProcessingGateway.extractAudio(videoBuffer, format);
    this.log('Audio extracted', { sizeBytes: audioBuffer.length });

    return {
      videoId: video.id,
      audioBuffer,
      format,
    };
  }
}
