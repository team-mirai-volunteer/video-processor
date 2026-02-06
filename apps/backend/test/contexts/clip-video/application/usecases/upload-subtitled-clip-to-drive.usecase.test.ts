import { NotFoundError } from '@clip-video/application/errors/errors.js';
import { UploadSubtitledClipToDriveUseCase } from '@clip-video/application/usecases/upload-subtitled-clip-to-drive.usecase.js';
import type { ClipRepositoryGateway } from '@clip-video/domain/gateways/clip-repository.gateway.js';
import type { StorageGateway } from '@clip-video/domain/gateways/storage.gateway.js';
import { Clip } from '@clip-video/domain/models/clip.js';
import type { TempStorageGateway } from '@shared/domain/gateways/temp-storage.gateway.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('UploadSubtitledClipToDriveUseCase', () => {
  // Mock dependencies
  const mockClipRepository: ClipRepositoryGateway = {
    save: vi.fn(),
    saveMany: vi.fn(),
    findById: vi.fn(),
    findByVideoId: vi.fn(),
    findAllPaginated: vi.fn(),
    delete: vi.fn(),
    updateComposeStatus: vi.fn(),
    updateComposeProgress: vi.fn(),
  };

  const mockStorage: StorageGateway = {
    getFileMetadata: vi.fn(),
    downloadFile: vi.fn(),
    downloadFileAsStream: vi.fn(),
    uploadFile: vi.fn(),
    createFolder: vi.fn(),
    findOrCreateFolder: vi.fn(),
  };

  const mockTempStorage: TempStorageGateway = {
    upload: vi.fn(),
    uploadFromStream: vi.fn(),
    uploadFromStreamWithProgress: vi.fn(),
    download: vi.fn(),
    downloadAsStream: vi.fn(),
    exists: vi.fn(),
    getSignedUrl: vi.fn(),
  };

  let useCase: UploadSubtitledClipToDriveUseCase;

  beforeEach(() => {
    vi.clearAllMocks();

    useCase = new UploadSubtitledClipToDriveUseCase({
      clipRepository: mockClipRepository,
      storage: mockStorage,
      tempStorage: mockTempStorage,
    });
  });

  const createTestClip = (overrides: Partial<Parameters<typeof Clip.fromProps>[0]> = {}) => {
    return Clip.fromProps({
      id: 'test-clip-id',
      videoId: 'test-video-id',
      googleDriveFileId: null,
      googleDriveUrl: null,
      title: 'Test Clip',
      startTimeSeconds: 0,
      endTimeSeconds: 30,
      durationSeconds: 30,
      transcript: 'Test transcript',
      status: 'pending',
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      subtitledVideoGcsUri: 'gs://bucket/subtitled/test.mp4',
      subtitledVideoUrl: 'https://storage.googleapis.com/bucket/subtitled/test.mp4',
      subtitledVideoDriveId: null,
      subtitledVideoDriveUrl: null,
      clipVideoGcsUri: 'gs://bucket/clips/test.mp4',
      clipVideoGcsExpiresAt: new Date(Date.now() + 3600000),
      composeStatus: null,
      composeProgressPhase: null,
      composeProgressPercent: null,
      composeErrorMessage: null,
      ...overrides,
    });
  };

  describe('execute', () => {
    it('should throw NotFoundError when clip does not exist', async () => {
      vi.mocked(mockClipRepository.findById).mockResolvedValue(null);

      await expect(useCase.execute({ clipId: 'non-existent' })).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when clip has no subtitled video', async () => {
      const clip = createTestClip({ subtitledVideoGcsUri: null });
      vi.mocked(mockClipRepository.findById).mockResolvedValue(clip);

      await expect(useCase.execute({ clipId: 'test-clip-id' })).rejects.toThrow(NotFoundError);
    });

    it('should upload subtitled video to Google Drive successfully', async () => {
      const clip = createTestClip();
      const videoBuffer = Buffer.from('test video content');

      vi.mocked(mockClipRepository.findById).mockResolvedValue(clip);
      vi.mocked(mockTempStorage.download).mockResolvedValue(videoBuffer);
      vi.mocked(mockStorage.uploadFile).mockResolvedValue({
        id: 'drive-file-id',
        name: 'Test Clip-subtitled.mp4',
        mimeType: 'video/mp4',
        size: videoBuffer.length,
        webViewLink: 'https://drive.google.com/file/d/drive-file-id/view',
      });
      vi.mocked(mockClipRepository.save).mockResolvedValue(undefined);

      const result = await useCase.execute({ clipId: 'test-clip-id' });

      expect(result).toEqual({
        clipId: 'test-clip-id',
        driveFileId: 'drive-file-id',
        driveUrl: 'https://drive.google.com/file/d/drive-file-id/view',
      });

      expect(mockTempStorage.download).toHaveBeenCalledWith('gs://bucket/subtitled/test.mp4');
      expect(mockStorage.uploadFile).toHaveBeenCalledWith({
        name: 'Test Clip-subtitled.mp4',
        mimeType: 'video/mp4',
        content: videoBuffer,
        parentFolderId: undefined,
      });
      expect(mockClipRepository.save).toHaveBeenCalled();
    });

    it('should use clip id as filename when title is null', async () => {
      const clip = createTestClip({ title: null });
      const videoBuffer = Buffer.from('test video content');

      vi.mocked(mockClipRepository.findById).mockResolvedValue(clip);
      vi.mocked(mockTempStorage.download).mockResolvedValue(videoBuffer);
      vi.mocked(mockStorage.uploadFile).mockResolvedValue({
        id: 'drive-file-id',
        name: 'clip-test-clip-id-subtitled.mp4',
        mimeType: 'video/mp4',
        size: videoBuffer.length,
        webViewLink: 'https://drive.google.com/file/d/drive-file-id/view',
      });
      vi.mocked(mockClipRepository.save).mockResolvedValue(undefined);

      await useCase.execute({ clipId: 'test-clip-id' });

      expect(mockStorage.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'clip-test-clip-id-subtitled.mp4',
        })
      );
    });

    it('should pass folder id when provided', async () => {
      const clip = createTestClip();
      const videoBuffer = Buffer.from('test video content');

      vi.mocked(mockClipRepository.findById).mockResolvedValue(clip);
      vi.mocked(mockTempStorage.download).mockResolvedValue(videoBuffer);
      vi.mocked(mockStorage.uploadFile).mockResolvedValue({
        id: 'drive-file-id',
        name: 'Test Clip-subtitled.mp4',
        mimeType: 'video/mp4',
        size: videoBuffer.length,
        webViewLink: 'https://drive.google.com/file/d/drive-file-id/view',
      });
      vi.mocked(mockClipRepository.save).mockResolvedValue(undefined);

      await useCase.execute({ clipId: 'test-clip-id', folderId: 'folder-123' });

      expect(mockStorage.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          parentFolderId: 'folder-123',
        })
      );
    });
  });
});
