import type { ClipExtractionResponse } from '@video-processor/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoProcessingService } from '../../../../src/application/services/video-processing.service.js';
import { ExtractClipsUseCase } from '../../../../src/application/usecases/extract-clips.usecase.js';
import type { AiGateway } from '../../../../src/domain/gateways/ai.gateway.js';
import type { ClipRepositoryGateway } from '../../../../src/domain/gateways/clip-repository.gateway.js';
import type { StorageGateway } from '../../../../src/domain/gateways/storage.gateway.js';
import type { TempStorageGateway } from '../../../../src/domain/gateways/temp-storage.gateway.js';
import type {
  TranscriptionEntity,
  TranscriptionRepositoryGateway,
} from '../../../../src/domain/gateways/transcription-repository.gateway.js';
import type { VideoRepositoryGateway } from '../../../../src/domain/gateways/video-repository.gateway.js';
import { Video } from '../../../../src/domain/models/video.js';

describe('ExtractClipsUseCase', () => {
  // Mock dependencies
  const mockVideoRepository: VideoRepositoryGateway = {
    save: vi.fn(),
    findById: vi.fn(),
    findByGoogleDriveFileId: vi.fn(),
    findMany: vi.fn(),
  };

  const mockClipRepository: ClipRepositoryGateway = {
    save: vi.fn(),
    saveMany: vi.fn(),
    findById: vi.fn(),
    findByVideoId: vi.fn(),
  };

  const mockTranscriptionRepository: TranscriptionRepositoryGateway = {
    save: vi.fn(),
    findByVideoId: vi.fn(),
    delete: vi.fn(),
  };

  const mockStorageGateway: StorageGateway = {
    getFileMetadata: vi.fn(),
    downloadFile: vi.fn(),
    uploadFile: vi.fn(),
    createFolder: vi.fn(),
    findOrCreateFolder: vi.fn(),
  };

  const mockTempStorageGateway: TempStorageGateway = {
    upload: vi.fn(),
    download: vi.fn(),
    exists: vi.fn(),
  };

  const mockAiGateway: AiGateway = {
    generate: vi.fn(),
  };

  const mockVideoProcessingService: VideoProcessingService = {
    extractClip: vi.fn(),
    getVideoDuration: vi.fn(),
    extractAudio: vi.fn(),
  };

  let useCase: ExtractClipsUseCase;

  beforeEach(() => {
    vi.clearAllMocks();

    useCase = new ExtractClipsUseCase({
      videoRepository: mockVideoRepository,
      clipRepository: mockClipRepository,
      transcriptionRepository: mockTranscriptionRepository,
      storageGateway: mockStorageGateway,
      tempStorageGateway: mockTempStorageGateway,
      aiGateway: mockAiGateway,
      videoProcessingService: mockVideoProcessingService,
      generateId: () => 'test-id',
    });
  });

  describe('execute', () => {
    const mockVideo = Video.fromProps({
      id: 'video-1',
      googleDriveFileId: 'file-123',
      googleDriveUrl: 'https://drive.google.com/file/d/file-123/view',
      title: 'Test Video',
      description: null,
      durationSeconds: 600,
      fileSizeBytes: 1000000,
      status: 'transcribed',
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockTranscription: TranscriptionEntity = {
      id: 'transcription-1',
      videoId: 'video-1',
      fullText: 'Hello, this is a test video.',
      segments: [
        {
          text: 'Hello, this is a test video.',
          startTimeSeconds: 0,
          endTimeSeconds: 5,
          confidence: 0.95,
        },
      ],
      languageCode: 'ja-JP',
      durationSeconds: 600,
      createdAt: new Date(),
    };

    const mockAiResponse: ClipExtractionResponse = {
      clips: [
        {
          title: 'Introduction',
          startTime: '00:00:00',
          endTime: '00:00:30',
          transcript: 'Hello, this is a test video.',
          reason: 'Opening segment',
        },
      ],
    };

    it('should throw error if video not found', async () => {
      vi.mocked(mockVideoRepository.findById).mockResolvedValue(null);

      await expect(
        useCase.execute({
          videoId: 'non-existent',
          clipInstructions: 'Extract highlights',
        })
      ).rejects.toThrow('Video with id non-existent not found');
    });

    it('should throw error if transcription not found', async () => {
      vi.mocked(mockVideoRepository.findById).mockResolvedValue(mockVideo);
      vi.mocked(mockTranscriptionRepository.findByVideoId).mockResolvedValue(null);

      await expect(
        useCase.execute({
          videoId: 'video-1',
          clipInstructions: 'Extract highlights',
        })
      ).rejects.toThrow('Transcription not found for video video-1');
    });

    it('should throw error if clipInstructions is empty', async () => {
      await expect(
        useCase.execute({
          videoId: 'video-1',
          clipInstructions: '   ',
        })
      ).rejects.toThrow('clipInstructions is required');
    });

    it('should successfully extract clips when all dependencies are available', async () => {
      // Setup mocks
      vi.mocked(mockVideoRepository.findById).mockResolvedValue(mockVideo);
      vi.mocked(mockTranscriptionRepository.findByVideoId).mockResolvedValue(mockTranscription);
      vi.mocked(mockStorageGateway.getFileMetadata).mockResolvedValue({
        id: 'file-123',
        name: 'Test Video.mp4',
        mimeType: 'video/mp4',
        size: 1000000,
        webViewLink: 'https://drive.google.com/file/d/file-123/view',
        parents: ['parent-folder'],
      });
      vi.mocked(mockAiGateway.generate).mockResolvedValue(JSON.stringify(mockAiResponse));
      vi.mocked(mockStorageGateway.downloadFile).mockResolvedValue(Buffer.from('video-data'));
      vi.mocked(mockTempStorageGateway.upload).mockResolvedValue({
        gcsUri: 'gs://bucket/video.mp4',
        expiresAt: new Date(),
      });
      vi.mocked(mockStorageGateway.findOrCreateFolder).mockResolvedValue({
        id: 'shorts-folder',
        name: 'ショート用',
        mimeType: 'application/vnd.google-apps.folder',
        size: 0,
        webViewLink: 'https://drive.google.com/drive/folders/shorts-folder',
      });
      vi.mocked(mockVideoProcessingService.extractClip).mockResolvedValue(Buffer.from('clip-data'));
      vi.mocked(mockStorageGateway.uploadFile).mockResolvedValue({
        id: 'clip-file-1',
        name: 'Introduction.mp4',
        mimeType: 'video/mp4',
        size: 50000,
        webViewLink: 'https://drive.google.com/file/d/clip-file-1/view',
      });

      const result = await useCase.execute({
        videoId: 'video-1',
        clipInstructions: 'Extract the introduction',
      });

      expect(result).toEqual({
        videoId: 'video-1',
        status: 'completed',
      });

      // Verify the video status was updated
      expect(mockVideoRepository.save).toHaveBeenCalled();
      expect(mockClipRepository.saveMany).toHaveBeenCalled();
    });

    it('should update video status to failed on error', async () => {
      vi.mocked(mockVideoRepository.findById).mockResolvedValue(mockVideo);
      vi.mocked(mockTranscriptionRepository.findByVideoId).mockResolvedValue(mockTranscription);
      vi.mocked(mockStorageGateway.getFileMetadata).mockRejectedValue(
        new Error('Failed to get metadata')
      );

      await expect(
        useCase.execute({
          videoId: 'video-1',
          clipInstructions: 'Extract highlights',
        })
      ).rejects.toThrow('Failed to get metadata');

      // Verify the video status was updated to failed
      const saveCall = vi
        .mocked(mockVideoRepository.save)
        .mock.calls.find((call) => call[0].status === 'failed');
      expect(saveCall).toBeDefined();
    });
  });
});
