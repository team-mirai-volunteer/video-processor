import { Clip } from '@clip-video/domain/models/clip.js';
import { Video } from '@clip-video/domain/models/video.js';
import { ClipRepository } from '@clip-video/infrastructure/repositories/clip.repository.js';
import { VideoRepository } from '@clip-video/infrastructure/repositories/video.repository.js';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Skip integration tests if DATABASE_URL is not set
const runIntegrationTests = !!process.env.DATABASE_URL;

describe.skipIf(!runIntegrationTests)('ClipRepository Integration', () => {
  let prisma: PrismaClient;
  let clipRepository: ClipRepository;
  let videoRepository: VideoRepository;

  beforeAll(async () => {
    prisma = new PrismaClient();
    clipRepository = new ClipRepository(prisma);
    videoRepository = new VideoRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data in correct order (respect foreign key constraints)
    await prisma.clipSubtitle.deleteMany();
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
      audioGcsUri: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

  const createTestClip = (id: string, videoId: string) =>
    Clip.fromProps({
      id,
      videoId,
      googleDriveFileId: `drive-file-${id}`,
      googleDriveUrl: `https://drive.google.com/file/d/drive-file-${id}/view`,
      title: `Test Clip ${id}`,
      startTimeSeconds: 0,
      endTimeSeconds: 30,
      durationSeconds: 30,
      transcript: 'Test transcript',
      status: 'completed',
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      subtitledVideoGcsUri: null,
      subtitledVideoUrl: null,
      subtitledVideoDriveId: null,
      subtitledVideoDriveUrl: null,
      clipVideoGcsUri: null,
      clipVideoGcsExpiresAt: null,
      composeStatus: null,
      composeProgressPhase: null,
      composeProgressPercent: null,
      composeErrorMessage: null,
    });

  describe('delete', () => {
    it('should delete an existing clip', async () => {
      // Setup: Create a video and a clip
      const video = createTestVideo('video-1', 'file-1');
      await videoRepository.save(video);

      const clip = createTestClip('clip-1', 'video-1');
      await clipRepository.save(clip);

      // Verify clip exists
      const foundBefore = await clipRepository.findById('clip-1');
      expect(foundBefore).not.toBe(null);

      // Delete the clip
      await clipRepository.delete('clip-1');

      // Verify clip is deleted
      const foundAfter = await clipRepository.findById('clip-1');
      expect(foundAfter).toBe(null);
    });

    it('should throw error when deleting non-existent clip', async () => {
      await expect(clipRepository.delete('non-existent')).rejects.toThrow();
    });

    it('should not affect other clips when deleting one', async () => {
      // Setup: Create a video and multiple clips
      const video = createTestVideo('video-1', 'file-1');
      await videoRepository.save(video);

      const clip1 = createTestClip('clip-1', 'video-1');
      const clip2 = createTestClip('clip-2', 'video-1');
      await clipRepository.save(clip1);
      await clipRepository.save(clip2);

      // Delete one clip
      await clipRepository.delete('clip-1');

      // Verify other clip still exists
      const found1 = await clipRepository.findById('clip-1');
      const found2 = await clipRepository.findById('clip-2');

      expect(found1).toBe(null);
      expect(found2).not.toBe(null);
      expect(found2?.id).toBe('clip-2');
    });
  });
});
