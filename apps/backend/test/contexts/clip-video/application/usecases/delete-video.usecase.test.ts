import { NotFoundError } from '@clip-video/application/errors/errors.js';
import { DeleteVideoUseCase } from '@clip-video/application/usecases/delete-video.usecase.js';
import type { VideoRepositoryGateway } from '@clip-video/domain/gateways/video-repository.gateway.js';
import { Video } from '@clip-video/domain/models/video.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('DeleteVideoUseCase', () => {
  let useCase: DeleteVideoUseCase;
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
      findById: vi.fn().mockResolvedValue(null),
      findByGoogleDriveFileId: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    useCase = new DeleteVideoUseCase({ videoRepository });
  });

  it('should delete video when it exists', async () => {
    const video = createVideo('video-1');
    vi.mocked(videoRepository.findById).mockResolvedValue(video);

    await useCase.execute('video-1');

    expect(videoRepository.findById).toHaveBeenCalledWith('video-1');
    expect(videoRepository.delete).toHaveBeenCalledWith('video-1');
  });

  it('should throw NotFoundError when video does not exist', async () => {
    vi.mocked(videoRepository.findById).mockResolvedValue(null);

    await expect(useCase.execute('non-existent')).rejects.toThrow(NotFoundError);
    expect(videoRepository.findById).toHaveBeenCalledWith('non-existent');
    expect(videoRepository.delete).not.toHaveBeenCalled();
  });
});
