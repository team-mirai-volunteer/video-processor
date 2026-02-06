import {
  ClipNotFoundError,
  RefinedTranscriptionNotFoundError,
  SubtitleGenerationError,
  TranscriptionNotFoundError,
} from '@clip-video/application/errors/clip-subtitle.errors.js';
import { GenerateClipSubtitlesUseCase } from '@clip-video/application/usecases/generate-clip-subtitles.usecase.js';
import type { AiGateway } from '@clip-video/domain/gateways/ai.gateway.js';
import type { ClipRepositoryGateway } from '@clip-video/domain/gateways/clip-repository.gateway.js';
import type { ClipSubtitleRepositoryGateway } from '@clip-video/domain/gateways/clip-subtitle-repository.gateway.js';
import type { RefinedTranscriptionRepositoryGateway } from '@clip-video/domain/gateways/refined-transcription-repository.gateway.js';
import type { TranscriptionRepositoryGateway } from '@clip-video/domain/gateways/transcription-repository.gateway.js';
import { Clip } from '@clip-video/domain/models/clip.js';
import { RefinedTranscription } from '@clip-video/domain/models/refined-transcription.js';
import { Transcription } from '@clip-video/domain/models/transcription.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GenerateClipSubtitlesUseCase', () => {
  let useCase: GenerateClipSubtitlesUseCase;
  let clipRepository: ClipRepositoryGateway;
  let clipSubtitleRepository: ClipSubtitleRepositoryGateway;
  let transcriptionRepository: TranscriptionRepositoryGateway;
  let refinedTranscriptionRepository: RefinedTranscriptionRepositoryGateway;
  let aiGateway: AiGateway;
  const generateId = () => 'generated-id';

  const createClip = (id: string) =>
    Clip.fromProps({
      id,
      videoId: 'video-1',
      googleDriveFileId: 'drive-file-1',
      googleDriveUrl: 'https://drive.google.com/file/d/drive-file-1/view',
      title: 'Test Clip',
      startTimeSeconds: 10,
      endTimeSeconds: 40,
      durationSeconds: 30,
      transcript: 'テスト文字起こし',
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
    });

  const createTranscription = () =>
    Transcription.fromProps({
      id: 'transcription-1',
      videoId: 'video-1',
      fullText: 'テスト文字起こし全文',
      segments: [{ text: 'テスト', startTimeSeconds: 0, endTimeSeconds: 5, confidence: 0.95 }],
      languageCode: 'ja-JP',
      durationSeconds: 120,
      createdAt: new Date(),
    });

  const createRefinedTranscription = () =>
    RefinedTranscription.fromProps({
      id: 'refined-1',
      transcriptionId: 'transcription-1',
      fullText: 'テスト文字起こし',
      sentences: [
        {
          text: 'これはテストです。',
          startTimeSeconds: 10,
          endTimeSeconds: 20,
          originalSegmentIndices: [0],
        },
        {
          text: 'テスト文字起こし。',
          startTimeSeconds: 20,
          endTimeSeconds: 30,
          originalSegmentIndices: [1],
        },
        {
          text: 'もう少しテスト。',
          startTimeSeconds: 30,
          endTimeSeconds: 40,
          originalSegmentIndices: [2],
        },
      ],
      dictionaryVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
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

    clipSubtitleRepository = {
      save: vi.fn(),
      findByClipId: vi.fn(),
      delete: vi.fn(),
    };

    transcriptionRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByVideoId: vi.fn().mockResolvedValue(null),
      deleteByVideoId: vi.fn(),
    };

    refinedTranscriptionRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByTranscriptionId: vi.fn().mockResolvedValue(null),
      deleteByTranscriptionId: vi.fn(),
    };

    aiGateway = {
      generate: vi
        .fn()
        .mockResolvedValue('これはテストです。\n---\nテスト文字起こし。\n---\nもう少しテスト。'),
    };

    useCase = new GenerateClipSubtitlesUseCase({
      clipRepository,
      clipSubtitleRepository,
      transcriptionRepository,
      refinedTranscriptionRepository,
      aiGateway,
      generateId,
    });
  });

  it('should throw ClipNotFoundError when clip does not exist', async () => {
    vi.mocked(clipRepository.findById).mockResolvedValue(null);

    await expect(useCase.execute('non-existent')).rejects.toThrow(ClipNotFoundError);
  });

  it('should throw TranscriptionNotFoundError when transcription does not exist', async () => {
    vi.mocked(clipRepository.findById).mockResolvedValue(createClip('clip-1'));
    vi.mocked(transcriptionRepository.findByVideoId).mockResolvedValue(null);

    await expect(useCase.execute('clip-1')).rejects.toThrow(TranscriptionNotFoundError);
  });

  it('should throw RefinedTranscriptionNotFoundError when refined transcription does not exist', async () => {
    vi.mocked(clipRepository.findById).mockResolvedValue(createClip('clip-1'));
    vi.mocked(transcriptionRepository.findByVideoId).mockResolvedValue(createTranscription());
    vi.mocked(refinedTranscriptionRepository.findByTranscriptionId).mockResolvedValue(null);

    await expect(useCase.execute('clip-1')).rejects.toThrow(RefinedTranscriptionNotFoundError);
  });

  it('should throw SubtitleGenerationError when AI call fails', async () => {
    vi.mocked(clipRepository.findById).mockResolvedValue(createClip('clip-1'));
    vi.mocked(transcriptionRepository.findByVideoId).mockResolvedValue(createTranscription());
    vi.mocked(refinedTranscriptionRepository.findByTranscriptionId).mockResolvedValue(
      createRefinedTranscription()
    );
    vi.mocked(aiGateway.generate).mockRejectedValue(new Error('AI service unavailable'));

    await expect(useCase.execute('clip-1')).rejects.toThrow(SubtitleGenerationError);
  });

  it('should throw SubtitleGenerationError when no sentences match clip range', async () => {
    const clipOutOfRange = Clip.fromProps({
      ...createClip('clip-1').toProps(),
      startTimeSeconds: 100,
      endTimeSeconds: 130,
      durationSeconds: 30,
    });
    vi.mocked(clipRepository.findById).mockResolvedValue(clipOutOfRange);
    vi.mocked(transcriptionRepository.findByVideoId).mockResolvedValue(createTranscription());
    vi.mocked(refinedTranscriptionRepository.findByTranscriptionId).mockResolvedValue(
      createRefinedTranscription()
    );

    await expect(useCase.execute('clip-1')).rejects.toThrow(SubtitleGenerationError);
  });
});
