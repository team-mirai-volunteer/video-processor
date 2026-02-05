import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { ClipRepositoryGateway } from '@clip-video/domain/gateways/clip-repository.gateway.js';
import type { RefinedTranscriptionRepositoryGateway } from '@clip-video/domain/gateways/refined-transcription-repository.gateway.js';
import type { StorageGateway } from '@clip-video/domain/gateways/storage.gateway.js';
import type { TempStorageGateway } from '@clip-video/domain/gateways/temp-storage.gateway.js';
import type { TranscriptionRepositoryGateway } from '@clip-video/domain/gateways/transcription-repository.gateway.js';
import type { VideoProcessingGateway } from '@clip-video/domain/gateways/video-processing.gateway.js';
import type { VideoRepositoryGateway } from '@clip-video/domain/gateways/video-repository.gateway.js';
import { Clip } from '@clip-video/domain/models/clip.js';
import type { Video } from '@clip-video/domain/models/video.js';
import { createLogger } from '@shared/infrastructure/logging/logger.js';
import type { ExtractClipByTimeResponse } from '@video-processor/shared';
import { CLIP_ERROR_CODES, createClipError } from '../errors/clip.errors.js';
import { NotFoundError, ValidationError } from '../errors/errors.js';

const log = createLogger('ExtractClipByTimeUseCase');

/** 最小クリップ長（秒） */
const MIN_CLIP_DURATION_SECONDS = 5;
/** 最大クリップ長（秒） = 10分 */
const MAX_CLIP_DURATION_SECONDS = 600;
/** クリップ終端のパディング（秒） */
const CLIP_END_PADDING_SECONDS = 0.5;
/** タイトル自動生成時の最大文字数 */
const AUTO_TITLE_MAX_LENGTH = 50;

export interface ExtractClipByTimeInput {
  videoId: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  title?: string;
}

export interface ExtractClipByTimeUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
  clipRepository: ClipRepositoryGateway;
  transcriptionRepository: TranscriptionRepositoryGateway;
  refinedTranscriptionRepository: RefinedTranscriptionRepositoryGateway;
  storageGateway: StorageGateway;
  tempStorageGateway: TempStorageGateway;
  videoProcessingGateway: VideoProcessingGateway;
  generateId: () => string;
  outputFolderId?: string;
}

export class ExtractClipByTimeUseCase {
  private readonly videoRepository: VideoRepositoryGateway;
  private readonly clipRepository: ClipRepositoryGateway;
  private readonly transcriptionRepository: TranscriptionRepositoryGateway;
  private readonly refinedTranscriptionRepository: RefinedTranscriptionRepositoryGateway;
  private readonly storageGateway: StorageGateway;
  private readonly tempStorageGateway: TempStorageGateway;
  private readonly videoProcessingGateway: VideoProcessingGateway;
  private readonly generateId: () => string;
  private readonly outputFolderId?: string;

  constructor(deps: ExtractClipByTimeUseCaseDeps) {
    this.videoRepository = deps.videoRepository;
    this.clipRepository = deps.clipRepository;
    this.transcriptionRepository = deps.transcriptionRepository;
    this.refinedTranscriptionRepository = deps.refinedTranscriptionRepository;
    this.storageGateway = deps.storageGateway;
    this.tempStorageGateway = deps.tempStorageGateway;
    this.videoProcessingGateway = deps.videoProcessingGateway;
    this.generateId = deps.generateId;
    this.outputFolderId = deps.outputFolderId;
  }

  async execute(input: ExtractClipByTimeInput): Promise<ExtractClipByTimeResponse> {
    const { videoId, startTimeSeconds, endTimeSeconds, title } = input;
    log.info('Starting execution', {
      videoId,
      startTimeSeconds,
      endTimeSeconds,
      title: title?.substring(0, 50),
    });

    // 1. Validate input
    this.validateInput(input);

    // 2. Get video
    const video = await this.videoRepository.findById(videoId);
    if (!video) {
      throw new NotFoundError('Video', videoId);
    }
    log.info('Found video', { videoId: video.id, status: video.status });

    // 3. Get transcription (for durationSeconds validation)
    const transcription = await this.transcriptionRepository.findByVideoId(videoId);
    if (!transcription) {
      const error = createClipError(
        CLIP_ERROR_CODES.TRANSCRIPTION_NOT_FOUND,
        `Transcription not found for video ${videoId}. Please run transcription first.`
      );
      throw new ValidationError(error.message);
    }

    // 4. Validate endTimeSeconds against video duration
    if (endTimeSeconds > transcription.durationSeconds) {
      throw new ValidationError(
        `endTimeSeconds (${endTimeSeconds}) exceeds video duration (${transcription.durationSeconds})`
      );
    }

    // 5. Get refined transcription for transcript text extraction
    const refinedTranscription = await this.refinedTranscriptionRepository.findByTranscriptionId(
      transcription.id
    );

    // 6. Generate title and transcript from selected range
    const { clipTitle, clipTranscript } = this.generateClipMetadata(
      title,
      startTimeSeconds,
      endTimeSeconds,
      refinedTranscription
    );

    let createdClipId: string | null = null;

    try {
      // 7. Update video status to extracting
      await this.videoRepository.save(video.withStatus('extracting'));
      log.info('Status updated to extracting');

      // 8. Get video metadata
      const metadata = await this.storageGateway.getFileMetadata(video.googleDriveFileId);
      log.info('Got video metadata', { name: metadata.name });

      // 9. Prepare video file
      const { localPath: sourceVideoPath, video: updatedVideo } =
        await this.prepareVideoFile(video);
      const tempDir = path.dirname(sourceVideoPath);
      log.info('Video file prepared', { sourceVideoPath });

      try {
        // 10. Create clip entity
        const clipResult = Clip.createWithFlexibleDuration(
          {
            videoId: updatedVideo.id,
            title: clipTitle,
            startTimeSeconds,
            endTimeSeconds,
            transcript: clipTranscript,
          },
          this.generateId
        );

        if (!clipResult.success) {
          throw new ValidationError(clipResult.error.message);
        }

        const clip = clipResult.value;
        createdClipId = clip.id;
        await this.clipRepository.save(clip);
        log.info('Clip created', { clipId: clip.id });

        // 11. Get or create output folder
        const parentFolder = metadata.parents?.[0] ?? this.outputFolderId;
        const shortsFolder = await this.storageGateway.findOrCreateFolder(
          'ショート用',
          parentFolder
        );
        log.info('Output folder ready', { shortsFolderId: shortsFolder.id });

        // 12. Extract clip using FFmpeg
        const clipOutputPath = path.join(tempDir, `clip_${clip.id}.mp4`);
        await this.clipRepository.save(clip.withStatus('processing'));

        log.info('Extracting clip...', {
          startTime: startTimeSeconds,
          endTime: endTimeSeconds + CLIP_END_PADDING_SECONDS,
        });
        await this.videoProcessingGateway.extractClipFromFile(
          sourceVideoPath,
          clipOutputPath,
          startTimeSeconds,
          endTimeSeconds + CLIP_END_PADDING_SECONDS
        );

        const clipStats = await fs.promises.stat(clipOutputPath);
        log.info('Clip extracted', { sizeBytes: clipStats.size });

        // 13. Upload to Google Drive
        const clipBuffer = await fs.promises.readFile(clipOutputPath);
        const fileName = `${clipTitle ?? clip.id}.mp4`;
        log.info('Uploading clip...', { fileName, parentFolderId: shortsFolder.id });
        const uploadedFile = await this.storageGateway.uploadFile({
          name: fileName,
          mimeType: 'video/mp4',
          content: clipBuffer,
          parentFolderId: shortsFolder.id,
        });
        log.info('Clip uploaded', {
          fileId: uploadedFile.id,
          webViewLink: uploadedFile.webViewLink,
        });

        // 14. Clean up clip file
        await fs.promises.unlink(clipOutputPath).catch(() => {});

        // 15. Update clip with Google Drive info
        const completedClip = clip
          .withGoogleDriveInfo(uploadedFile.id, uploadedFile.webViewLink)
          .withStatus('completed');
        await this.clipRepository.save(completedClip);
        log.info('Clip completed', { clipId: completedClip.id });

        // 16. Update video to completed (keep at completed or transcribed)
        const finalStatus = video.status === 'completed' ? 'completed' : 'transcribed';
        await this.videoRepository.save(updatedVideo.withStatus(finalStatus));
        log.info('Processing completed successfully');

        return {
          videoId: updatedVideo.id,
          clipId: completedClip.id,
          status: 'completed',
        };
      } finally {
        // Cleanup temp directory
        await this.cleanupTempDir(tempDir);
      }
    } catch (error) {
      log.error('Processing failed', error as Error, { videoId });

      // Update clip to failed if created
      if (createdClipId) {
        try {
          const failedClip = await this.clipRepository.findById(createdClipId);
          if (failedClip) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await this.clipRepository.save(failedClip.withStatus('failed', errorMessage));
          }
        } catch {
          // Ignore cleanup errors
        }
      }

      // Restore video status (keep transcribed status for retry)
      await this.videoRepository.save(video.withStatus('transcribed'));

      throw error;
    }
  }

  private validateInput(input: ExtractClipByTimeInput): void {
    const { startTimeSeconds, endTimeSeconds } = input;

    if (startTimeSeconds < 0) {
      throw new ValidationError('startTimeSeconds must be >= 0');
    }

    if (endTimeSeconds <= startTimeSeconds) {
      throw new ValidationError('endTimeSeconds must be greater than startTimeSeconds');
    }

    const duration = endTimeSeconds - startTimeSeconds;
    if (duration < MIN_CLIP_DURATION_SECONDS) {
      throw new ValidationError(
        `Clip duration must be at least ${MIN_CLIP_DURATION_SECONDS} seconds (got ${duration})`
      );
    }

    if (duration > MAX_CLIP_DURATION_SECONDS) {
      throw new ValidationError(
        `Clip duration must not exceed ${MAX_CLIP_DURATION_SECONDS} seconds (${MAX_CLIP_DURATION_SECONDS / 60} minutes, got ${duration})`
      );
    }
  }

  private generateClipMetadata(
    title: string | undefined,
    startTimeSeconds: number,
    endTimeSeconds: number,
    refinedTranscription: {
      sentences: Array<{ text: string; startTimeSeconds: number; endTimeSeconds: number }>;
    } | null
  ): { clipTitle: string | null; clipTranscript: string | null } {
    if (!refinedTranscription) {
      return {
        clipTitle: title ?? null,
        clipTranscript: null,
      };
    }

    // Find sentences that overlap with the selected range
    const overlappingSentences = refinedTranscription.sentences.filter(
      (sentence) =>
        sentence.endTimeSeconds > startTimeSeconds && sentence.startTimeSeconds < endTimeSeconds
    );

    const clipTranscript =
      overlappingSentences.length > 0 ? overlappingSentences.map((s) => s.text).join('') : null;

    // Auto-generate title from first N characters if not provided
    let clipTitle = title ?? null;
    if (!clipTitle && clipTranscript) {
      clipTitle =
        clipTranscript.length > AUTO_TITLE_MAX_LENGTH
          ? `${clipTranscript.substring(0, AUTO_TITLE_MAX_LENGTH)}...`
          : clipTranscript;
    }

    return { clipTitle, clipTranscript };
  }

  private isGcsCacheValid(video: Video): boolean {
    if (!video.gcsUri || !video.gcsExpiresAt) {
      return false;
    }
    const now = new Date();
    const bufferMs = 5 * 60 * 1000;
    return video.gcsExpiresAt.getTime() > now.getTime() + bufferMs;
  }

  private async prepareVideoFile(video: Video): Promise<{ localPath: string; video: Video }> {
    let currentVideo = video;
    let gcsUri = video.gcsUri;

    // Check if GCS cache is valid
    if (this.isGcsCacheValid(video) && gcsUri) {
      log.info('GCS cache is valid', { gcsUri, expiresAt: video.gcsExpiresAt });
      const exists = await this.tempStorageGateway.exists(gcsUri);
      if (!exists) {
        log.info('GCS file not found despite valid URI, will re-cache');
        gcsUri = null;
      }
    } else {
      log.info('GCS cache is not valid or not available');
      gcsUri = null;
    }

    // If not in GCS, download from Google Drive and cache
    if (!gcsUri) {
      log.info('Downloading video from Google Drive and caching to GCS...');
      try {
        const driveStream = await this.storageGateway.downloadFileAsStream(video.googleDriveFileId);
        const { gcsUri: newGcsUri, expiresAt } = await this.tempStorageGateway.uploadFromStream(
          { videoId: video.id },
          driveStream
        );
        gcsUri = newGcsUri;

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
        return this.downloadDirectlyToLocalFile(video);
      }
    }

    // Download from GCS to local temp file
    try {
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'extract-clip-by-time-'));
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
      return this.downloadDirectlyToLocalFile(video);
    }
  }

  private async downloadDirectlyToLocalFile(
    video: Video
  ): Promise<{ localPath: string; video: Video }> {
    log.info('Falling back to direct Google Drive download...');

    try {
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'extract-clip-by-time-'));
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

  private async cleanupTempDir(dirPath: string): Promise<void> {
    try {
      const files = await fs.promises.readdir(dirPath);
      await Promise.all(files.map((file) => fs.promises.unlink(path.join(dirPath, file))));
      await fs.promises.rmdir(dirPath);
      log.debug('Temp directory cleaned up', { dirPath });
    } catch {
      log.debug('Failed to cleanup temp directory (non-critical)', { dirPath });
    }
  }
}
