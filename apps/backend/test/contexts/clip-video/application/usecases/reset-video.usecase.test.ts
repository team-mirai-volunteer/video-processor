import { NotFoundError } from '@clip-video/application/errors/errors.js';
import { ResetVideoUseCase } from '@clip-video/application/usecases/reset-video.usecase.js';
import type { RefinedTranscriptionRepositoryGateway } from '@clip-video/domain/gateways/refined-transcription-repository.gateway.js';
import type { TranscriptionRepositoryGateway } from '@clip-video/domain/gateways/transcription-repository.gateway.js';
import type { VideoRepositoryGateway } from '@clip-video/domain/gateways/video-repository.gateway.js';
import { Transcription } from '@clip-video/domain/models/transcription.js';
import { Video } from '@clip-video/domain/models/video.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ResetVideoUseCase', () => {
  let useCase: ResetVideoUseCase;
  let videoRepository: VideoRepositoryGateway;
  let transcriptionRepository: TranscriptionRepositoryGateway;
  let refinedTranscriptionRepository: RefinedTranscriptionRepositoryGateway;

  const createVideo = (id: string, status: 'pending' | 'completed' | 'transcribed' = 'completed') =>
    Video.fromProps({
      id,
      googleDriveFileId: `file-${id}`,
      googleDriveUrl: `https://drive.google.com/file/d/file-${id}/view`,
      title: `Video ${id}`,
      description: null,
      durationSeconds: 3600,
      fileSizeBytes: 1000000,
      status,
      transcriptionPhase: null,
      progressMessage: 'Processing...',
      errorMessage: null,
      gcsUri: 'gs://bucket/video.mp4',
      gcsExpiresAt: new Date(),
      audioGcsUri: 'gs://bucket/audio.flac',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

  const createTranscription = (videoId: string) =>
    Transcription.fromProps({
      id: 'transcription-1',
      videoId,
      fullText: 'Hello world',
      segments: [{ text: 'Hello', startTimeSeconds: 0, endTimeSeconds: 1, confidence: 0.95 }],
      languageCode: 'ja-JP',
      durationSeconds: 120,
      createdAt: new Date(),
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
      findByVideoId: vi.fn().mockResolvedValue(null),
      deleteByVideoId: vi.fn(),
    };

    refinedTranscriptionRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByTranscriptionId: vi.fn(),
      deleteByTranscriptionId: vi.fn(),
    };

    useCase = new ResetVideoUseCase({
      videoRepository,
      transcriptionRepository,
      refinedTranscriptionRepository,
    });
  });

  it('should throw NotFoundError when video does not exist', async () => {
    vi.mocked(videoRepository.findById).mockResolvedValue(null);

    await expect(useCase.execute('non-existent')).rejects.toThrow(NotFoundError);
  });

  describe('step: refine', () => {
    it('should clear refined transcription and set status to transcribed', async () => {
      const video = createVideo('video-1');
      const transcription = createTranscription('video-1');
      vi.mocked(videoRepository.findById).mockResolvedValue(video);
      vi.mocked(transcriptionRepository.findByVideoId).mockResolvedValue(transcription);

      const result = await useCase.execute('video-1', 'refine');

      expect(result.status).toBe('transcribed');
      expect(result.resetStep).toBe('refine');
      expect(refinedTranscriptionRepository.deleteByTranscriptionId).toHaveBeenCalledWith(
        'transcription-1'
      );
      expect(videoRepository.save).toHaveBeenCalled();
    });

    it('should handle case where transcription does not exist', async () => {
      const video = createVideo('video-1');
      vi.mocked(videoRepository.findById).mockResolvedValue(video);
      vi.mocked(transcriptionRepository.findByVideoId).mockResolvedValue(null);

      const result = await useCase.execute('video-1', 'refine');

      expect(result.status).toBe('transcribed');
      expect(refinedTranscriptionRepository.deleteByTranscriptionId).not.toHaveBeenCalled();
    });
  });

  describe('step: transcribe', () => {
    it('should clear transcription and set status to pending', async () => {
      const video = createVideo('video-1');
      vi.mocked(videoRepository.findById).mockResolvedValue(video);

      const result = await useCase.execute('video-1', 'transcribe');

      expect(result.status).toBe('pending');
      expect(result.resetStep).toBe('transcribe');
      expect(transcriptionRepository.deleteByVideoId).toHaveBeenCalledWith('video-1');
    });
  });

  describe('step: audio', () => {
    it('should clear transcription and set status to pending', async () => {
      const video = createVideo('video-1');
      vi.mocked(videoRepository.findById).mockResolvedValue(video);

      const result = await useCase.execute('video-1', 'audio');

      expect(result.status).toBe('pending');
      expect(result.resetStep).toBe('audio');
      expect(transcriptionRepository.deleteByVideoId).toHaveBeenCalledWith('video-1');
    });
  });

  describe('step: cache', () => {
    it('should do full reset clearing transcription and cache', async () => {
      const video = createVideo('video-1');
      vi.mocked(videoRepository.findById).mockResolvedValue(video);

      const result = await useCase.execute('video-1', 'cache');

      expect(result.status).toBe('pending');
      expect(result.resetStep).toBe('cache');
      expect(transcriptionRepository.deleteByVideoId).toHaveBeenCalledWith('video-1');
    });
  });

  describe('step: all (default)', () => {
    it('should do full reset', async () => {
      const video = createVideo('video-1');
      vi.mocked(videoRepository.findById).mockResolvedValue(video);

      const result = await useCase.execute('video-1');

      expect(result.status).toBe('pending');
      expect(result.resetStep).toBe('all');
      expect(transcriptionRepository.deleteByVideoId).toHaveBeenCalledWith('video-1');
    });
  });
});
