import {
  ClipNotFoundError,
  ClipVideoNotFoundError,
} from '@clip-video/application/errors/clip-subtitle.errors.js';
import { GetClipVideoUrlUseCase } from '@clip-video/application/usecases/get-clip-video-url.usecase.js';
import type { ClipRepositoryGateway } from '@clip-video/domain/gateways/clip-repository.gateway.js';
import type { StorageGateway } from '@clip-video/domain/gateways/storage.gateway.js';
import { Clip } from '@clip-video/domain/models/clip.js';
import type { TempStorageGateway } from '@shared/domain/gateways/temp-storage.gateway.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GetClipVideoUrlUseCase', () => {
  let useCase: GetClipVideoUrlUseCase;
  let clipRepository: ClipRepositoryGateway;
  let storageGateway: StorageGateway;
  let tempStorageGateway: TempStorageGateway;

  const createClip = (overrides: Partial<Parameters<typeof Clip.fromProps>[0]> = {}) =>
    Clip.fromProps({
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
      composeStatus: null,
      composeProgressPhase: null,
      composeProgressPercent: null,
      composeErrorMessage: null,
      ...overrides,
    });

  beforeEach(() => {
    clipRepository = {
      save: vi.fn(),
      saveMany: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
      findByVideoId: vi.fn(),
      findAllPaginated: vi.fn(),
      delete: vi.fn(),
      updateComposeStatus: vi.fn(),
      updateComposeProgress: vi.fn(),
    };

    storageGateway = {
      downloadFileAsStream: vi.fn().mockResolvedValue({} as NodeJS.ReadableStream),
      getFileMetadata: vi.fn(),
      uploadFile: vi.fn(),
      findOrCreateFolder: vi.fn(),
    } as unknown as StorageGateway;

    tempStorageGateway = {
      upload: vi.fn(),
      uploadFromStream: vi.fn().mockResolvedValue({
        gcsUri: 'gs://bucket/clips/clip-1/video.mp4',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
      uploadFromStreamWithProgress: vi.fn(),
      download: vi.fn(),
      downloadAsStream: vi.fn(),
      exists: vi.fn(),
      getSignedUrl: vi.fn().mockResolvedValue('https://storage.googleapis.com/signed-url'),
    };

    useCase = new GetClipVideoUrlUseCase({
      clipRepository,
      storageGateway,
      tempStorageGateway,
    });
  });

  it('should throw ClipNotFoundError when clip does not exist', async () => {
    vi.mocked(clipRepository.findById).mockResolvedValue(null);

    await expect(useCase.execute('non-existent')).rejects.toThrow(ClipNotFoundError);
  });

  it('should throw ClipVideoNotFoundError when clip has no Google Drive file', async () => {
    const clip = createClip({ googleDriveFileId: null });
    vi.mocked(clipRepository.findById).mockResolvedValue(clip);

    await expect(useCase.execute('clip-1')).rejects.toThrow(ClipVideoNotFoundError);
  });

  it('should use cached GCS video when available and not expired', async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    const clip = createClip({
      clipVideoGcsUri: 'gs://bucket/cached.mp4',
      clipVideoGcsExpiresAt: futureDate,
    });
    vi.mocked(clipRepository.findById).mockResolvedValue(clip);

    const result = await useCase.execute('clip-1');

    expect(result.videoUrl).toBe('https://storage.googleapis.com/signed-url');
    expect(tempStorageGateway.getSignedUrl).toHaveBeenCalledWith('gs://bucket/cached.mp4', 60);
    expect(storageGateway.downloadFileAsStream).not.toHaveBeenCalled();
  });

  it('should download from Drive and cache when no GCS cache exists', async () => {
    const clip = createClip();
    vi.mocked(clipRepository.findById).mockResolvedValue(clip);

    const result = await useCase.execute('clip-1');

    expect(storageGateway.downloadFileAsStream).toHaveBeenCalledWith('drive-file-1');
    expect(tempStorageGateway.uploadFromStream).toHaveBeenCalled();
    expect(clipRepository.save).toHaveBeenCalled();
    expect(result.videoUrl).toBe('https://storage.googleapis.com/signed-url');
    expect(result.durationSeconds).toBe(30);
  });

  it('should download from Drive when GCS cache is expired', async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000);
    const clip = createClip({
      clipVideoGcsUri: 'gs://bucket/cached.mp4',
      clipVideoGcsExpiresAt: pastDate,
    });
    vi.mocked(clipRepository.findById).mockResolvedValue(clip);

    await useCase.execute('clip-1');

    expect(storageGateway.downloadFileAsStream).toHaveBeenCalledWith('drive-file-1');
    expect(tempStorageGateway.uploadFromStream).toHaveBeenCalled();
  });
});
