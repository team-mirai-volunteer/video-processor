import { ConflictError, ValidationError } from '@clip-video/application/errors/errors.js';
import { SubmitVideoUseCase } from '@clip-video/application/usecases/submit-video.usecase.js';
import type { StorageGateway } from '@clip-video/domain/gateways/storage.gateway.js';
import type { VideoRepositoryGateway } from '@clip-video/domain/gateways/video-repository.gateway.js';
import { Video } from '@clip-video/domain/models/video.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('SubmitVideoUseCase', () => {
  let useCase: SubmitVideoUseCase;
  let videoRepository: VideoRepositoryGateway;
  let storageGateway: StorageGateway;
  let idCounter: number;

  beforeEach(() => {
    idCounter = 0;

    videoRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByGoogleDriveFileId: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue({ videos: [], total: 0 }),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    storageGateway = {
      getFileMetadata: vi.fn().mockResolvedValue({
        id: 'abc123',
        name: 'Test Video.mp4',
        mimeType: 'video/mp4',
        size: 1000000,
        webViewLink: 'https://drive.google.com/file/d/abc123/view',
      }),
      downloadFile: vi.fn().mockResolvedValue(Buffer.from('video content')),
      downloadFileAsStream: vi.fn().mockResolvedValue(null),
      uploadFile: vi.fn().mockResolvedValue({ id: 'uploaded-id', webViewLink: 'http://link' }),
      createFolder: vi.fn().mockResolvedValue({ id: 'folder-id', name: 'folder' }),
      findOrCreateFolder: vi.fn().mockResolvedValue({ id: 'folder-id', name: 'folder' }),
    };

    useCase = new SubmitVideoUseCase({
      videoRepository,
      storageGateway,
      generateId: () => `id-${++idCounter}`,
    });
  });

  it('should create video for valid input', async () => {
    const input = {
      googleDriveUrl: 'https://drive.google.com/file/d/abc123/view',
    };

    const result = await useCase.execute(input);

    expect(result.id).toBe('id-1');
    expect(result.googleDriveFileId).toBe('abc123');
    expect(result.status).toBe('pending');

    expect(videoRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should throw ValidationError for invalid Google Drive URL', async () => {
    const input = {
      googleDriveUrl: 'https://example.com/file',
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
      transcriptionPhase: null,
      progressMessage: null,
      errorMessage: null,
      gcsUri: null,
      gcsExpiresAt: null,
      audioGcsUri: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(videoRepository.findByGoogleDriveFileId).mockResolvedValue(existingVideo);

    const input = {
      googleDriveUrl: 'https://drive.google.com/file/d/abc123/view',
    };

    await expect(useCase.execute(input)).rejects.toThrow(ConflictError);
    expect(videoRepository.save).not.toHaveBeenCalled();
  });
});
