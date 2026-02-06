import { NotFoundError } from '@clip-video/application/errors/errors.js';
import { TranscribeAudioUseCase } from '@clip-video/application/usecases/transcribe-audio.usecase.js';
import type { TranscriptionRepositoryGateway } from '@clip-video/domain/gateways/transcription-repository.gateway.js';
import type { TranscriptionGateway } from '@clip-video/domain/gateways/transcription.gateway.js';
import type { VideoRepositoryGateway } from '@clip-video/domain/gateways/video-repository.gateway.js';
import { Video } from '@clip-video/domain/models/video.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('TranscribeAudioUseCase', () => {
  let useCase: TranscribeAudioUseCase;
  let videoRepository: VideoRepositoryGateway;
  let transcriptionRepository: TranscriptionRepositoryGateway;
  let transcriptionGateway: TranscriptionGateway;
  const generateId = () => 'generated-id';

  const createVideo = (id: string) =>
    Video.fromProps({
      id,
      googleDriveFileId: `file-${id}`,
      googleDriveUrl: `https://drive.google.com/file/d/file-${id}/view`,
      title: `Video ${id}`,
      description: null,
      durationSeconds: 3600,
      fileSizeBytes: 1000000,
      status: 'transcribing',
      transcriptionPhase: null,
      progressMessage: null,
      errorMessage: null,
      gcsUri: null,
      gcsExpiresAt: null,
      audioGcsUri: 'gs://bucket/audio.flac',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

  beforeEach(() => {
    videoRepository = {
      save: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
      findByGoogleDriveFileId: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    };

    transcriptionRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByVideoId: vi.fn(),
      deleteByVideoId: vi.fn(),
    };

    transcriptionGateway = {
      transcribe: vi.fn(),
      transcribeLongAudio: vi.fn(),
      transcribeLongAudioFromGcsUri: vi.fn().mockResolvedValue({
        fullText: 'こんにちは世界',
        segments: [
          { text: 'こんにちは', startTimeSeconds: 0, endTimeSeconds: 2, confidence: 0.95 },
          { text: '世界', startTimeSeconds: 2, endTimeSeconds: 4, confidence: 0.9 },
        ],
        languageCode: 'ja-JP',
        durationSeconds: 120,
      }),
    };

    useCase = new TranscribeAudioUseCase({
      videoRepository,
      transcriptionRepository,
      transcriptionGateway,
      generateId,
    });
  });

  it('should transcribe audio and save transcription', async () => {
    const video = createVideo('video-1');
    vi.mocked(videoRepository.findById).mockResolvedValue(video);

    const result = await useCase.execute({
      videoId: 'video-1',
      audioGcsUri: 'gs://bucket/audio.flac',
    });

    expect(result.videoId).toBe('video-1');
    expect(result.transcriptionId).toBe('generated-id');
    expect(result.fullText).toBe('こんにちは世界');
    expect(result.segmentsCount).toBe(2);
    expect(result.durationSeconds).toBe(120);
    expect(transcriptionGateway.transcribeLongAudioFromGcsUri).toHaveBeenCalledWith({
      gcsUri: 'gs://bucket/audio.flac',
      onProgress: undefined,
    });
    expect(transcriptionRepository.save).toHaveBeenCalled();
  });

  it('should throw NotFoundError when video does not exist', async () => {
    vi.mocked(videoRepository.findById).mockResolvedValue(null);

    await expect(
      useCase.execute({ videoId: 'non-existent', audioGcsUri: 'gs://bucket/audio.flac' })
    ).rejects.toThrow(NotFoundError);
  });

  it('should pass onProgress callback to transcription gateway', async () => {
    const video = createVideo('video-1');
    vi.mocked(videoRepository.findById).mockResolvedValue(video);
    const onProgress = vi.fn();

    await useCase.execute({
      videoId: 'video-1',
      audioGcsUri: 'gs://bucket/audio.flac',
      onProgress,
    });

    expect(transcriptionGateway.transcribeLongAudioFromGcsUri).toHaveBeenCalledWith({
      gcsUri: 'gs://bucket/audio.flac',
      onProgress,
    });
  });

  it('should throw error when transcription domain creation fails', async () => {
    const video = createVideo('video-1');
    vi.mocked(videoRepository.findById).mockResolvedValue(video);
    vi.mocked(transcriptionGateway.transcribeLongAudioFromGcsUri).mockResolvedValue({
      fullText: '',
      segments: [],
      languageCode: 'ja-JP',
      durationSeconds: 120,
    });

    await expect(
      useCase.execute({ videoId: 'video-1', audioGcsUri: 'gs://bucket/audio.flac' })
    ).rejects.toThrow();
  });
});
