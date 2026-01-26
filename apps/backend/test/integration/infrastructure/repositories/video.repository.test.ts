import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Video } from '../../../../src/domain/models/video.js';
import { VideoRepository } from '../../../../src/infrastructure/repositories/video.repository.js';

// Skip integration tests if DATABASE_URL is not set
const runIntegrationTests = !!process.env.DATABASE_URL;

describe.skipIf(!runIntegrationTests)('VideoRepository Integration', () => {
  let prisma: PrismaClient;
  let repository: VideoRepository;

  beforeAll(async () => {
    prisma = new PrismaClient();
    repository = new VideoRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.clip.deleteMany();
    await prisma.processingJob.deleteMany();
    await prisma.video.deleteMany();
  });

  const createTestVideo = (id: string, fileId: string) =>
    Video.fromProps({
      id,
      googleDriveFileId: fileId,
      googleDriveUrl: `https://drive.google.com/file/d/${fileId}/view`,
      title: `Test Video ${id}`,
      description: null,
      durationSeconds: 3600,
      fileSizeBytes: 1000000,
      status: 'pending',
      transcriptionPhase: null,
      progressMessage: null,
      errorMessage: null,
      gcsUri: null,
      gcsExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

  describe('save', () => {
    it('should create a new video', async () => {
      const video = createTestVideo('test-1', 'file-1');
      await repository.save(video);

      const found = await repository.findById('test-1');
      expect(found).not.toBe(null);
      expect(found?.googleDriveFileId).toBe('file-1');
    });

    it('should update an existing video', async () => {
      const video = createTestVideo('test-1', 'file-1');
      await repository.save(video);

      const updated = video.withStatus('completed');
      await repository.save(updated);

      const found = await repository.findById('test-1');
      expect(found?.status).toBe('completed');
    });
  });

  describe('findById', () => {
    it('should return null for non-existent video', async () => {
      const found = await repository.findById('non-existent');
      expect(found).toBe(null);
    });

    it('should find video by ID', async () => {
      const video = createTestVideo('test-1', 'file-1');
      await repository.save(video);

      const found = await repository.findById('test-1');
      expect(found).not.toBe(null);
      expect(found?.id).toBe('test-1');
    });
  });

  describe('findByGoogleDriveFileId', () => {
    it('should find video by file ID', async () => {
      const video = createTestVideo('test-1', 'unique-file-id');
      await repository.save(video);

      const found = await repository.findByGoogleDriveFileId('unique-file-id');
      expect(found).not.toBe(null);
      expect(found?.id).toBe('test-1');
    });

    it('should return null for non-existent file ID', async () => {
      const found = await repository.findByGoogleDriveFileId('non-existent-file');
      expect(found).toBe(null);
    });
  });

  describe('findMany', () => {
    it('should return paginated results', async () => {
      // Create multiple videos
      for (let i = 0; i < 5; i++) {
        await repository.save(createTestVideo(`test-${i}`, `file-${i}`));
      }

      const result = await repository.findMany({ page: 1, limit: 2 });

      expect(result.videos).toHaveLength(2);
      expect(result.total).toBe(5);
    });

    it('should filter by status', async () => {
      const video1 = createTestVideo('test-1', 'file-1');
      const video2 = createTestVideo('test-2', 'file-2').withStatus('completed');

      await repository.save(video1);
      await repository.save(video2);

      const result = await repository.findMany({
        page: 1,
        limit: 10,
        status: 'completed',
      });

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0]?.video.id).toBe('test-2');
    });
  });
});
