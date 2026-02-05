import { NotFoundError } from '@clip-video/application/errors/errors.js';
import { DeleteClipUseCase } from '@clip-video/application/usecases/delete-clip.usecase.js';
import type { ClipRepositoryGateway } from '@clip-video/domain/gateways/clip-repository.gateway.js';
import { Clip } from '@clip-video/domain/models/clip.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('DeleteClipUseCase', () => {
  let useCase: DeleteClipUseCase;
  let clipRepository: ClipRepositoryGateway;

  beforeEach(() => {
    clipRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      saveMany: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByVideoId: vi.fn().mockResolvedValue([]),
      findAllPaginated: vi.fn().mockResolvedValue({ clips: [], total: 0 }),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    useCase = new DeleteClipUseCase({
      clipRepository,
    });
  });

  it('should delete clip when it exists', async () => {
    const existingClip = Clip.fromProps({
      id: 'clip-1',
      videoId: 'video-1',
      googleDriveFileId: 'drive-file-1',
      googleDriveUrl: 'https://drive.google.com/file/d/drive-file-1/view',
      title: 'Test Clip',
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
    vi.mocked(clipRepository.findById).mockResolvedValue(existingClip);

    const result = await useCase.execute({ clipId: 'clip-1' });

    expect(result.deletedClipId).toBe('clip-1');
    expect(clipRepository.findById).toHaveBeenCalledWith('clip-1');
    expect(clipRepository.delete).toHaveBeenCalledWith('clip-1');
  });

  it('should throw NotFoundError when clip does not exist', async () => {
    vi.mocked(clipRepository.findById).mockResolvedValue(null);

    await expect(useCase.execute({ clipId: 'non-existent' })).rejects.toThrow(NotFoundError);
    expect(clipRepository.findById).toHaveBeenCalledWith('non-existent');
    expect(clipRepository.delete).not.toHaveBeenCalled();
  });
});
