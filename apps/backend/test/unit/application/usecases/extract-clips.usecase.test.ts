import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import type { ClipExtractionResponse } from '@video-processor/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExtractClipsUseCase } from '../../../../src/application/usecases/extract-clips.usecase.js';
import type { AiGateway } from '../../../../src/domain/gateways/ai.gateway.js';
import type { ClipRepositoryGateway } from '../../../../src/domain/gateways/clip-repository.gateway.js';
import type { RefinedTranscriptionRepositoryGateway } from '../../../../src/domain/gateways/refined-transcription-repository.gateway.js';
import type { StorageGateway } from '../../../../src/domain/gateways/storage.gateway.js';
import type { TempStorageGateway } from '../../../../src/domain/gateways/temp-storage.gateway.js';
import type { TranscriptionRepositoryGateway } from '../../../../src/domain/gateways/transcription-repository.gateway.js';
import type { VideoProcessingGateway } from '../../../../src/domain/gateways/video-processing.gateway.js';
import type { VideoRepositoryGateway } from '../../../../src/domain/gateways/video-repository.gateway.js';
import { RefinedTranscription } from '../../../../src/domain/models/refined-transcription.js';
import { Transcription } from '../../../../src/domain/models/transcription.js';
import { Video } from '../../../../src/domain/models/video.js';

describe('ExtractClipsUseCase', () => {
  // Mock dependencies
  const mockVideoRepository: VideoRepositoryGateway = {
    save: vi.fn(),
    findById: vi.fn(),
    findByGoogleDriveFileId: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
  };

  const mockClipRepository: ClipRepositoryGateway = {
    save: vi.fn(),
    saveMany: vi.fn(),
    findById: vi.fn(),
    findByVideoId: vi.fn(),
  };

  const mockTranscriptionRepository: TranscriptionRepositoryGateway = {
    save: vi.fn(),
    findById: vi.fn(),
    findByVideoId: vi.fn(),
    deleteByVideoId: vi.fn(),
  };

  const mockStorageGateway: StorageGateway = {
    getFileMetadata: vi.fn(),
    downloadFile: vi.fn(),
    downloadFileAsStream: vi.fn(),
    uploadFile: vi.fn(),
    createFolder: vi.fn(),
    findOrCreateFolder: vi.fn(),
  };

  const mockTempStorageGateway: TempStorageGateway = {
    upload: vi.fn(),
    uploadFromStream: vi.fn(),
    download: vi.fn(),
    downloadAsStream: vi.fn(),
    exists: vi.fn(),
  };

  const mockAiGateway: AiGateway = {
    generate: vi.fn(),
  };

  const mockVideoProcessingGateway: VideoProcessingGateway = {
    extractClip: vi.fn(),
    extractClipFromFile: vi.fn(),
    getVideoDuration: vi.fn(),
    extractAudioFromFile: vi.fn(),
  };

  const mockRefinedTranscriptionRepository: RefinedTranscriptionRepositoryGateway = {
    save: vi.fn(),
    findById: vi.fn(),
    findByTranscriptionId: vi.fn(),
    deleteByTranscriptionId: vi.fn(),
  };

  let useCase: ExtractClipsUseCase;
  let tempTestDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempTestDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'extract-clips-test-'));

    useCase = new ExtractClipsUseCase({
      videoRepository: mockVideoRepository,
      clipRepository: mockClipRepository,
      transcriptionRepository: mockTranscriptionRepository,
      refinedTranscriptionRepository: mockRefinedTranscriptionRepository,
      storageGateway: mockStorageGateway,
      tempStorageGateway: mockTempStorageGateway,
      aiGateway: mockAiGateway,
      videoProcessingGateway: mockVideoProcessingGateway,
      generateId: () => 'test-id',
    });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      const files = await fs.promises.readdir(tempTestDir);
      await Promise.all(files.map((file) => fs.promises.unlink(path.join(tempTestDir, file))));
      await fs.promises.rmdir(tempTestDir);
    } catch {
      // Ignore cleanup errors
    }
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
      transcriptionPhase: null,
      errorMessage: null,
      gcsUri: null,
      gcsExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockTranscription = Transcription.fromProps({
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
    });

    const mockRefinedTranscription = RefinedTranscription.fromProps({
      id: 'refined-1',
      transcriptionId: 'transcription-1',
      fullText: 'Hello, this is a test video.',
      sentences: [
        {
          text: 'Hello, this is a test video.',
          startTimeSeconds: 0,
          endTimeSeconds: 5,
          originalSegmentIndices: [0],
        },
      ],
      dictionaryVersion: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockAiResponse: ClipExtractionResponse = {
      clips: [
        {
          title: 'Introduction',
          startTimeSeconds: 0,
          endTimeSeconds: 30,
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

    it('should throw error if refined transcription not found', async () => {
      vi.mocked(mockVideoRepository.findById).mockResolvedValue(mockVideo);
      vi.mocked(mockTranscriptionRepository.findByVideoId).mockResolvedValue(mockTranscription);
      vi.mocked(mockRefinedTranscriptionRepository.findByTranscriptionId).mockResolvedValue(null);

      await expect(
        useCase.execute({
          videoId: 'video-1',
          clipInstructions: 'Extract highlights',
        })
      ).rejects.toThrow('Refined transcription not found for video video-1');
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
      // Create a mock stream that provides video data
      const createMockStream = () => {
        const stream = new Readable();
        stream.push(Buffer.from('mock-video-data'));
        stream.push(null);
        return stream;
      };

      // Setup mocks
      vi.mocked(mockVideoRepository.findById).mockResolvedValue(mockVideo);
      vi.mocked(mockTranscriptionRepository.findByVideoId).mockResolvedValue(mockTranscription);
      vi.mocked(mockRefinedTranscriptionRepository.findByTranscriptionId).mockResolvedValue(
        mockRefinedTranscription
      );
      vi.mocked(mockStorageGateway.getFileMetadata).mockResolvedValue({
        id: 'file-123',
        name: 'Test Video.mp4',
        mimeType: 'video/mp4',
        size: 1000000,
        webViewLink: 'https://drive.google.com/file/d/file-123/view',
        parents: ['parent-folder'],
      });
      vi.mocked(mockAiGateway.generate).mockResolvedValue(JSON.stringify(mockAiResponse));

      // GCS cache is not valid, so download from Google Drive and cache
      vi.mocked(mockTempStorageGateway.exists).mockResolvedValue(false);
      vi.mocked(mockStorageGateway.downloadFileAsStream).mockResolvedValue(createMockStream());
      vi.mocked(mockTempStorageGateway.uploadFromStream).mockResolvedValue({
        gcsUri: 'gs://bucket/videos/video-1/original.mp4',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // Download from GCS to local file
      vi.mocked(mockTempStorageGateway.downloadAsStream).mockReturnValue(createMockStream());

      vi.mocked(mockStorageGateway.findOrCreateFolder).mockResolvedValue({
        id: 'shorts-folder',
        name: 'ショート用',
        mimeType: 'application/vnd.google-apps.folder',
        size: 0,
        webViewLink: 'https://drive.google.com/drive/folders/shorts-folder',
      });

      // Mock extractClipFromFile to create the output file
      vi.mocked(mockVideoProcessingGateway.extractClipFromFile).mockImplementation(
        async (_inputPath, outputPath) => {
          await fs.promises.writeFile(outputPath, Buffer.from('extracted-clip-data'));
        }
      );

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

      // Verify file-based processing was used
      expect(mockVideoProcessingGateway.extractClipFromFile).toHaveBeenCalled();
      expect(mockStorageGateway.downloadFileAsStream).toHaveBeenCalled();
      expect(mockTempStorageGateway.uploadFromStream).toHaveBeenCalled();
    });

    it('should update video status to failed on error', async () => {
      vi.mocked(mockVideoRepository.findById).mockResolvedValue(mockVideo);
      vi.mocked(mockTranscriptionRepository.findByVideoId).mockResolvedValue(mockTranscription);
      vi.mocked(mockRefinedTranscriptionRepository.findByTranscriptionId).mockResolvedValue(
        mockRefinedTranscription
      );
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
