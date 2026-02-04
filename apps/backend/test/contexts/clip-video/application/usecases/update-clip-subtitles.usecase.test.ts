import {
  SubtitleAlreadyConfirmedError,
  SubtitleNotFoundError,
  SubtitleValidationError,
} from '@clip-video/application/errors/clip-subtitle.errors.js';
import { UpdateClipSubtitlesUseCase } from '@clip-video/application/usecases/update-clip-subtitles.usecase.js';
import type { ClipSubtitleRepositoryGateway } from '@clip-video/domain/gateways/clip-subtitle-repository.gateway.js';
import { ClipSubtitle } from '@clip-video/domain/models/clip-subtitle.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('UpdateClipSubtitlesUseCase', () => {
  let useCase: UpdateClipSubtitlesUseCase;
  let mockClipSubtitleRepository: ClipSubtitleRepositoryGateway;

  const validSegments = [
    { index: 0, text: 'こんにちは', startTimeSeconds: 0.0, endTimeSeconds: 1.5 },
    { index: 1, text: 'これはテストです', startTimeSeconds: 1.5, endTimeSeconds: 3.0 },
  ];

  const newSegments = [
    { index: 0, text: '更新されたテキスト', startTimeSeconds: 0.0, endTimeSeconds: 2.0 },
  ];

  beforeEach(() => {
    mockClipSubtitleRepository = {
      save: vi.fn(),
      findByClipId: vi.fn(),
      delete: vi.fn(),
    };

    useCase = new UpdateClipSubtitlesUseCase({
      clipSubtitleRepository: mockClipSubtitleRepository,
    });
  });

  it('should update subtitle segments successfully', async () => {
    const subtitleResult = ClipSubtitle.create(
      { clipId: 'clip-123', segments: validSegments },
      () => 'subtitle-id-123'
    );
    expect(subtitleResult.success).toBe(true);
    if (!subtitleResult.success) return;

    vi.mocked(mockClipSubtitleRepository.findByClipId).mockResolvedValue(subtitleResult.value);
    vi.mocked(mockClipSubtitleRepository.save).mockResolvedValue();

    const result = await useCase.execute({
      clipId: 'clip-123',
      segments: newSegments,
    });

    expect(result.subtitle.segments).toHaveLength(1);
    expect(result.subtitle.segments[0]?.text).toBe('更新されたテキスト');
    expect(mockClipSubtitleRepository.save).toHaveBeenCalled();
  });

  it('should throw SubtitleNotFoundError when subtitle does not exist', async () => {
    vi.mocked(mockClipSubtitleRepository.findByClipId).mockResolvedValue(null);

    await expect(
      useCase.execute({
        clipId: 'clip-123',
        segments: newSegments,
      })
    ).rejects.toThrow(SubtitleNotFoundError);
  });

  it('should throw SubtitleAlreadyConfirmedError when subtitle is confirmed', async () => {
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

    await expect(
      useCase.execute({
        clipId: 'clip-123',
        segments: newSegments,
      })
    ).rejects.toThrow(SubtitleAlreadyConfirmedError);
  });

  it('should throw SubtitleValidationError when new segments are invalid', async () => {
    const subtitleResult = ClipSubtitle.create(
      { clipId: 'clip-123', segments: validSegments },
      () => 'subtitle-id-123'
    );
    expect(subtitleResult.success).toBe(true);
    if (!subtitleResult.success) return;

    vi.mocked(mockClipSubtitleRepository.findByClipId).mockResolvedValue(subtitleResult.value);

    await expect(
      useCase.execute({
        clipId: 'clip-123',
        segments: [], // Empty segments should fail validation
      })
    ).rejects.toThrow(SubtitleValidationError);
  });
});
