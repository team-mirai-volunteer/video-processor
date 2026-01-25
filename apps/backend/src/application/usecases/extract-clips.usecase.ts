import type { ExtractClipsResponse } from '@video-processor/shared';
import type { AiGateway } from '../../domain/gateways/ai.gateway.js';
import type { ClipRepositoryGateway } from '../../domain/gateways/clip-repository.gateway.js';
import type { StorageGateway } from '../../domain/gateways/storage.gateway.js';
import type { TempStorageGateway } from '../../domain/gateways/temp-storage.gateway.js';
import type { TranscriptionRepositoryGateway } from '../../domain/gateways/transcription-repository.gateway.js';
import type { VideoProcessingGateway } from '../../domain/gateways/video-processing.gateway.js';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { Clip } from '../../domain/models/clip.js';
import type { Video } from '../../domain/models/video.js';
import { ClipAnalysisPromptService } from '../../domain/services/clip-analysis-prompt.service.js';
import { TimestampExtractorService } from '../../domain/services/timestamp-extractor.service.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { CLIP_ERROR_CODES, createClipError } from '../errors/clip.errors.js';

export interface ExtractClipsInput {
  videoId: string;
  clipInstructions: string;
}

export interface ExtractClipsUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
  clipRepository: ClipRepositoryGateway;
  transcriptionRepository: TranscriptionRepositoryGateway;
  storageGateway: StorageGateway;
  tempStorageGateway: TempStorageGateway;
  aiGateway: AiGateway;
  videoProcessingGateway: VideoProcessingGateway;
  generateId: () => string;
  /** Optional: Default output folder ID for clips (shared drive folder recommended) */
  outputFolderId?: string;
}

export class ExtractClipsUseCase {
  private readonly videoRepository: VideoRepositoryGateway;
  private readonly clipRepository: ClipRepositoryGateway;
  private readonly transcriptionRepository: TranscriptionRepositoryGateway;
  private readonly storageGateway: StorageGateway;
  private readonly tempStorageGateway: TempStorageGateway;
  private readonly aiGateway: AiGateway;
  private readonly videoProcessingGateway: VideoProcessingGateway;
  private readonly timestampExtractor: TimestampExtractorService;
  private readonly clipAnalysisPromptService: ClipAnalysisPromptService;
  private readonly generateId: () => string;
  private readonly outputFolderId?: string;

  constructor(deps: ExtractClipsUseCaseDeps) {
    this.videoRepository = deps.videoRepository;
    this.clipRepository = deps.clipRepository;
    this.transcriptionRepository = deps.transcriptionRepository;
    this.storageGateway = deps.storageGateway;
    this.tempStorageGateway = deps.tempStorageGateway;
    this.aiGateway = deps.aiGateway;
    this.videoProcessingGateway = deps.videoProcessingGateway;
    this.timestampExtractor = new TimestampExtractorService();
    this.clipAnalysisPromptService = new ClipAnalysisPromptService();
    this.generateId = deps.generateId;
    this.outputFolderId = deps.outputFolderId;
  }

  private log(message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const logData = data ? ` ${JSON.stringify(data)}` : '';
    console.log(`[ExtractClipsUseCase] [${timestamp}] ${message}${logData}`);
  }

  async execute(input: ExtractClipsInput): Promise<ExtractClipsResponse> {
    const { videoId, clipInstructions } = input;
    this.log('Starting execution', {
      videoId,
      clipInstructions: clipInstructions.substring(0, 100),
    });

    // Validate input
    if (!clipInstructions.trim()) {
      throw new ValidationError('clipInstructions is required');
    }

    // 1. Get video
    const video = await this.videoRepository.findById(videoId);
    if (!video) {
      throw new NotFoundError('Video', videoId);
    }
    this.log('Found video', { videoId: video.id, status: video.status });

    // 2. Get transcription
    const transcription = await this.transcriptionRepository.findByVideoId(videoId);
    if (!transcription) {
      const error = createClipError(
        CLIP_ERROR_CODES.TRANSCRIPTION_NOT_FOUND,
        `Transcription not found for video ${videoId}. Please run transcription first.`
      );
      throw new ValidationError(error.message);
    }
    this.log('Found transcription', {
      transcriptionId: transcription.id,
      segmentsCount: transcription.segments.length,
    });

    try {
      // Update video status to extracting
      await this.videoRepository.save(video.withStatus('extracting'));
      this.log('Status updated to extracting');

      // 3. Get video metadata
      const metadata = await this.storageGateway.getFileMetadata(video.googleDriveFileId);
      this.log('Got video metadata', { name: metadata.name });

      // 4. AI analysis (clip point suggestion)
      this.log('Building prompt and calling AI...');
      const prompt = this.clipAnalysisPromptService.buildPrompt({
        transcription: {
          fullText: transcription.fullText,
          segments: transcription.segments,
          languageCode: transcription.languageCode,
          durationSeconds: transcription.durationSeconds,
        },
        videoTitle: video.title ?? metadata.name,
        clipInstructions,
      });
      const aiResponseText = await this.aiGateway.generate(prompt);
      this.log('AI response received', { responseLength: aiResponseText.length });
      const aiResponse = this.clipAnalysisPromptService.parseResponse(aiResponseText);
      this.log('AI response parsed', { clipsCount: aiResponse.clips.length });

      // 5. Extract timestamps
      const timestamps = this.timestampExtractor.extractTimestamps(aiResponse.clips);
      this.log('Timestamps extracted', { timestampsCount: timestamps.length });

      // 6. Get video buffer (from GCS or Google Drive)
      const videoBuffer = await this.getVideoBuffer(video);
      this.log('Video buffer obtained', { sizeBytes: videoBuffer.length });

      // 7. Create clips
      const clips: Clip[] = [];
      for (const ts of timestamps) {
        const clipResult = Clip.createWithFlexibleDuration(
          {
            videoId: video.id,
            title: ts.title,
            startTimeSeconds: ts.startTimeSeconds,
            endTimeSeconds: ts.endTimeSeconds,
            transcript: ts.transcript,
          },
          this.generateId
        );

        if (clipResult.success) {
          clips.push(clipResult.value);
        }
      }
      this.log('Clips created', { clipsCount: clips.length });

      await this.clipRepository.saveMany(clips);

      // 8. Get or create output folder
      const parentFolder = this.outputFolderId ?? metadata.parents?.[0];
      this.log('Determining output folder', {
        configuredOutputFolderId: this.outputFolderId,
        selectedParentFolder: parentFolder,
      });
      const shortsFolder = await this.storageGateway.findOrCreateFolder('ショート用', parentFolder);
      this.log('Output folder ready', { shortsFolderId: shortsFolder.id });

      // 9. Process each clip
      for (const [i, clip] of clips.entries()) {
        this.log(`Processing clip ${i + 1}/${clips.length}`, {
          clipId: clip.id,
          title: clip.title,
          startTime: clip.startTimeSeconds,
          endTime: clip.endTimeSeconds,
        });
        try {
          // Update clip status
          await this.clipRepository.save(clip.withStatus('processing'));

          // Extract clip using FFmpeg
          this.log(`Extracting clip ${i + 1}...`);
          const clipBuffer = await this.videoProcessingGateway.extractClip(
            videoBuffer,
            clip.startTimeSeconds,
            clip.endTimeSeconds
          );
          this.log(`Clip ${i + 1} extracted`, { sizeBytes: clipBuffer.length });

          // Upload clip
          const fileName = `${clip.title ?? clip.id}.mp4`;
          this.log(`Uploading clip ${i + 1}...`, { fileName, parentFolderId: shortsFolder.id });
          const uploadedFile = await this.storageGateway.uploadFile({
            name: fileName,
            mimeType: 'video/mp4',
            content: clipBuffer,
            parentFolderId: shortsFolder.id,
          });
          this.log(`Clip ${i + 1} uploaded`, {
            fileId: uploadedFile.id,
            webViewLink: uploadedFile.webViewLink,
          });

          // Update clip with Google Drive info
          const completedClip = clip
            .withGoogleDriveInfo(uploadedFile.id, uploadedFile.webViewLink)
            .withStatus('completed');
          await this.clipRepository.save(completedClip);
          this.log(`Clip ${i + 1} completed`);
        } catch (clipError) {
          const errorMessage =
            clipError instanceof Error ? clipError.message : 'Unknown error processing clip';
          this.log(`Clip ${i + 1} failed`, { error: errorMessage });
          await this.clipRepository.save(clip.withStatus('failed', errorMessage));
        }
      }

      // 10. Create metadata file
      this.log('Creating metadata file...');
      const metadataContent = {
        videoId: video.id,
        videoTitle: metadata.name,
        clipInstructions,
        clips: clips.map((c) => ({
          id: c.id,
          title: c.title,
          startTimeSeconds: c.startTimeSeconds,
          endTimeSeconds: c.endTimeSeconds,
          transcript: c.transcript,
        })),
        processedAt: new Date().toISOString(),
      };

      await this.storageGateway.uploadFile({
        name: `${video.id}_clips_metadata.json`,
        mimeType: 'application/json',
        content: Buffer.from(JSON.stringify(metadataContent, null, 2)),
        parentFolderId: shortsFolder.id,
      });
      this.log('Metadata file uploaded');

      // 11. Update video to completed
      await this.videoRepository.save(video.withStatus('completed'));
      this.log('Processing completed successfully');

      return {
        videoId: video.id,
        status: 'completed',
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
   * Get video buffer from GCS (if available) or Google Drive
   * フォールバック戦略: GCS → Google Drive
   */
  private async getVideoBuffer(video: Video): Promise<Buffer> {
    // Note: video.gcsUri is expected to be added by Session A
    // For now, we check if tempStorageGateway can be used
    // If GCS URI is not available, download from Google Drive

    // TODO: Once Session A implements gcsUri on Video model, use:
    // if (video.gcsUri && await this.tempStorageGateway.exists(video.gcsUri)) {
    //   return this.tempStorageGateway.download(video.gcsUri);
    // }

    // Download from Google Drive
    this.log('Downloading video from Google Drive...');
    const buffer = await this.storageGateway.downloadFile(video.googleDriveFileId);
    this.log('Video downloaded', { sizeBytes: buffer.length });

    // Try to save to GCS for future use (best effort)
    try {
      const { gcsUri, expiresAt } = await this.tempStorageGateway.upload({
        videoId: video.id,
        content: buffer,
      });
      this.log('Video saved to GCS', { gcsUri, expiresAt });
      // Note: VideoレコードへのGCS情報保存はSession Aがモデル拡張後に実装
    } catch (gcsError) {
      // GCS upload failure is not critical, continue with the buffer
      this.log('GCS upload failed (non-critical)', {
        error: gcsError instanceof Error ? gcsError.message : 'Unknown error',
      });
    }

    return buffer;
  }
}
