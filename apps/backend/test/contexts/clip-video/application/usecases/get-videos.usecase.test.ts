import { GetVideosUseCase } from '@clip-video/application/usecases/get-videos.usecase.js';
import type { VideoRepositoryGateway } from '@clip-video/domain/gateways/video-repository.gateway.js';
import { Video } from '@clip-video/domain/models/video.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GetVideosUseCase', () => {
  let useCase: GetVideosUseCase;
  let videoRepository: VideoRepositoryGateway;

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

  beforeEach(() => {
    videoRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByGoogleDriveFileId: vi.fn(),
      findMany: vi.fn().mockResolvedValue({
        videos: [
          { video: createVideo('1'), clipCount: 3 },
          { video: createVideo('2'), clipCount: 5 },
        ],
        total: 2,
      }),
      delete: vi.fn(),
    };

    useCase = new GetVideosUseCase({ videoRepository });
  });

  it('should return paginated videos', async () => {
    const result = await useCase.execute({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(2);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    });
  });

  it('should use default pagination values', async () => {
    await useCase.execute({});

    expect(videoRepository.findMany).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: undefined,
    });
  });

  it('should filter by status', async () => {
    await useCase.execute({ status: 'transcribing' });

    expect(videoRepository.findMany).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: 'transcribing',
    });
  });

  it('should limit to maximum 500 items', async () => {
    await useCase.execute({ limit: 1000 });

    expect(videoRepository.findMany).toHaveBeenCalledWith({
      page: 1,
      limit: 500,
      status: undefined,
    });
  });

  it('should use minimum page of 1', async () => {
    await useCase.execute({ page: -5 });

    expect(videoRepository.findMany).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: undefined,
    });
  });

  it('should calculate total pages correctly', async () => {
    vi.mocked(videoRepository.findMany).mockResolvedValue({
      videos: Array(10)
        .fill(null)
        .map((_, i) => ({
          video: createVideo(String(i)),
          clipCount: 1,
        })),
      total: 100,
    });

    const result = await useCase.execute({ limit: 10 });

    expect(result.pagination.totalPages).toBe(10);
  });
});
