import { NotFoundError } from '@clip-video/application/errors/errors.js';
import { GetClipsUseCase } from '@clip-video/application/usecases/get-clips.usecase.js';
import type { ClipRepositoryGateway } from '@clip-video/domain/gateways/clip-repository.gateway.js';
import type { VideoRepositoryGateway } from '@clip-video/domain/gateways/video-repository.gateway.js';
import { Clip } from '@clip-video/domain/models/clip.js';
import { Video } from '@clip-video/domain/models/video.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GetClipsUseCase', () => {
  let useCase: GetClipsUseCase;
  let videoRepository: VideoRepositoryGateway;
  let clipRepository: ClipRepositoryGateway;

  const createVideo = (id: string) =>
    Video.fromProps({
      id,
      googleDriveFileId: `file-${id}`,
      googleDriveUrl: `https://drive.google.com/file/d/file-${id}/view`,
      title: `Video ${id}`,
      description: null,
      durationSeconds: 3600,
      fileSizeBytes: 1000000,
      status: 'completed',
      transcriptionPhase: null,
      progressMessage: null,
      errorMessage: null,
      gcsUri: null,
      gcsExpiresAt: null,
      audioGcsUri: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

  const createClip = (id: string, videoId: string) =>
    Clip.fromProps({
      id,
      videoId,
      googleDriveFileId: `drive-file-${id}`,
      googleDriveUrl: `https://drive.google.com/file/d/drive-file-${id}/view`,
      title: `Clip ${id}`,
      startTimeSeconds: 10,
      endTimeSeconds: 40,
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
    });

  beforeEach(() => {
    videoRepository = {
      save: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
      findByGoogleDriveFileId: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    };

    clipRepository = {
      save: vi.fn(),
      saveMany: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
      findByVideoId: vi.fn().mockResolvedValue([]),
      findAllPaginated: vi.fn(),
      delete: vi.fn(),
    };

    useCase = new GetClipsUseCase({ videoRepository, clipRepository });
  });

  describe('executeForVideo', () => {
    it('should return clips for a video', async () => {
      const video = createVideo('video-1');
      const clips = [createClip('clip-1', 'video-1'), createClip('clip-2', 'video-1')];
      vi.mocked(videoRepository.findById).mockResolvedValue(video);
      vi.mocked(clipRepository.findByVideoId).mockResolvedValue(clips);

      const result = await useCase.executeForVideo('video-1');

      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.id).toBe('clip-1');
      expect(result.data[0]?.title).toBe('Clip clip-1');
      expect(result.data[0]?.startTimeSeconds).toBe(10);
      expect(result.data[0]?.endTimeSeconds).toBe(40);
      expect(result.data[0]?.durationSeconds).toBe(30);
    });

    it('should return empty array when video has no clips', async () => {
      const video = createVideo('video-1');
      vi.mocked(videoRepository.findById).mockResolvedValue(video);
      vi.mocked(clipRepository.findByVideoId).mockResolvedValue([]);

      const result = await useCase.executeForVideo('video-1');

      expect(result.data).toHaveLength(0);
    });

    it('should throw NotFoundError when video does not exist', async () => {
      vi.mocked(videoRepository.findById).mockResolvedValue(null);

      await expect(useCase.executeForVideo('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('executeForClip', () => {
    it('should return clip details', async () => {
      const clip = createClip('clip-1', 'video-1');
      vi.mocked(clipRepository.findById).mockResolvedValue(clip);

      const result = await useCase.executeForClip('clip-1');

      expect(result.id).toBe('clip-1');
      expect(result.videoId).toBe('video-1');
      expect(result.title).toBe('Clip clip-1');
      expect(result.startTimeSeconds).toBe(10);
      expect(result.endTimeSeconds).toBe(40);
      expect(result.durationSeconds).toBe(30);
      expect(result.transcript).toBe('Test transcript');
      expect(result.status).toBe('completed');
    });

    it('should throw NotFoundError when clip does not exist', async () => {
      vi.mocked(clipRepository.findById).mockResolvedValue(null);

      await expect(useCase.executeForClip('non-existent')).rejects.toThrow(NotFoundError);
    });
  });
});
