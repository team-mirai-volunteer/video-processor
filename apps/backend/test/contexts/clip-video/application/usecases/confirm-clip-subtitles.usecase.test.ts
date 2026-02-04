import {
  SubtitleAlreadyConfirmedError,
  SubtitleNotFoundError,
} from '@clip-video/application/errors/clip-subtitle.errors.js';
import { ConfirmClipSubtitlesUseCase } from '@clip-video/application/usecases/confirm-clip-subtitles.usecase.js';
import type { ClipSubtitleRepositoryGateway } from '@clip-video/domain/gateways/clip-subtitle-repository.gateway.js';
import { ClipSubtitle } from '@clip-video/domain/models/clip-subtitle.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ConfirmClipSubtitlesUseCase', () => {
  let useCase: ConfirmClipSubtitlesUseCase;
  let mockClipSubtitleRepository: ClipSubtitleRepositoryGateway;

  const validSegments = [
    { index: 0, text: 'こんにちは', startTimeSeconds: 0.0, endTimeSeconds: 1.5 },
    { index: 1, text: 'これはテストです', startTimeSeconds: 1.5, endTimeSeconds: 3.0 },
  ];

  beforeEach(() => {
    mockClipSubtitleRepository = {
      save: vi.fn(),
      findByClipId: vi.fn(),
      delete: vi.fn(),
    };

    useCase = new ConfirmClipSubtitlesUseCase({
      clipSubtitleRepository: mockClipSubtitleRepository,
    });
  });

  it('should confirm subtitle successfully', async () => {
    const subtitleResult = ClipSubtitle.create(
      { clipId: 'clip-123', segments: validSegments },
      () => 'subtitle-id-123'
    );
    expect(subtitleResult.success).toBe(true);
    if (!subtitleResult.success) return;

    vi.mocked(mockClipSubtitleRepository.findByClipId).mockResolvedValue(subtitleResult.value);
    vi.mocked(mockClipSubtitleRepository.save).mockResolvedValue();

    const result = await useCase.execute('clip-123');

    expect(result.subtitle.status).toBe('confirmed');
    expect(mockClipSubtitleRepository.save).toHaveBeenCalled();
  });

  it('should throw SubtitleNotFoundError when subtitle does not exist', async () => {
    vi.mocked(mockClipSubtitleRepository.findByClipId).mockResolvedValue(null);

    await expect(useCase.execute('clip-123')).rejects.toThrow(SubtitleNotFoundError);
  });

  it('should throw SubtitleAlreadyConfirmedError when subtitle is already confirmed', async () => {
    const subtitleResult = ClipSubtitle.create(
      { clipId: 'clip-123', segments: validSegments },
      () => 'subtitle-id-123'
    );
    expect(subtitleResult.success).toBe(true);
    if (!subtitleResult.success) return;

    const confirmResult = subtitleResult.value.confirm();
    expect(confirmResult.success).toBe(true);
    if (!confirmResult.success) return;

    vi.mocked(mockClipSubtitleRepository.findByClipId).mockResolvedValue(confirmResult.value);

    await expect(useCase.execute('clip-123')).rejects.toThrow(SubtitleAlreadyConfirmedError);
  });
});
