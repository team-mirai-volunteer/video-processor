import { NotFoundError } from '@clip-video/application/errors/errors.js';
import type { CacheVideoUseCase } from '@clip-video/application/usecases/cache-video.usecase.js';
import { CreateTranscriptUseCase } from '@clip-video/application/usecases/create-transcript.usecase.js';
import type { ExtractAudioUseCase } from '@clip-video/application/usecases/extract-audio.usecase.js';
import type { TranscribeAudioUseCase } from '@clip-video/application/usecases/transcribe-audio.usecase.js';
import type { VideoRepositoryGateway } from '@clip-video/domain/gateways/video-repository.gateway.js';
import { Video } from '@clip-video/domain/models/video.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('CreateTranscriptUseCase', () => {
  let useCase: CreateTranscriptUseCase;
  let videoRepository: VideoRepositoryGateway;
  let cacheVideoUseCase: CacheVideoUseCase;
  let extractAudioUseCase: ExtractAudioUseCase;
  let transcribeAudioUseCase: TranscribeAudioUseCase;

  const mockVideo = Video.fromProps({
    id: 'video-1',
    googleDriveFileId: 'abc123',
    googleDriveUrl: 'https://drive.google.com/file/d/abc123/view',
    title: null,
    description: null,
    durationSeconds: null,
    fileSizeBytes: null,
    status: 'pending',
    transcriptionPhase: null,
    progressMessage: null,
    errorMessage: null,
    gcsUri: null,
    gcsExpiresAt: null,
    audioGcsUri: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    videoRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(mockVideo),
      findByGoogleDriveFileId: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue({ videos: [], total: 0 }),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    cacheVideoUseCase = {
      execute: vi.fn().mockResolvedValue({
        videoId: 'video-1',
        gcsUri: 'gs://bucket/videos/video-1/original.mp4',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        cached: false,
      }),
    } as unknown as CacheVideoUseCase;

    extractAudioUseCase = {
      execute: vi.fn().mockResolvedValue({
        videoId: 'video-1',
        audioGcsUri: 'gs://bucket/videos/video-1/audio.flac',
        format: 'flac',
      }),
    } as unknown as ExtractAudioUseCase;

    transcribeAudioUseCase = {
      execute: vi.fn().mockResolvedValue({
        videoId: 'video-1',
        transcriptionId: 'transcription-1',
        fullText: 'This is a test transcription.',
        segmentsCount: 5,
        durationSeconds: 2.5,
      }),
    } as unknown as TranscribeAudioUseCase;

    useCase = new CreateTranscriptUseCase({
      videoRepository,
      cacheVideoUseCase,
      extractAudioUseCase,
      transcribeAudioUseCase,
    });
  });

  it('should create transcription for a valid video', async () => {
    const result = await useCase.execute('video-1');

    expect(result.videoId).toBe('video-1');
    expect(result.transcriptionId).toBe('transcription-1');

    expect(videoRepository.findById).toHaveBeenCalledWith('video-1');
    expect(cacheVideoUseCase.execute).toHaveBeenCalledWith('video-1');
    expect(extractAudioUseCase.execute).toHaveBeenCalledWith('video-1', 'flac');
    expect(transcribeAudioUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        videoId: 'video-1',
        audioGcsUri: 'gs://bucket/videos/video-1/audio.flac',
      })
    );
    // onProgress callback should also be passed
    const callArg = vi.mocked(transcribeAudioUseCase.execute).mock.calls[0]?.[0];
    expect(callArg).toHaveProperty('onProgress');
    expect(typeof callArg?.onProgress).toBe('function');

    // Verify video status was updated to transcribed
    const saveCallArgs = vi.mocked(videoRepository.save).mock.calls;
    const lastSaveCall = saveCallArgs[saveCallArgs.length - 1]?.[0];
    expect(lastSaveCall?.status).toBe('transcribed');
  });

  it('should throw NotFoundError when video does not exist', async () => {
    vi.mocked(videoRepository.findById).mockResolvedValue(null);

    await expect(useCase.execute('nonexistent-video')).rejects.toThrow(NotFoundError);
    expect(cacheVideoUseCase.execute).not.toHaveBeenCalled();
  });

  it('should use cached video if already cached', async () => {
    vi.mocked(cacheVideoUseCase.execute).mockResolvedValue({
      videoId: 'video-1',
      gcsUri: 'gs://bucket/videos/video-1/original.mp4',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      cached: true, // Already cached
    });

    await useCase.execute('video-1');

    expect(cacheVideoUseCase.execute).toHaveBeenCalledWith('video-1');
    expect(extractAudioUseCase.execute).toHaveBeenCalled();
  });

  it('should update video status to failed on error', async () => {
    vi.mocked(transcribeAudioUseCase.execute).mockRejectedValue(new Error('Transcription failed'));

    await expect(useCase.execute('video-1')).rejects.toThrow('Transcription failed');

    const saveCallArgs = vi.mocked(videoRepository.save).mock.calls;
    const lastSaveCall = saveCallArgs[saveCallArgs.length - 1]?.[0];
    expect(lastSaveCall?.status).toBe('failed');
    expect(lastSaveCall?.errorMessage).toBe('Transcription failed');
  });

  it('should update phases in order during execution', async () => {
    await useCase.execute('video-1');

    const saveCallArgs = vi.mocked(videoRepository.save).mock.calls;
    const phases = saveCallArgs.map((call) => call[0].transcriptionPhase);

    // Check phase progression: downloading -> extracting_audio -> transcribing -> null (completed)
    expect(phases[0]).toBe('downloading');
    expect(phases[1]).toBe('extracting_audio');
    expect(phases[2]).toBe('transcribing');
    // Final save clears phase (status becomes 'transcribed')
    expect(phases[phases.length - 1]).toBeNull();
  });
});
