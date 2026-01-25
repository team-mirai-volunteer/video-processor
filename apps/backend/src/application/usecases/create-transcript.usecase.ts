import type { StorageGateway } from '../../domain/gateways/storage.gateway.js';
import type { TempStorageGateway } from '../../domain/gateways/temp-storage.gateway.js';
import type { TranscriptionRepositoryGateway } from '../../domain/gateways/transcription-repository.gateway.js';
import type { TranscriptionGateway } from '../../domain/gateways/transcription.gateway.js';
import type { VideoProcessingGateway } from '../../domain/gateways/video-processing.gateway.js';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { Transcription } from '../../domain/models/transcription.js';
import { NotFoundError } from '../errors.js';
import type { RefineTranscriptUseCase } from './refine-transcript.usecase.js';

export interface CreateTranscriptUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
  transcriptionRepository: TranscriptionRepositoryGateway;
  storageGateway: StorageGateway;
  tempStorageGateway: TempStorageGateway;
  transcriptionGateway: TranscriptionGateway;
  videoProcessingGateway: VideoProcessingGateway;
  generateId: () => string;
  refineTranscriptUseCase?: RefineTranscriptUseCase;
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
  private readonly refineTranscriptUseCase?: RefineTranscriptUseCase;

  constructor(deps: CreateTranscriptUseCaseDeps) {
    this.videoRepository = deps.videoRepository;
    this.transcriptionRepository = deps.transcriptionRepository;
    this.storageGateway = deps.storageGateway;
    this.tempStorageGateway = deps.tempStorageGateway;
    this.transcriptionGateway = deps.transcriptionGateway;
    this.videoProcessingGateway = deps.videoProcessingGateway;
    this.generateId = deps.generateId;
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

      // Get video buffer (from GCS if available, otherwise download from Google Drive)
      const videoBuffer = await this.getVideoBuffer(currentVideo);
      this.log('Video buffer ready', { sizeBytes: videoBuffer.length });

      // Update phase to extracting_audio
      currentVideo = currentVideo.withTranscriptionPhase('extracting_audio');
      await this.videoRepository.save(currentVideo);
      this.log('Phase updated to extracting_audio');

      // Extract audio from video (FLAC is smaller than WAV)
      this.log('Extracting audio from video...');
      const audioBuffer = await this.videoProcessingGateway.extractAudio(videoBuffer, 'flac');
      this.log('Audio extracted', { sizeBytes: audioBuffer.length });

      // Update phase to transcribing
      currentVideo = currentVideo.withTranscriptionPhase('transcribing');
      await this.videoRepository.save(currentVideo);
      this.log('Phase updated to transcribing');

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

      // Update phase to saving
      currentVideo = currentVideo.withTranscriptionPhase('saving');
      await this.videoRepository.save(currentVideo);
      this.log('Phase updated to saving');

      // Create Transcription domain object
      const transcriptionDomain = Transcription.create(
        {
          videoId: currentVideo.id,
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

      // Refine transcript if refineTranscriptUseCase is provided
      // Note: refined transcript will be uploaded to Google Drive by RefineTranscriptUseCase
      if (this.refineTranscriptUseCase) {
        // Update phase to refining
        currentVideo = currentVideo.withTranscriptionPhase('refining');
        await this.videoRepository.save(currentVideo);
        this.log('Phase updated to refining');

        this.log('Starting transcript refinement...');
        try {
          await this.refineTranscriptUseCase.execute(currentVideo.id);
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
        transcriptionId: transcriptionDomain.value.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('Processing failed', { error: errorMessage });

      // Update video to failed
      await this.videoRepository.save(currentVideo.withStatus('failed', errorMessage));

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
