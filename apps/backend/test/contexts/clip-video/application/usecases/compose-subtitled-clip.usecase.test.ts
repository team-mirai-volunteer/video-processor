import { NotFoundError, ValidationError } from '@clip-video/application/errors/errors.js';
import { ComposeSubtitledClipUseCase } from '@clip-video/application/usecases/compose-subtitled-clip.usecase.js';
import type { ClipRepositoryGateway } from '@clip-video/domain/gateways/clip-repository.gateway.js';
import type { ClipSubtitleComposerGateway } from '@clip-video/domain/gateways/clip-subtitle-composer.gateway.js';
import type { ClipSubtitleRepositoryGateway } from '@clip-video/domain/gateways/clip-subtitle-repository.gateway.js';
import { ClipSubtitle } from '@clip-video/domain/models/clip-subtitle.js';
import { Clip } from '@clip-video/domain/models/clip.js';
import type { TempStorageGateway } from '@shared/domain/gateways/temp-storage.gateway.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ComposeSubtitledClipUseCase', () => {
  // Mock dependencies
  const mockClipRepository: ClipRepositoryGateway = {
    save: vi.fn(),
    saveMany: vi.fn(),
    findById: vi.fn(),
    findByVideoId: vi.fn(),
    findAllPaginated: vi.fn(),
    delete: vi.fn(),
  };

  const mockClipSubtitleRepository: ClipSubtitleRepositoryGateway = {
    save: vi.fn(),
    findByClipId: vi.fn(),
    delete: vi.fn(),
  };

  const mockClipSubtitleComposer: ClipSubtitleComposerGateway = {
    compose: vi.fn(),
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

  let useCase: ComposeSubtitledClipUseCase;

  beforeEach(() => {
    vi.clearAllMocks();

    useCase = new ComposeSubtitledClipUseCase({
      clipRepository: mockClipRepository,
      clipSubtitleRepository: mockClipSubtitleRepository,
      clipSubtitleComposer: mockClipSubtitleComposer,
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
      subtitledVideoGcsUri: null,
      subtitledVideoUrl: null,
      subtitledVideoDriveId: null,
      subtitledVideoDriveUrl: null,
      clipVideoGcsUri: 'gs://bucket/clips/test.mp4',
      clipVideoGcsExpiresAt: new Date(Date.now() + 3600000),
      ...overrides,
    });
  };

  const createTestSubtitle = (
    overrides: Partial<Parameters<typeof ClipSubtitle.fromProps>[0]> = {}
  ) => {
    return ClipSubtitle.fromProps({
      id: 'test-subtitle-id',
      clipId: 'test-clip-id',
      segments: [
        { index: 0, text: 'Hello world', startTimeSeconds: 0, endTimeSeconds: 5 },
        { index: 1, text: 'This is a test', startTimeSeconds: 5, endTimeSeconds: 10 },
      ],
      status: 'confirmed',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
  };

  describe('execute', () => {
    it('should throw NotFoundError when clip does not exist', async () => {
      vi.mocked(mockClipRepository.findById).mockResolvedValue(null);

      await expect(useCase.execute({ clipId: 'non-existent' })).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when subtitle does not exist', async () => {
      const clip = createTestClip();
      vi.mocked(mockClipRepository.findById).mockResolvedValue(clip);
      vi.mocked(mockClipSubtitleRepository.findByClipId).mockResolvedValue(null);

      await expect(useCase.execute({ clipId: 'test-clip-id' })).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when subtitle is not confirmed', async () => {
      const clip = createTestClip();
      const subtitle = createTestSubtitle({ status: 'draft' });
      vi.mocked(mockClipRepository.findById).mockResolvedValue(clip);
      vi.mocked(mockClipSubtitleRepository.findByClipId).mockResolvedValue(subtitle);

      await expect(useCase.execute({ clipId: 'test-clip-id' })).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when clip has no video in GCS', async () => {
      const clip = createTestClip({ clipVideoGcsUri: null });
      const subtitle = createTestSubtitle();
      vi.mocked(mockClipRepository.findById).mockResolvedValue(clip);
      vi.mocked(mockClipSubtitleRepository.findByClipId).mockResolvedValue(subtitle);

      await expect(useCase.execute({ clipId: 'test-clip-id' })).rejects.toThrow(NotFoundError);
    });
  });
});
