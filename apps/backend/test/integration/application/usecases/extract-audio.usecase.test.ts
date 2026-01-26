import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ExtractAudioUseCase } from '../../../../src/application/usecases/extract-audio.usecase.js';
import type { VideoRepositoryGateway } from '../../../../src/domain/gateways/video-repository.gateway.js';
import { Video } from '../../../../src/domain/models/video.js';
import { FFmpegClient } from '../../../../src/infrastructure/clients/ffmpeg.client.js';
import { LocalTempStorageClient } from '../../../../src/infrastructure/clients/local-temp-storage.client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_VIDEO_PATH = path.resolve(__dirname, '../../../fixtures/sample.mp4');

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

// Skip integration tests if INTEGRATION_TEST is not set or ffmpeg is not available
const runIntegrationTests = process.env.INTEGRATION_TEST === 'true' && isFFmpegAvailable();

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

describe.skipIf(!runIntegrationTests)('ExtractAudioUseCase Integration', () => {
  let useCase: ExtractAudioUseCase;
  let videoRepository: InMemoryVideoRepository;
  let localTempStorageClient: LocalTempStorageClient;
  let tempDir: string;

  beforeAll(async () => {
    // Create temp directory for LocalTempStorageClient
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'extract-audio-test-'));
  });

  afterAll(async () => {
    // Cleanup temp directories
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    // Initialize clients
    localTempStorageClient = new LocalTempStorageClient(tempDir);
    const ffmpegClient = new FFmpegClient();

    // Initialize repositories
    videoRepository = new InMemoryVideoRepository();

    // Create use case
    useCase = new ExtractAudioUseCase({
      videoRepository,
      tempStorageGateway: localTempStorageClient,
      videoProcessingGateway: ffmpegClient,
    });
  });

  describe('executeWithStream', () => {
    it('should extract audio and upload to local storage', async () => {
      // Arrange: Copy sample video to local temp storage
      const videoId = uuidv4();
      const videoDir = path.join(tempDir, 'videos', videoId);
      await fs.promises.mkdir(videoDir, { recursive: true });

      const cachedVideoPath = path.join(videoDir, 'original.mp4');
      await fs.promises.copyFile(SAMPLE_VIDEO_PATH, cachedVideoPath);

      // Create a Video entity with gcsUri set (local:// URI)
      const videoResult = Video.create(
        { googleDriveUrl: 'https://drive.google.com/file/d/test-file-id/view' },
        () => videoId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      // Update video with gcsUri
      const video = videoResult.value.withGcsUri(`local://${cachedVideoPath}`);
      await videoRepository.save(video);

      // Act: Execute the stream version
      const result = await useCase.executeWithStream(videoId, 'flac');

      // Assert: Check result
      expect(result).toHaveProperty('videoId', videoId);
      expect(result).toHaveProperty('audioGcsUri');
      expect(result).toHaveProperty('format', 'flac');
      expect(result.audioGcsUri).toMatch(/audio\.flac$/);

      // Verify audio file was uploaded to local storage
      const audioExists = await localTempStorageClient.exists(result.audioGcsUri);
      expect(audioExists).toBe(true);

      // Read the audio file and verify it's a valid FLAC
      const audioBuffer = await localTempStorageClient.download(result.audioGcsUri);
      expect(audioBuffer.length).toBeGreaterThan(0);

      // FLAC files start with 'fLaC' magic bytes
      const magic = audioBuffer.slice(0, 4).toString('ascii');
      expect(magic).toBe('fLaC');

      console.log('ExtractAudioUseCase.executeWithStream result:', {
        audioGcsUri: result.audioGcsUri,
        audioSize: audioBuffer.length,
        format: result.format,
      });
    });

    it('should extract WAV audio when specified', async () => {
      // Arrange
      const videoId = uuidv4();
      const videoDir = path.join(tempDir, 'videos', videoId);
      await fs.promises.mkdir(videoDir, { recursive: true });

      const cachedVideoPath = path.join(videoDir, 'original.mp4');
      await fs.promises.copyFile(SAMPLE_VIDEO_PATH, cachedVideoPath);

      const videoResult = Video.create(
        { googleDriveUrl: 'https://drive.google.com/file/d/test-file-id/view' },
        () => videoId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const video = videoResult.value.withGcsUri(`local://${cachedVideoPath}`);
      await videoRepository.save(video);

      // Act: Execute with WAV format
      const result = await useCase.executeWithStream(videoId, 'wav');

      // Assert
      expect(result.format).toBe('wav');
      expect(result.audioGcsUri).toMatch(/audio\.wav$/);

      const audioBuffer = await localTempStorageClient.download(result.audioGcsUri);
      const magic = audioBuffer.slice(0, 4).toString('ascii');
      expect(magic).toBe('RIFF');

      // Verify 16kHz mono
      const numChannels = audioBuffer.readUInt16LE(22);
      const sampleRate = audioBuffer.readUInt32LE(24);
      expect(numChannels).toBe(1);
      expect(sampleRate).toBe(16000);
    });

    it('should throw error when video is not cached', async () => {
      // Arrange: Create video without gcsUri
      const videoId = uuidv4();
      const videoResult = Video.create(
        { googleDriveUrl: 'https://drive.google.com/file/d/test-file-id/view' },
        () => videoId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      await videoRepository.save(videoResult.value);

      // Act & Assert
      await expect(useCase.executeWithStream(videoId, 'flac')).rejects.toThrow(/not cached in GCS/);
    });

    it('should throw error when cache file does not exist', async () => {
      // Arrange: Create video with gcsUri pointing to non-existent file
      const videoId = uuidv4();
      const videoResult = Video.create(
        { googleDriveUrl: 'https://drive.google.com/file/d/test-file-id/view' },
        () => videoId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const video = videoResult.value.withGcsUri('local:///non/existent/path/video.mp4');
      await videoRepository.save(video);

      // Act & Assert
      await expect(useCase.executeWithStream(videoId, 'flac')).rejects.toThrow(/cache not found/);
    });

    it('should throw error when video does not exist', async () => {
      // Act & Assert
      await expect(useCase.executeWithStream('non-existent-id', 'flac')).rejects.toThrow(
        /Video.*not found/
      );
    });
  });
});
