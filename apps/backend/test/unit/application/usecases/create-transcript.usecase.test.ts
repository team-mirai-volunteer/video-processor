import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../../../src/application/errors.js';
import { CreateTranscriptUseCase } from '../../../../src/application/usecases/create-transcript.usecase.js';
import type { StorageGateway } from '../../../../src/domain/gateways/storage.gateway.js';
import type { TempStorageGateway } from '../../../../src/domain/gateways/temp-storage.gateway.js';
import type { TranscriptionRepositoryGateway } from '../../../../src/domain/gateways/transcription-repository.gateway.js';
import type {
  TranscriptionGateway,
  TranscriptionResult,
} from '../../../../src/domain/gateways/transcription.gateway.js';
import type { VideoProcessingGateway } from '../../../../src/domain/gateways/video-processing.gateway.js';
import type { VideoRepositoryGateway } from '../../../../src/domain/gateways/video-repository.gateway.js';
import { Video } from '../../../../src/domain/models/video.js';

describe('CreateTranscriptUseCase', () => {
  let useCase: CreateTranscriptUseCase;
  let videoRepository: VideoRepositoryGateway;
  let transcriptionRepository: TranscriptionRepositoryGateway;
  let storageGateway: StorageGateway;
  let tempStorageGateway: TempStorageGateway;
  let transcriptionGateway: TranscriptionGateway;
  let videoProcessingGateway: VideoProcessingGateway;
  let idCounter: number;

  const mockVideo = Video.fromProps({
    id: 'video-1',
    googleDriveFileId: 'abc123',
    googleDriveUrl: 'https://drive.google.com/file/d/abc123/view',
    title: null,
    description: null,
    durationSeconds: null,
    fileSizeBytes: null,
    status: 'pending',
    errorMessage: null,
    gcsUri: null,
    gcsExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockTranscriptionResult: TranscriptionResult = {
    fullText: 'This is a test transcription.',
    segments: [
      { text: 'This', startTimeSeconds: 0, endTimeSeconds: 0.5, confidence: 0.95 },
      { text: 'is', startTimeSeconds: 0.5, endTimeSeconds: 0.8, confidence: 0.92 },
      { text: 'a', startTimeSeconds: 0.8, endTimeSeconds: 1.0, confidence: 0.98 },
      { text: 'test', startTimeSeconds: 1.0, endTimeSeconds: 1.5, confidence: 0.9 },
      { text: 'transcription', startTimeSeconds: 1.5, endTimeSeconds: 2.5, confidence: 0.88 },
    ],
    languageCode: 'en-US',
    durationSeconds: 2.5,
  };

  beforeEach(() => {
    idCounter = 0;

    videoRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(mockVideo),
      findByGoogleDriveFileId: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue({ videos: [], total: 0 }),
    };

    transcriptionRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByVideoId: vi.fn().mockResolvedValue(null),
      deleteByVideoId: vi.fn().mockResolvedValue(undefined),
    };

    storageGateway = {
      downloadFile: vi.fn().mockResolvedValue(Buffer.from('video content')),
      uploadFile: vi.fn().mockResolvedValue({ id: 'uploaded-id', webViewLink: 'http://link' }),
      getFileMetadata: vi.fn().mockResolvedValue({ name: 'Test Video', size: 1000, parents: [] }),
      findOrCreateFolder: vi.fn().mockResolvedValue({ id: 'folder-id', name: 'folder' }),
    };

    tempStorageGateway = {
      upload: vi.fn().mockResolvedValue({
        gcsUri: 'gs://bucket/videos/video-1/original.mp4',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
      download: vi.fn().mockResolvedValue(Buffer.from('video content')),
      exists: vi.fn().mockResolvedValue(false),
    };

    transcriptionGateway = {
      transcribe: vi.fn().mockResolvedValue(mockTranscriptionResult),
      transcribeLongAudio: vi.fn().mockResolvedValue(mockTranscriptionResult),
    };

    videoProcessingGateway = {
      extractAudio: vi.fn().mockResolvedValue(Buffer.from('audio content')),
      extractClip: vi.fn().mockResolvedValue(Buffer.from('clip content')),
    };

    useCase = new CreateTranscriptUseCase({
      videoRepository,
      transcriptionRepository,
      storageGateway,
      tempStorageGateway,
      transcriptionGateway,
      videoProcessingGateway,
      generateId: () => `id-${++idCounter}`,
    });
  });

  it('should create transcription for a valid video', async () => {
    const result = await useCase.execute('video-1');

    expect(result.videoId).toBe('video-1');
    expect(result.transcriptionId).toBe('id-1');

    expect(videoRepository.findById).toHaveBeenCalledWith('video-1');
    expect(storageGateway.downloadFile).toHaveBeenCalledWith('abc123');
    expect(videoProcessingGateway.extractAudio).toHaveBeenCalled();
    expect(transcriptionGateway.transcribeLongAudio).toHaveBeenCalled();
    expect(transcriptionRepository.save).toHaveBeenCalled();

    // Verify video status was updated to transcribed
    const saveCallArgs = vi.mocked(videoRepository.save).mock.calls;
    const lastSaveCall = saveCallArgs[saveCallArgs.length - 1][0];
    expect(lastSaveCall.status).toBe('transcribed');
  });

  it('should throw NotFoundError when video does not exist', async () => {
    vi.mocked(videoRepository.findById).mockResolvedValue(null);

    await expect(useCase.execute('nonexistent-video')).rejects.toThrow(NotFoundError);
    expect(transcriptionRepository.save).not.toHaveBeenCalled();
  });

  it('should use cached video from GCS if available', async () => {
    const videoWithGcs = Video.fromProps({
      ...mockVideo.toProps(),
      gcsUri: 'gs://bucket/videos/video-1/original.mp4',
      gcsExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    vi.mocked(videoRepository.findById).mockResolvedValue(videoWithGcs);
    vi.mocked(tempStorageGateway.exists).mockResolvedValue(true);

    await useCase.execute('video-1');

    expect(tempStorageGateway.download).toHaveBeenCalledWith(
      'gs://bucket/videos/video-1/original.mp4'
    );
    expect(storageGateway.downloadFile).not.toHaveBeenCalled();
  });

  it('should download from Google Drive and cache to GCS if not cached', async () => {
    vi.mocked(tempStorageGateway.exists).mockResolvedValue(false);

    await useCase.execute('video-1');

    expect(storageGateway.downloadFile).toHaveBeenCalledWith('abc123');
    expect(tempStorageGateway.upload).toHaveBeenCalled();
  });

  it('should update video status to failed on error', async () => {
    vi.mocked(transcriptionGateway.transcribeLongAudio).mockRejectedValue(
      new Error('Transcription failed')
    );

    await expect(useCase.execute('video-1')).rejects.toThrow('Transcription failed');

    const saveCallArgs = vi.mocked(videoRepository.save).mock.calls;
    const lastSaveCall = saveCallArgs[saveCallArgs.length - 1][0];
    expect(lastSaveCall.status).toBe('failed');
    expect(lastSaveCall.errorMessage).toBe('Transcription failed');
  });
});
