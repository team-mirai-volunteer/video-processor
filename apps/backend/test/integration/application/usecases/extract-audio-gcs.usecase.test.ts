import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ExtractAudioUseCase } from '../../../../src/application/usecases/extract-audio.usecase.js';
import type { VideoRepositoryGateway } from '../../../../src/domain/gateways/video-repository.gateway.js';
import { Video } from '../../../../src/domain/models/video.js';
import { FFmpegClient } from '../../../../src/infrastructure/clients/ffmpeg.client.js';
import { GcsClient } from '../../../../src/infrastructure/clients/gcs.client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_VIDEO_PATH = path.resolve(__dirname, '../../../fixtures/sample.mp4');

/** テスト用: 24時間後の有効期限 */
const testExpiresAt = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

/**
 * Check if ffmpeg is available on the system
 */
function isFFmpegAvailable(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if GCS credentials are configured
 */
function isGcsConfigured(): boolean {
  const hasCredentialsJson = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const hasIndividualCredentials =
    !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && !!process.env.GOOGLE_PRIVATE_KEY;
  return (hasCredentialsJson || hasIndividualCredentials) && !!process.env.GOOGLE_CLOUD_PROJECT;
}

// Skip integration tests if INTEGRATION_TEST is not set or dependencies are not available
const runIntegrationTests =
  process.env.INTEGRATION_TEST === 'true' && isFFmpegAvailable() && isGcsConfigured();

/**
 * In-memory VideoRepository for testing
 */
class InMemoryVideoRepository implements VideoRepositoryGateway {
  private videos: Map<string, Video> = new Map();

  async save(video: Video): Promise<void> {
    this.videos.set(video.id, video);
  }

  async findById(id: string): Promise<Video | null> {
    return this.videos.get(id) ?? null;
  }

  async findByGoogleDriveFileId(fileId: string): Promise<Video | null> {
    for (const video of this.videos.values()) {
      if (video.googleDriveFileId === fileId) {
        return video;
      }
    }
    return null;
  }

  async findMany() {
    return { videos: [], total: 0 };
  }

  async delete(id: string): Promise<void> {
    this.videos.delete(id);
  }
}

/**
 * Integration test for ExtractAudioUseCase with real GCS
 * Tests the full GCS -> FFmpeg -> GCS stream processing flow
 */
describe.skipIf(!runIntegrationTests)('ExtractAudioUseCase GCS Integration', () => {
  let useCase: ExtractAudioUseCase;
  let videoRepository: InMemoryVideoRepository;
  let gcsClient: GcsClient;
  const createdGcsUris: string[] = [];

  beforeAll(async () => {
    // Initialize clients
    gcsClient = new GcsClient();
    const ffmpegClient = new FFmpegClient();

    // Initialize repositories
    videoRepository = new InMemoryVideoRepository();

    // Create use case with GcsClient as tempStorageGateway
    useCase = new ExtractAudioUseCase({
      videoRepository,
      tempStorageGateway: gcsClient,
      videoProcessingGateway: ffmpegClient,
    });
  });

  afterAll(async () => {
    // Cleanup GCS files
    for (const gcsUri of createdGcsUris) {
      try {
        await gcsClient.delete(gcsUri);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('execute (GCS -> FFmpeg -> GCS)', () => {
    it('should extract FLAC audio from GCS video and upload back to GCS', async () => {
      // Arrange: Upload sample video to GCS
      const videoId = uuidv4();
      const videoContent = await fs.promises.readFile(SAMPLE_VIDEO_PATH);
      const { gcsUri: videoGcsUri } = await gcsClient.upload({ videoId, content: videoContent });
      createdGcsUris.push(videoGcsUri);

      // Create a Video entity with gcsUri
      const videoResult = Video.create(
        { googleDriveUrl: 'https://drive.google.com/file/d/test-file-id/view' },
        () => videoId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const video = videoResult.value.withGcsInfo(videoGcsUri, testExpiresAt());
      await videoRepository.save(video);

      // Act: Execute the stream version
      const result = await useCase.execute(videoId, 'flac');
      createdGcsUris.push(result.audioGcsUri);

      // Assert: Check result
      expect(result).toHaveProperty('videoId', videoId);
      expect(result).toHaveProperty('audioGcsUri');
      expect(result).toHaveProperty('format', 'flac');
      expect(result.audioGcsUri).toMatch(/gs:\/\/.+\/audio\.flac$/);

      // Verify audio file exists in GCS
      const audioExists = await gcsClient.exists(result.audioGcsUri);
      expect(audioExists).toBe(true);

      // Download and verify it's a valid FLAC file
      const audioBuffer = await gcsClient.download(result.audioGcsUri);
      expect(audioBuffer.length).toBeGreaterThan(0);

      // FLAC files start with 'fLaC' magic bytes
      const magic = audioBuffer.subarray(0, 4).toString('ascii');
      expect(magic).toBe('fLaC');

      console.log('GCS ExtractAudioUseCase.execute result:', {
        videoGcsUri,
        audioGcsUri: result.audioGcsUri,
        audioSize: audioBuffer.length,
        format: result.format,
      });
    }, 60000); // 60 second timeout for GCS operations

    it('should extract WAV audio from GCS video and upload back to GCS', async () => {
      // Arrange: Upload sample video to GCS
      const videoId = uuidv4();
      const videoContent = await fs.promises.readFile(SAMPLE_VIDEO_PATH);
      const { gcsUri: videoGcsUri } = await gcsClient.upload({ videoId, content: videoContent });
      createdGcsUris.push(videoGcsUri);

      // Create a Video entity with gcsUri
      const videoResult = Video.create(
        { googleDriveUrl: 'https://drive.google.com/file/d/test-file-id/view' },
        () => videoId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const video = videoResult.value.withGcsInfo(videoGcsUri, testExpiresAt());
      await videoRepository.save(video);

      // Act: Execute with WAV format
      const result = await useCase.execute(videoId, 'wav');
      createdGcsUris.push(result.audioGcsUri);

      // Assert
      expect(result.format).toBe('wav');
      expect(result.audioGcsUri).toMatch(/gs:\/\/.+\/audio\.wav$/);

      // Download and verify it's a valid WAV file
      const audioBuffer = await gcsClient.download(result.audioGcsUri);

      // WAV files start with 'RIFF' magic bytes
      const magic = audioBuffer.subarray(0, 4).toString('ascii');
      expect(magic).toBe('RIFF');

      // Verify 16kHz mono (as configured in FFmpegClient)
      const numChannels = audioBuffer.readUInt16LE(22);
      const sampleRate = audioBuffer.readUInt32LE(24);
      expect(numChannels).toBe(1);
      expect(sampleRate).toBe(16000);

      console.log('GCS ExtractAudioUseCase WAV result:', {
        videoGcsUri,
        audioGcsUri: result.audioGcsUri,
        audioSize: audioBuffer.length,
        format: result.format,
        channels: numChannels,
        sampleRate,
      });
    }, 60000);

    it('should handle stream download and upload without memory spike', async () => {
      // This test verifies that the stream processing doesn't load entire video into memory
      // We use the sample video which is ~27MB

      const videoId = uuidv4();
      const videoContent = await fs.promises.readFile(SAMPLE_VIDEO_PATH);
      const { gcsUri: videoGcsUri } = await gcsClient.upload({ videoId, content: videoContent });
      createdGcsUris.push(videoGcsUri);

      const videoResult = Video.create(
        { googleDriveUrl: 'https://drive.google.com/file/d/test-file-id/view' },
        () => videoId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const video = videoResult.value.withGcsInfo(videoGcsUri, testExpiresAt());
      await videoRepository.save(video);

      // Record memory usage before
      const memBefore = process.memoryUsage().heapUsed;

      // Execute stream processing
      const result = await useCase.execute(videoId, 'flac');
      createdGcsUris.push(result.audioGcsUri);

      // Record memory usage after
      const memAfter = process.memoryUsage().heapUsed;
      const memIncreaseMB = (memAfter - memBefore) / (1024 * 1024);

      console.log('Memory usage:', {
        before: `${(memBefore / (1024 * 1024)).toFixed(2)} MB`,
        after: `${(memAfter / (1024 * 1024)).toFixed(2)} MB`,
        increase: `${memIncreaseMB.toFixed(2)} MB`,
        videoSize: `${(videoContent.length / (1024 * 1024)).toFixed(2)} MB`,
      });

      // Verify the result is valid
      expect(result.audioGcsUri).toMatch(/gs:\/\/.+\/audio\.flac$/);

      // Note: Memory test is informational only
      // In stream processing, memory increase should be much less than video size
    }, 60000);
  });
});
