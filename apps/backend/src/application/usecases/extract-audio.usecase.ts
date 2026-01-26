import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
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
 * Result of stream-based audio extraction
 * Audio is uploaded to GCS instead of returned as buffer
 */
export interface ExtractAudioStreamResult {
  videoId: string;
  audioGcsUri: string;
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

  /**
   * Stream version: Extract audio and upload directly to GCS
   * Memory efficient: suitable for large videos (1GB+)
   *
   * Flow:
   * 1. Stream download from GCS to temp file
   * 2. FFmpeg file-to-file conversion
   * 3. Stream upload from temp file to GCS
   */
  async executeWithStream(
    videoId: string,
    format: 'wav' | 'flac' = 'flac'
  ): Promise<ExtractAudioStreamResult> {
    this.log('Starting stream execution', { videoId, format });

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

    // Create temp directory for processing
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'extract-audio-'));
    const inputPath = path.join(tempDir, 'input.mp4');
    const outputPath = path.join(tempDir, `output.${format}`);

    try {
      // 1. Stream download from GCS to temp file (no memory buffer)
      this.log('Downloading video from GCS to temp file...', { gcsUri: video.gcsUri });
      const downloadStream = this.tempStorageGateway.downloadAsStream(video.gcsUri);
      await pipeline(downloadStream, fs.createWriteStream(inputPath));
      const inputStats = await fs.promises.stat(inputPath);
      this.log('Video downloaded to temp file', { sizeBytes: inputStats.size });

      // 2. FFmpeg file-to-file conversion (no buffer loading)
      this.log('Extracting audio from file to file...', { format });
      await this.videoProcessingGateway.extractAudioFromFile(inputPath, outputPath, format);
      const outputStats = await fs.promises.stat(outputPath);
      this.log('Audio extracted to temp file', { sizeBytes: outputStats.size });

      // 3. Stream upload to GCS
      this.log('Uploading audio to GCS...');
      const uploadStream = fs.createReadStream(outputPath);
      const contentType = format === 'wav' ? 'audio/wav' : 'audio/flac';
      const { gcsUri: audioGcsUri } = await this.tempStorageGateway.uploadFromStream(
        { videoId, contentType, path: `audio.${format}` },
        uploadStream
      );
      this.log('Audio uploaded to GCS', { audioGcsUri });

      return {
        videoId: video.id,
        audioGcsUri,
        format,
      };
    } finally {
      // Cleanup temp directory
      await this.cleanup(tempDir);
    }
  }

  /**
   * Cleanup temporary directory and its contents
   */
  private async cleanup(tempDir: string): Promise<void> {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      this.log('Temp directory cleaned up', { tempDir });
    } catch {
      // Ignore cleanup errors
    }
  }
}
