import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, ValidationError } from '../../../../src/application/errors.js';
import { SubmitVideoUseCase } from '../../../../src/application/usecases/submit-video.usecase.js';
import type { ProcessingJobRepositoryGateway } from '../../../../src/domain/gateways/processing-job-repository.gateway.js';
import type { VideoRepositoryGateway } from '../../../../src/domain/gateways/video-repository.gateway.js';
import { Video } from '../../../../src/domain/models/video.js';

describe('SubmitVideoUseCase', () => {
  let useCase: SubmitVideoUseCase;
  let videoRepository: VideoRepositoryGateway;
  let processingJobRepository: ProcessingJobRepositoryGateway;
  let idCounter: number;

  beforeEach(() => {
    idCounter = 0;

    videoRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByGoogleDriveFileId: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue({ videos: [], total: 0 }),
    };

    processingJobRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByVideoId: vi.fn().mockResolvedValue([]),
      findPending: vi.fn().mockResolvedValue([]),
    };

    useCase = new SubmitVideoUseCase({
      videoRepository,
      processingJobRepository,
      generateId: () => `id-${++idCounter}`,
    });
  });

  it('should create video and processing job for valid input', async () => {
    const input = {
      googleDriveUrl: 'https://drive.google.com/file/d/abc123/view',
      clipInstructions: 'Cut the intro',
    };

    const result = await useCase.execute(input);

    expect(result.id).toBe('id-1');
    expect(result.googleDriveFileId).toBe('abc123');
    expect(result.status).toBe('pending');
    expect(result.processingJob.id).toBe('id-2');
    expect(result.processingJob.status).toBe('pending');

    expect(videoRepository.save).toHaveBeenCalledTimes(1);
    expect(processingJobRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should throw ValidationError for invalid Google Drive URL', async () => {
    const input = {
      googleDriveUrl: 'https://example.com/file',
      clipInstructions: 'Cut the intro',
    };

    await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
    expect(videoRepository.save).not.toHaveBeenCalled();
  });

  it('should throw ConflictError when video already exists', async () => {
    const existingVideo = Video.fromProps({
      id: 'existing-id',
      googleDriveFileId: 'abc123',
      googleDriveUrl: 'https://drive.google.com/file/d/abc123/view',
      title: null,
      description: null,
      durationSeconds: null,
      fileSizeBytes: null,
      status: 'pending',
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(videoRepository.findByGoogleDriveFileId).mockResolvedValue(existingVideo);

    const input = {
      googleDriveUrl: 'https://drive.google.com/file/d/abc123/view',
      clipInstructions: 'Cut the intro',
    };

    await expect(useCase.execute(input)).rejects.toThrow(ConflictError);
    expect(videoRepository.save).not.toHaveBeenCalled();
  });

  it('should throw ValidationError for empty clip instructions', async () => {
    const input = {
      googleDriveUrl: 'https://drive.google.com/file/d/abc123/view',
      clipInstructions: '',
    };

    await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
  });
});
