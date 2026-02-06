import { NotFoundError } from '@clip-video/application/errors/errors.js';
import { GetVideoUseCase } from '@clip-video/application/usecases/get-video.usecase.js';
import type { ClipRepositoryGateway } from '@clip-video/domain/gateways/clip-repository.gateway.js';
import type { ProcessingJobRepositoryGateway } from '@clip-video/domain/gateways/processing-job-repository.gateway.js';
import type { TranscriptionRepositoryGateway } from '@clip-video/domain/gateways/transcription-repository.gateway.js';
import type { VideoRepositoryGateway } from '@clip-video/domain/gateways/video-repository.gateway.js';
import { Clip } from '@clip-video/domain/models/clip.js';
import { ProcessingJob } from '@clip-video/domain/models/processing-job.js';
import { Transcription } from '@clip-video/domain/models/transcription.js';
import { Video } from '@clip-video/domain/models/video.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GetVideoUseCase', () => {
  let useCase: GetVideoUseCase;
  let videoRepository: VideoRepositoryGateway;
  let clipRepository: ClipRepositoryGateway;
  let processingJobRepository: ProcessingJobRepositoryGateway;
  let transcriptionRepository: TranscriptionRepositoryGateway;

  const createVideo = (id: string) =>
    Video.fromProps({
      id,
      googleDriveFileId: `file-${id}`,
      googleDriveUrl: `https://drive.google.com/file/d/file-${id}/view`,
      title: `Video ${id}`,
      description: null,
      durationSeconds: 3600,
      fileSizeBytes: 1000000,
      status: 'completed',
      transcriptionPhase: null,
      progressMessage: null,
      errorMessage: null,
      gcsUri: null,
      gcsExpiresAt: null,
      audioGcsUri: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    });

  const createClip = (id: string) =>
    Clip.fromProps({
      id,
      videoId: 'video-1',
      googleDriveFileId: `drive-file-${id}`,
      googleDriveUrl: `https://drive.google.com/file/d/drive-file-${id}/view`,
      title: `Clip ${id}`,
      startTimeSeconds: 0,
      endTimeSeconds: 30,
      durationSeconds: 30,
      transcript: 'Test transcript',
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
    });

  const createProcessingJob = (id: string) =>
    ProcessingJob.fromProps({
      id,
      videoId: 'video-1',
      clipInstructions: 'Extract interesting parts',
      status: 'completed',
      aiResponse: null,
      errorMessage: null,
      startedAt: new Date(),
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

  const createTranscription = () =>
    Transcription.fromProps({
      id: 'transcription-1',
      videoId: 'video-1',
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

    clipRepository = {
      save: vi.fn(),
      saveMany: vi.fn(),
      findById: vi.fn(),
      findByVideoId: vi.fn().mockResolvedValue([]),
      findAllPaginated: vi.fn(),
      delete: vi.fn(),
    };

    processingJobRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByVideoId: vi.fn().mockResolvedValue([]),
      findPending: vi.fn(),
    };

    transcriptionRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByVideoId: vi.fn().mockResolvedValue(null),
      deleteByVideoId: vi.fn(),
    };

    useCase = new GetVideoUseCase({
      videoRepository,
      clipRepository,
      processingJobRepository,
      transcriptionRepository,
    });
  });

  it('should return video with all related data', async () => {
    const video = createVideo('video-1');
    const clips = [createClip('clip-1')];
    const jobs = [createProcessingJob('job-1')];
    const transcription = createTranscription();

    vi.mocked(videoRepository.findById).mockResolvedValue(video);
    vi.mocked(clipRepository.findByVideoId).mockResolvedValue(clips);
    vi.mocked(processingJobRepository.findByVideoId).mockResolvedValue(jobs);
    vi.mocked(transcriptionRepository.findByVideoId).mockResolvedValue(transcription);

    const result = await useCase.execute('video-1');

    expect(result.id).toBe('video-1');
    expect(result.title).toBe('Video video-1');
    expect(result.clips).toHaveLength(1);
    expect(result.clips[0].id).toBe('clip-1');
    expect(result.processingJobs).toHaveLength(1);
    expect(result.processingJobs[0].id).toBe('job-1');
    expect(result.transcription).not.toBeNull();
    expect(result.transcription?.id).toBe('transcription-1');
  });

  it('should return video with no related data', async () => {
    const video = createVideo('video-1');
    vi.mocked(videoRepository.findById).mockResolvedValue(video);

    const result = await useCase.execute('video-1');

    expect(result.id).toBe('video-1');
    expect(result.clips).toHaveLength(0);
    expect(result.processingJobs).toHaveLength(0);
    expect(result.transcription).toBeNull();
  });

  it('should throw NotFoundError when video does not exist', async () => {
    vi.mocked(videoRepository.findById).mockResolvedValue(null);

    await expect(useCase.execute('non-existent')).rejects.toThrow(NotFoundError);
  });

  it('should fetch clips, jobs, and transcription in parallel', async () => {
    const video = createVideo('video-1');
    vi.mocked(videoRepository.findById).mockResolvedValue(video);

    await useCase.execute('video-1');

    expect(clipRepository.findByVideoId).toHaveBeenCalledWith('video-1');
    expect(processingJobRepository.findByVideoId).toHaveBeenCalledWith('video-1');
    expect(transcriptionRepository.findByVideoId).toHaveBeenCalledWith('video-1');
  });
});
