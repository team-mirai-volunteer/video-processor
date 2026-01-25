import type { StorageGateway } from '../../domain/gateways/storage.gateway.js';
import type { TempStorageGateway } from '../../domain/gateways/temp-storage.gateway.js';
import type { TranscriptionRepositoryGateway } from '../../domain/gateways/transcription-repository.gateway.js';
import type { TranscriptionGateway } from '../../domain/gateways/transcription.gateway.js';
import type { VideoProcessingGateway } from '../../domain/gateways/video-processing.gateway.js';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { Transcription } from '../../domain/models/transcription.js';
import { NotFoundError } from '../errors.js';

export interface CreateTranscriptUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
  transcriptionRepository: TranscriptionRepositoryGateway;
  storageGateway: StorageGateway;
  tempStorageGateway: TempStorageGateway;
  transcriptionGateway: TranscriptionGateway;
  videoProcessingGateway: VideoProcessingGateway;
  generateId: () => string;
}

export interface CreateTranscriptResult {
  videoId: string;
  transcriptionId: string;
}

export class CreateTranscriptUseCase {
  private readonly videoRepository: VideoRepositoryGateway;
  private readonly transcriptionRepository: TranscriptionRepositoryGateway;
  private readonly storageGateway: StorageGateway;
  private readonly tempStorageGateway: TempStorageGateway;
  private readonly transcriptionGateway: TranscriptionGateway;
  private readonly videoProcessingGateway: VideoProcessingGateway;
  private readonly generateId: () => string;

  constructor(deps: CreateTranscriptUseCaseDeps) {
    this.videoRepository = deps.videoRepository;
    this.transcriptionRepository = deps.transcriptionRepository;
    this.storageGateway = deps.storageGateway;
    this.tempStorageGateway = deps.tempStorageGateway;
    this.transcriptionGateway = deps.transcriptionGateway;
    this.videoProcessingGateway = deps.videoProcessingGateway;
    this.generateId = deps.generateId;
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

    try {
      // Update status to transcribing
      await this.videoRepository.save(video.withStatus('transcribing'));
      this.log('Status updated to transcribing');

      // Get video metadata from Google Drive
      this.log('Fetching video metadata from Google Drive...');
      const metadata = await this.storageGateway.getFileMetadata(video.googleDriveFileId);
      this.log('Got video metadata', {
        name: metadata.name,
        size: metadata.size,
        parents: metadata.parents,
      });

      const videoWithMetadataResult = video.withMetadata({
        title: metadata.name,
        fileSizeBytes: metadata.size,
      });
      if (videoWithMetadataResult.success) {
        await this.videoRepository.save(videoWithMetadataResult.value.withStatus('transcribing'));
      }

      // Get video buffer (from GCS if available, otherwise download from Google Drive)
      const videoBuffer = await this.getVideoBuffer(video);
      this.log('Video buffer ready', { sizeBytes: videoBuffer.length });

      // Extract audio from video (FLAC is smaller than WAV)
      this.log('Extracting audio from video...');
      const audioBuffer = await this.videoProcessingGateway.extractAudio(videoBuffer, 'flac');
      this.log('Audio extracted', { sizeBytes: audioBuffer.length });

      // Transcribe audio using Speech-to-Text (Batch API for long audio support)
      this.log('Starting transcription (Batch API)...');
      const transcriptionResult = await this.transcriptionGateway.transcribeLongAudio({
        audioBuffer,
        mimeType: 'audio/flac',
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

      // Update video status to transcribed
      const updatedVideo = videoWithMetadataResult.success
        ? videoWithMetadataResult.value.withStatus('transcribed')
        : video.withStatus('transcribed');
      await this.videoRepository.save(updatedVideo);
      this.log('Video status updated to transcribed');

      return {
        videoId: video.id,
        transcriptionId: transcriptionDomain.value.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('Processing failed', { error: errorMessage });

      // Update video to failed
      await this.videoRepository.save(video.withStatus('failed', errorMessage));

      throw error;
    }
  }

  /**
   * Get video buffer from GCS if available, otherwise download from Google Drive and cache to GCS
   */
  private async getVideoBuffer(
    video: ReturnType<typeof this.videoRepository.findById> extends Promise<infer T>
      ? NonNullable<T>
      : never
  ): Promise<Buffer> {
    // 1. Check if GCS has the video and it's not expired
    if (video.gcsUri && video.gcsExpiresAt && video.gcsExpiresAt > new Date()) {
      this.log('Checking GCS for cached video...', { gcsUri: video.gcsUri });
      const exists = await this.tempStorageGateway.exists(video.gcsUri);
      if (exists) {
        this.log('Found video in GCS, downloading...');
        return this.tempStorageGateway.download(video.gcsUri);
      }
    }

    // 2. Download from Google Drive
    this.log('Downloading video from Google Drive...');
    const buffer = await this.storageGateway.downloadFile(video.googleDriveFileId);
    this.log('Video downloaded', { sizeBytes: buffer.length });

    // 3. Upload to GCS for caching (don't fail if this fails)
    try {
      this.log('Uploading video to GCS for caching...');
      const { gcsUri, expiresAt } = await this.tempStorageGateway.upload({
        videoId: video.id,
        content: buffer,
      });
      this.log('Video cached in GCS', { gcsUri, expiresAt });

      // 4. Update video with GCS info
      const updatedVideo = video.withGcsInfo(gcsUri, expiresAt);
      await this.videoRepository.save(updatedVideo);
    } catch (cacheError) {
      // Log but don't fail - caching is optional
      this.log('Warning: Failed to cache video in GCS', {
        error: cacheError instanceof Error ? cacheError.message : 'Unknown error',
      });
    }

    return buffer;
  }
}
