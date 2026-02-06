import { GetAllClipsUseCase } from '@clip-video/application/usecases/get-all-clips.usecase.js';
import type { ClipRepositoryGateway } from '@clip-video/domain/gateways/clip-repository.gateway.js';
import { Clip } from '@clip-video/domain/models/clip.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GetAllClipsUseCase', () => {
  let useCase: GetAllClipsUseCase;
  let clipRepository: ClipRepositoryGateway;

  const createClip = (id: string) =>
    Clip.fromProps({
      id,
      videoId: 'video-1',
      googleDriveFileId: `drive-file-${id}`,
      googleDriveUrl: `https://drive.google.com/file/d/drive-file-${id}/view`,
      title: `Clip ${id}`,
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
    });

  beforeEach(() => {
    clipRepository = {
      save: vi.fn(),
      saveMany: vi.fn(),
      findById: vi.fn(),
      findByVideoId: vi.fn(),
      findAllPaginated: vi.fn().mockResolvedValue({
        clips: [
          { clip: createClip('clip-1'), videoTitle: 'Video 1' },
          { clip: createClip('clip-2'), videoTitle: 'Video 2' },
        ],
        total: 2,
      }),
      delete: vi.fn(),
    };

    useCase = new GetAllClipsUseCase({ clipRepository });
  });

  it('should return paginated clips', async () => {
    const result = await useCase.execute({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe('clip-1');
    expect(result.data[0].videoTitle).toBe('Video 1');
    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    });
  });

  it('should use default pagination values', async () => {
    await useCase.execute({});

    expect(clipRepository.findAllPaginated).toHaveBeenCalledWith({
      page: 1,
      limit: 50,
    });
  });

  it('should cap limit at 100', async () => {
    await useCase.execute({ limit: 200 });

    expect(clipRepository.findAllPaginated).toHaveBeenCalledWith({
      page: 1,
      limit: 100,
    });
  });

  it('should use minimum page of 1', async () => {
    await useCase.execute({ page: -5 });

    expect(clipRepository.findAllPaginated).toHaveBeenCalledWith({
      page: 1,
      limit: 50,
    });
  });

  it('should use minimum limit of 1', async () => {
    await useCase.execute({ limit: 0 });

    expect(clipRepository.findAllPaginated).toHaveBeenCalledWith({
      page: 1,
      limit: 1,
    });
  });

  it('should calculate total pages correctly', async () => {
    vi.mocked(clipRepository.findAllPaginated).mockResolvedValue({
      clips: Array(10)
        .fill(null)
        .map((_, i) => ({
          clip: createClip(String(i)),
          videoTitle: `Video ${i}`,
        })),
      total: 95,
    });

    const result = await useCase.execute({ limit: 10 });

    expect(result.pagination.totalPages).toBe(10);
  });

  it('should map clip data correctly', async () => {
    const result = await useCase.execute({});

    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'clip-1',
        title: 'Clip clip-1',
        transcript: 'Test transcript',
        status: 'completed',
        videoId: 'video-1',
        videoTitle: 'Video 1',
        durationSeconds: 30,
      })
    );
  });
});
