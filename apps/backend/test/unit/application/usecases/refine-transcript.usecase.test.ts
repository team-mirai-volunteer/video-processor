import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../../src/application/errors.js';
import { RefineTranscriptUseCase } from '../../../../src/application/usecases/refine-transcript.usecase.js';
import type { AiGateway } from '../../../../src/domain/gateways/ai.gateway.js';
import type { RefinedTranscriptionRepositoryGateway } from '../../../../src/domain/gateways/refined-transcription-repository.gateway.js';
import type { StorageGateway } from '../../../../src/domain/gateways/storage.gateway.js';
import type { TranscriptionRepositoryGateway } from '../../../../src/domain/gateways/transcription-repository.gateway.js';
import type { VideoRepositoryGateway } from '../../../../src/domain/gateways/video-repository.gateway.js';
import { Transcription } from '../../../../src/domain/models/transcription.js';
import type { ProperNounDictionary } from '../../../../src/domain/services/transcript-refinement-prompt.service.js';

describe('RefineTranscriptUseCase', () => {
  let useCase: RefineTranscriptUseCase;
  let transcriptionRepository: TranscriptionRepositoryGateway;
  let refinedTranscriptionRepository: RefinedTranscriptionRepositoryGateway;
  let videoRepository: VideoRepositoryGateway;
  let storageGateway: StorageGateway;
  let aiGateway: AiGateway;
  let idCounter: number;

  const mockDictionary: ProperNounDictionary = {
    version: '1.0.0',
    description: 'Test dictionary',
    entries: [
      {
        correct: 'チームみらい',
        category: 'organization',
        description: '政党名',
        wrongPatterns: ['チーム未来'],
      },
    ],
  };

  const mockTranscription = Transcription.fromProps({
    id: 'trans-1',
    videoId: 'video-1',
    fullText: 'どうも こんにちは チーム未来 投手 の 安野高広 です',
    segments: [
      { text: 'どうも', startTimeSeconds: 0.08, endTimeSeconds: 0.2, confidence: 0.95 },
      { text: 'こんにちは', startTimeSeconds: 0.22, endTimeSeconds: 0.6, confidence: 0.98 },
      { text: 'チーム未来', startTimeSeconds: 0.65, endTimeSeconds: 1.2, confidence: 0.85 },
      { text: '投手', startTimeSeconds: 1.25, endTimeSeconds: 1.5, confidence: 0.75 },
      { text: 'の', startTimeSeconds: 1.52, endTimeSeconds: 1.6, confidence: 0.99 },
      { text: '安野高広', startTimeSeconds: 1.62, endTimeSeconds: 2.0, confidence: 0.8 },
      { text: 'です', startTimeSeconds: 2.02, endTimeSeconds: 2.3, confidence: 0.97 },
    ],
    languageCode: 'ja-JP',
    durationSeconds: 2.5,
    createdAt: new Date(),
  });

  const mockAiResponse = JSON.stringify({
    sentences: [
      {
        text: 'どうも、こんにちは。',
        start: 0,
        end: 1,
      },
      {
        text: 'チームみらい党首の安野たかひろです。',
        start: 2,
        end: 6,
      },
    ],
  });

  beforeEach(() => {
    idCounter = 0;

    transcriptionRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByVideoId: vi.fn().mockResolvedValue(mockTranscription),
      deleteByVideoId: vi.fn().mockResolvedValue(undefined),
    };

    refinedTranscriptionRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByTranscriptionId: vi.fn().mockResolvedValue(null),
      deleteByTranscriptionId: vi.fn().mockResolvedValue(undefined),
    };

    videoRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByGoogleDriveFileId: vi.fn().mockResolvedValue(null),
      findByStatus: vi.fn().mockResolvedValue([]),
      findAll: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    storageGateway = {
      getFileMetadata: vi.fn().mockResolvedValue({ name: 'test-video.mp4' }),
      downloadFile: vi.fn().mockResolvedValue(Buffer.from('')),
      uploadFile: vi.fn().mockResolvedValue({ id: 'file-id', name: 'test.txt' }),
      findOrCreateFolder: vi.fn().mockResolvedValue({ id: 'folder-id', name: 'test-folder' }),
      listFiles: vi.fn().mockResolvedValue([]),
    };

    aiGateway = {
      generate: vi.fn().mockResolvedValue(mockAiResponse),
    };

    useCase = new RefineTranscriptUseCase({
      transcriptionRepository,
      refinedTranscriptionRepository,
      videoRepository,
      storageGateway,
      aiGateway,
      generateId: () => `id-${++idCounter}`,
      loadDictionary: vi.fn().mockResolvedValue(mockDictionary),
    });
  });

  it('should refine transcription for a valid video', async () => {
    const result = await useCase.execute('video-1');

    expect(result.id).toBe('id-1');
    expect(result.transcriptionId).toBe('trans-1');
    expect(result.sentenceCount).toBe(2);
    expect(result.dictionaryVersion).toBe('1.0.0');
    expect(result.fullText).toBe('どうも、こんにちは。チームみらい党首の安野たかひろです。');

    expect(transcriptionRepository.findByVideoId).toHaveBeenCalledWith('video-1');
    expect(aiGateway.generate).toHaveBeenCalled();
    expect(refinedTranscriptionRepository.save).toHaveBeenCalled();
  });

  it('should throw NotFoundError when transcription does not exist', async () => {
    vi.mocked(transcriptionRepository.findByVideoId).mockResolvedValue(null);

    await expect(useCase.execute('nonexistent-video')).rejects.toThrow(NotFoundError);
    expect(refinedTranscriptionRepository.save).not.toHaveBeenCalled();
  });

  it('should pass segments to AI gateway in prompt', async () => {
    await useCase.execute('video-1');

    const generateCall = vi.mocked(aiGateway.generate).mock.calls[0][0];
    expect(generateCall).toContain('[0] どうも');
    expect(generateCall).toContain('[1] こんにちは');
    expect(generateCall).toContain('チーム未来 → チームみらい');
  });

  it('should handle AI response with extra text before JSON', async () => {
    const responseWithExtraText = `Here is the refined transcription:\n\n${mockAiResponse}`;
    vi.mocked(aiGateway.generate).mockResolvedValue(responseWithExtraText);

    const result = await useCase.execute('video-1');

    expect(result.sentenceCount).toBe(2);
  });

  it('should throw error for invalid AI response', async () => {
    vi.mocked(aiGateway.generate).mockResolvedValue('This is not valid JSON at all');

    await expect(useCase.execute('video-1')).rejects.toThrow('No valid JSON found');
  });

  it('should throw error for AI response missing sentences array', async () => {
    vi.mocked(aiGateway.generate).mockResolvedValue('{ "data": [] }');

    await expect(useCase.execute('video-1')).rejects.toThrow('missing sentences array');
  });

  it('should throw error for AI response with invalid sentence format', async () => {
    const invalidResponse = JSON.stringify({
      sentences: [
        {
          text: 'Missing other fields',
        },
      ],
    });
    vi.mocked(aiGateway.generate).mockResolvedValue(invalidResponse);

    await expect(useCase.execute('video-1')).rejects.toThrow('missing start');
  });

  it('should save refined transcription with correct data', async () => {
    await useCase.execute('video-1');

    const saveCall = vi.mocked(refinedTranscriptionRepository.save).mock.calls[0][0];
    expect(saveCall.id).toBe('id-1');
    expect(saveCall.transcriptionId).toBe('trans-1');
    expect(saveCall.sentences).toHaveLength(2);
    expect(saveCall.sentences[0].text).toBe('どうも、こんにちは。');
    expect(saveCall.sentences[1].text).toBe('チームみらい党首の安野たかひろです。');
    expect(saveCall.dictionaryVersion).toBe('1.0.0');
  });
});
