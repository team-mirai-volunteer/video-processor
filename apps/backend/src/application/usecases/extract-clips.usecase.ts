import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { ExtractClipsResponse } from '@video-processor/shared';
import type { AiGateway } from '../../domain/gateways/ai.gateway.js';
import type { ClipRepositoryGateway } from '../../domain/gateways/clip-repository.gateway.js';
import type { RefinedTranscriptionRepositoryGateway } from '../../domain/gateways/refined-transcription-repository.gateway.js';
import type { StorageGateway } from '../../domain/gateways/storage.gateway.js';
import type { TempStorageGateway } from '../../domain/gateways/temp-storage.gateway.js';
import type { TranscriptionRepositoryGateway } from '../../domain/gateways/transcription-repository.gateway.js';
import type { VideoProcessingGateway } from '../../domain/gateways/video-processing.gateway.js';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { Clip } from '../../domain/models/clip.js';
import type { Video } from '../../domain/models/video.js';
import { ClipAnalysisPromptService } from '../../domain/services/clip-analysis-prompt.service.js';
import { TimestampExtractorService } from '../../domain/services/timestamp-extractor.service.js';
import { createLogger } from '../../infrastructure/logging/logger.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { CLIP_ERROR_CODES, createClipError } from '../errors/clip.errors.js';

const log = createLogger('ExtractClipsUseCase');

export interface ExtractClipsInput {
  videoId: string;
  clipInstructions: string;
  /** true=複数クリップを許可, false=単一クリップのみ (デフォルト: false) */
  multipleClips?: boolean;
}

export interface ExtractClipsUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
  clipRepository: ClipRepositoryGateway;
  transcriptionRepository: TranscriptionRepositoryGateway;
  refinedTranscriptionRepository: RefinedTranscriptionRepositoryGateway;
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
  private readonly refinedTranscriptionRepository: RefinedTranscriptionRepositoryGateway;
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
    this.refinedTranscriptionRepository = deps.refinedTranscriptionRepository;
    this.storageGateway = deps.storageGateway;
    this.tempStorageGateway = deps.tempStorageGateway;
    this.aiGateway = deps.aiGateway;
    this.videoProcessingGateway = deps.videoProcessingGateway;
    this.timestampExtractor = new TimestampExtractorService();
    this.clipAnalysisPromptService = new ClipAnalysisPromptService();
    this.generateId = deps.generateId;
    this.outputFolderId = deps.outputFolderId;
  }

  async execute(input: ExtractClipsInput): Promise<ExtractClipsResponse> {
    const { videoId, clipInstructions, multipleClips = false } = input;
    log.info('Starting execution', {
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
    log.info('Found video', { videoId: video.id, status: video.status });

    // 2. Get transcription (for durationSeconds)
    const transcription = await this.transcriptionRepository.findByVideoId(videoId);
    if (!transcription) {
      const error = createClipError(
        CLIP_ERROR_CODES.TRANSCRIPTION_NOT_FOUND,
        `Transcription not found for video ${videoId}. Please run transcription first.`
      );
      throw new ValidationError(error.message);
    }
    log.info('Found transcription', {
      transcriptionId: transcription.id,
      segmentsCount: transcription.segments.length,
    });

    // 3. Get refined transcription (required for clip extraction)
    const refinedTranscription = await this.refinedTranscriptionRepository.findByTranscriptionId(
      transcription.id
    );
    if (!refinedTranscription) {
      const error = createClipError(
        CLIP_ERROR_CODES.REFINED_TRANSCRIPTION_NOT_FOUND,
        `Refined transcription not found for video ${videoId}. Please run transcript refinement first.`
      );
      throw new ValidationError(error.message);
    }
    log.info('Found refined transcription', {
      refinedTranscriptionId: refinedTranscription.id,
      sentencesCount: refinedTranscription.sentences.length,
    });

    try {
      // Update video status to extracting
      await this.videoRepository.save(video.withStatus('extracting'));
      log.info('Status updated to extracting');

      // 3. Get video metadata
      const metadata = await this.storageGateway.getFileMetadata(video.googleDriveFileId);
      log.info('Got video metadata', { name: metadata.name });

      // 4. AI analysis (clip point suggestion)
      log.info('Building prompt and calling AI...', { multipleClips });
      const prompt = this.clipAnalysisPromptService.buildPrompt({
        refinedTranscription: {
          fullText: refinedTranscription.fullText,
          sentences: refinedTranscription.sentences,
          durationSeconds: transcription.durationSeconds,
        },
        videoTitle: video.title ?? metadata.name,
        clipInstructions,
        multipleClips,
      });
      const aiResponseText = await this.aiGateway.generate(prompt);
      log.info('AI response received', { responseLength: aiResponseText.length });
      const aiResponse = this.clipAnalysisPromptService.parseResponse(aiResponseText);
      log.info('AI response parsed', { clipsCount: aiResponse.clips.length });

      // 5. Extract timestamps
      const timestamps = this.timestampExtractor.extractTimestamps(aiResponse.clips);
      log.info('Timestamps extracted', { timestampsCount: timestamps.length });

      // 6. Prepare video file (from GCS cache or Google Drive)
      const { localPath: sourceVideoPath, video: updatedVideo } =
        await this.prepareVideoFile(video);
      const tempDir = path.dirname(sourceVideoPath);
      log.info('Video file prepared', { sourceVideoPath });

      try {
        // 7. Create clips
        const clips: Clip[] = [];
        for (const ts of timestamps) {
          const clipResult = Clip.createWithFlexibleDuration(
            {
              videoId: updatedVideo.id,
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
        log.info('Clips created', { clipsCount: clips.length });

        await this.clipRepository.saveMany(clips);

        // 8. Get or create output folder
        // Prefer video's parent folder, fallback to outputFolderId for integration tests
        const parentFolder = metadata.parents?.[0] ?? this.outputFolderId;
        log.info('Determining output folder', {
          videoParentFolder: metadata.parents?.[0],
          fallbackOutputFolderId: this.outputFolderId,
          selectedParentFolder: parentFolder,
        });
        const shortsFolder = await this.storageGateway.findOrCreateFolder(
          'ショート用',
          parentFolder
        );
        log.info('Output folder ready', { shortsFolderId: shortsFolder.id });

        // 9. Process each clip using file-based extraction
        for (const [i, clip] of clips.entries()) {
          log.info(`Processing clip ${i + 1}/${clips.length}`, {
            clipId: clip.id,
            title: clip.title,
            startTime: clip.startTimeSeconds,
            endTime: clip.endTimeSeconds,
          });

          const clipOutputPath = path.join(tempDir, `clip_${i}.mp4`);

          try {
            // Update clip status
            await this.clipRepository.save(clip.withStatus('processing'));

            // Extract clip using FFmpeg (file-based, memory efficient)
            log.info(`Extracting clip ${i + 1}...`);
            await this.videoProcessingGateway.extractClipFromFile(
              sourceVideoPath,
              clipOutputPath,
              clip.startTimeSeconds,
              clip.endTimeSeconds
            );

            const clipStats = await fs.promises.stat(clipOutputPath);
            log.info(`Clip ${i + 1} extracted`, { sizeBytes: clipStats.size });

            // Read clip file and upload to Google Drive
            const clipBuffer = await fs.promises.readFile(clipOutputPath);
            const fileName = `${clip.title ?? clip.id}.mp4`;
            log.info(`Uploading clip ${i + 1}...`, { fileName, parentFolderId: shortsFolder.id });
            const uploadedFile = await this.storageGateway.uploadFile({
              name: fileName,
              mimeType: 'video/mp4',
              content: clipBuffer,
              parentFolderId: shortsFolder.id,
            });
            log.info(`Clip ${i + 1} uploaded`, {
              fileId: uploadedFile.id,
              webViewLink: uploadedFile.webViewLink,
            });

            // Clean up clip file immediately after upload
            await fs.promises.unlink(clipOutputPath).catch(() => {});

            // Update clip with Google Drive info
            const completedClip = clip
              .withGoogleDriveInfo(uploadedFile.id, uploadedFile.webViewLink)
              .withStatus('completed');
            await this.clipRepository.save(completedClip);
            log.info(`Clip ${i + 1} completed`);
          } catch (clipError) {
            const errorMessage =
              clipError instanceof Error ? clipError.message : 'Unknown error processing clip';
            log.warn(`Clip ${i + 1} failed`, { error: errorMessage });
            await this.clipRepository.save(clip.withStatus('failed', errorMessage));
            // Clean up clip file on error
            await fs.promises.unlink(clipOutputPath).catch(() => {});
          }
        }

        // 10. Create metadata file
        log.info('Creating metadata file...');
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
          name: `${updatedVideo.id}_clips_metadata.json`,
          mimeType: 'application/json',
          content: Buffer.from(JSON.stringify(metadataContent, null, 2)),
          parentFolderId: shortsFolder.id,
        });
        log.info('Metadata file uploaded');

        // 11. Update video to completed
        await this.videoRepository.save(updatedVideo.withStatus('completed'));
        log.info('Processing completed successfully');

        return {
          videoId: updatedVideo.id,
          status: 'completed',
        };
      } finally {
        // Cleanup temp directory
        await this.cleanupTempDir(tempDir);
      }
    } catch (error) {
      log.error('Processing failed', error as Error, { videoId });

      // Update video to failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.videoRepository.save(video.withStatus('failed', errorMessage));

      throw error;
    }
  }

  /**
   * Check if GCS cache is valid
   */
  private isGcsCacheValid(video: Video): boolean {
    if (!video.gcsUri || !video.gcsExpiresAt) {
      return false;
    }
    // Check if cache has expired (with 5 minute buffer)
    const now = new Date();
    const bufferMs = 5 * 60 * 1000;
    return video.gcsExpiresAt.getTime() > now.getTime() + bufferMs;
  }

  /**
   * Ensure video is cached in GCS and download to local temp file
   * フォールバック戦略: GCS → Google Drive
   * @returns Path to local temp file (caller must clean up)
   */
  private async prepareVideoFile(video: Video): Promise<{ localPath: string; video: Video }> {
    let currentVideo = video;
    let gcsUri = video.gcsUri;

    // Step 1: Check if GCS cache is valid
    if (this.isGcsCacheValid(video) && gcsUri) {
      log.info('GCS cache is valid', { gcsUri, expiresAt: video.gcsExpiresAt });
      // Verify file actually exists in GCS
      const exists = await this.tempStorageGateway.exists(gcsUri);
      if (!exists) {
        log.info('GCS file not found despite valid URI, will re-cache');
        gcsUri = null;
      }
    } else {
      log.info('GCS cache is not valid or not available');
      gcsUri = null;
    }

    // Step 2: If not in GCS, download from Google Drive and cache
    if (!gcsUri) {
      log.info('Downloading video from Google Drive and caching to GCS...');
      try {
        // Stream download from Google Drive to GCS
        const driveStream = await this.storageGateway.downloadFileAsStream(video.googleDriveFileId);
        const { gcsUri: newGcsUri, expiresAt } = await this.tempStorageGateway.uploadFromStream(
          { videoId: video.id },
          driveStream
        );
        gcsUri = newGcsUri;

        // Update video record with GCS info
        currentVideo = currentVideo.withGcsInfo(gcsUri, expiresAt);
        await this.videoRepository.save(currentVideo);
        log.info('Video cached to GCS and record updated', {
          gcsUri,
          expiresAt: expiresAt.toISOString(),
        });
      } catch (cacheError) {
        const error = createClipError(
          CLIP_ERROR_CODES.GCS_DOWNLOAD_FAILED,
          `Failed to cache video to GCS: ${cacheError instanceof Error ? cacheError.message : 'Unknown error'}`
        );
        log.warn(error.message, { severity: error.severity });
        // Fallback: download directly from Google Drive to local file
        return this.downloadDirectlyToLocalFile(video);
      }
    }

    // Step 3: Download from GCS to local temp file
    try {
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'extract-clips-'));
      const localPath = path.join(tempDir, 'source.mp4');

      log.info('Downloading from GCS to local file...', { gcsUri, localPath });
      const gcsStream = this.tempStorageGateway.downloadAsStream(gcsUri);
      const writeStream = fs.createWriteStream(localPath);
      await pipeline(gcsStream, writeStream);

      const stats = await fs.promises.stat(localPath);
      log.info('Video downloaded to local file', { localPath, sizeBytes: stats.size });

      return { localPath, video: currentVideo };
    } catch (downloadError) {
      const error = createClipError(
        CLIP_ERROR_CODES.GCS_DOWNLOAD_FAILED,
        `Failed to download from GCS: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`
      );
      log.warn(error.message, { severity: error.severity });
      // Fallback: download directly from Google Drive
      return this.downloadDirectlyToLocalFile(video);
    }
  }

  /**
   * Fallback: Download directly from Google Drive to local temp file
   */
  private async downloadDirectlyToLocalFile(
    video: Video
  ): Promise<{ localPath: string; video: Video }> {
    log.info('Falling back to direct Google Drive download...');

    try {
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'extract-clips-'));
      const localPath = path.join(tempDir, 'source.mp4');

      const driveStream = await this.storageGateway.downloadFileAsStream(video.googleDriveFileId);
      const writeStream = fs.createWriteStream(localPath);
      await pipeline(driveStream, writeStream);

      const stats = await fs.promises.stat(localPath);
      log.info('Video downloaded directly from Google Drive', { localPath, sizeBytes: stats.size });

      return { localPath, video };
    } catch (err) {
      throw new Error(
        `${CLIP_ERROR_CODES.TEMP_FILE_CREATION_FAILED}: Failed to create temp file: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Cleanup temporary directory and its contents
   */
  private async cleanupTempDir(dirPath: string): Promise<void> {
    try {
      const files = await fs.promises.readdir(dirPath);
      await Promise.all(files.map((file) => fs.promises.unlink(path.join(dirPath, file))));
      await fs.promises.rmdir(dirPath);
      log.debug('Temp directory cleaned up', { dirPath });
    } catch {
      // Ignore cleanup errors
      log.debug('Failed to cleanup temp directory (non-critical)', { dirPath });
    }
  }
}
