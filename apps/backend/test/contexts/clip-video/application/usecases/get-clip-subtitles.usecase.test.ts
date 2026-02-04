import { GetClipSubtitlesUseCase } from '@clip-video/application/usecases/get-clip-subtitles.usecase.js';
import type { ClipSubtitleRepositoryGateway } from '@clip-video/domain/gateways/clip-subtitle-repository.gateway.js';
import { ClipSubtitle } from '@clip-video/domain/models/clip-subtitle.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GetClipSubtitlesUseCase', () => {
  let useCase: GetClipSubtitlesUseCase;
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

    useCase = new GetClipSubtitlesUseCase({
      clipSubtitleRepository: mockClipSubtitleRepository,
    });
  });

  it('should return subtitle when found', async () => {
    const subtitleResult = ClipSubtitle.create(
      { clipId: 'clip-123', segments: validSegments },
      () => 'subtitle-id-123'
    );
    expect(subtitleResult.success).toBe(true);
    if (!subtitleResult.success) return;

    vi.mocked(mockClipSubtitleRepository.findByClipId).mockResolvedValue(subtitleResult.value);

    const result = await useCase.execute('clip-123');

    expect(result.subtitle).not.toBeNull();
    expect(result.subtitle?.id).toBe('subtitle-id-123');
    expect(result.subtitle?.clipId).toBe('clip-123');
    expect(result.subtitle?.segments).toHaveLength(2);
  });

  it('should return null subtitle when not found', async () => {
    vi.mocked(mockClipSubtitleRepository.findByClipId).mockResolvedValue(null);

    const result = await useCase.execute('clip-123');

    expect(result.subtitle).toBeNull();
  });
});
