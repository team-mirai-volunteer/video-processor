import type { TempStorageGateway } from '@shared/domain/gateways/temp-storage.gateway.js';
import { NotFoundError, ValidationError } from '@shorts-gen/application/errors/errors.js';
import { UploadSceneImageUseCase } from '@shorts-gen/application/usecases/upload-scene-image.usecase.js';
import type { ShortsSceneAssetRepositoryGateway } from '@shorts-gen/domain/gateways/scene-asset-repository.gateway.js';
import type { ShortsSceneRepositoryGateway } from '@shorts-gen/domain/gateways/scene-repository.gateway.js';
import type { ShortsSceneProps } from '@shorts-gen/domain/models/scene.js';
import { ShortsScene } from '@shorts-gen/domain/models/scene.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Helper to create a scene with minimal required props
function createTestScene(overrides: Partial<ShortsSceneProps> = {}): ShortsScene {
  return ShortsScene.fromProps({
    id: 'scene-1',
    scriptId: 'script-1',
    order: 0,
    summary: 'Test scene',
    visualType: 'image_gen',
    voiceText: 'Test voice text',
    subtitles: ['Test subtitle'],
    silenceDurationMs: null,
    stockVideoKey: null,
    solidColor: null,
    imagePrompt: 'A beautiful sunset over the ocean',
    imageStyleHint: 'photorealistic',
    voiceKey: null,
    voiceSpeed: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('UploadSceneImageUseCase', () => {
  let useCase: UploadSceneImageUseCase;
  let sceneRepository: ShortsSceneRepositoryGateway;
  let sceneAssetRepository: ShortsSceneAssetRepositoryGateway;
  let tempStorageGateway: TempStorageGateway;
  let idCounter: number;

  const mockFile = {
    buffer: Buffer.from('fake-image-data'),
    mimetype: 'image/png',
    originalname: 'test-image.png',
  };

  beforeEach(() => {
    idCounter = 0;

    sceneRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      saveMany: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByScriptId: vi.fn().mockResolvedValue([]),
      findByScriptIdAndOrder: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByScriptId: vi.fn().mockResolvedValue(undefined),
      countByScriptId: vi.fn().mockResolvedValue(0),
    };

    sceneAssetRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      saveMany: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findBySceneId: vi.fn().mockResolvedValue([]),
      findBySceneIdAndType: vi.fn().mockResolvedValue([]),
      findBySceneIds: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteBySceneId: vi.fn().mockResolvedValue(undefined),
      deleteBySceneIdAndType: vi.fn().mockResolvedValue(undefined),
    };

    tempStorageGateway = {
      upload: vi.fn().mockResolvedValue({
        gcsUri: 'gs://bucket/shorts-gen/images/scene_scene-1_uploaded_id-1.png',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
      uploadFromStream: vi.fn().mockResolvedValue({
        gcsUri: 'gs://bucket/test',
        expiresAt: new Date(),
      }),
      uploadFromStreamWithProgress: vi.fn().mockResolvedValue({
        gcsUri: 'gs://bucket/test',
        expiresAt: new Date(),
      }),
      download: vi.fn().mockResolvedValue(Buffer.from('')),
      downloadAsStream: vi.fn(),
      getFileSize: vi.fn().mockResolvedValue(0),
      exists: vi.fn().mockResolvedValue(false),
      getSignedUrl: vi.fn().mockResolvedValue('https://storage.example.com/signed-url?token=abc'),
    };

    useCase = new UploadSceneImageUseCase({
      sceneRepository,
      sceneAssetRepository,
      tempStorageGateway,
      generateId: () => `id-${++idCounter}`,
    });
  });

  describe('execute', () => {
    it('should upload image successfully and return assetId and fileUrl', async () => {
      const scene = createTestScene();
      vi.mocked(sceneRepository.findById).mockResolvedValue(scene);

      const result = await useCase.execute({
        sceneId: 'scene-1',
        file: mockFile,
      });

      expect(result.assetId).toBe('id-2'); // id-1 is used for file path, id-2 for asset
      expect(result.fileUrl).toBe('https://storage.example.com/signed-url?token=abc');

      expect(sceneRepository.findById).toHaveBeenCalledWith('scene-1');
      expect(tempStorageGateway.upload).toHaveBeenCalledWith({
        videoId: expect.stringContaining('shorts-gen/images/scene_scene-1_uploaded_'),
        content: mockFile.buffer,
      });
      expect(sceneAssetRepository.deleteBySceneIdAndType).toHaveBeenCalledWith(
        'scene-1',
        'background_image'
      );
      expect(sceneAssetRepository.save).toHaveBeenCalled();
      expect(tempStorageGateway.getSignedUrl).toHaveBeenCalled();
    });

    it('should throw NotFoundError when scene does not exist', async () => {
      vi.mocked(sceneRepository.findById).mockResolvedValue(null);

      await expect(
        useCase.execute({
          sceneId: 'nonexistent-scene',
          file: mockFile,
        })
      ).rejects.toThrow(NotFoundError);

      expect(tempStorageGateway.upload).not.toHaveBeenCalled();
      expect(sceneAssetRepository.save).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when scene visualType is not image_gen', async () => {
      const scene = createTestScene({
        visualType: 'stock_video',
        stockVideoKey: 'video-key',
      });
      vi.mocked(sceneRepository.findById).mockResolvedValue(scene);

      await expect(
        useCase.execute({
          sceneId: 'scene-1',
          file: mockFile,
        })
      ).rejects.toThrow(ValidationError);

      expect(tempStorageGateway.upload).not.toHaveBeenCalled();
      expect(sceneAssetRepository.save).not.toHaveBeenCalled();
    });

    it('should delete existing background_image assets before creating new one', async () => {
      const scene = createTestScene();
      vi.mocked(sceneRepository.findById).mockResolvedValue(scene);

      await useCase.execute({
        sceneId: 'scene-1',
        file: mockFile,
      });

      expect(sceneAssetRepository.deleteBySceneIdAndType).toHaveBeenCalledWith(
        'scene-1',
        'background_image'
      );
      // deleteBySceneIdAndType should be called before save
      const deleteCallOrder = vi.mocked(sceneAssetRepository.deleteBySceneIdAndType).mock
        .invocationCallOrder[0];
      const saveCallOrder = vi.mocked(sceneAssetRepository.save).mock.invocationCallOrder[0];
      expect(deleteCallOrder).toBeLessThan(saveCallOrder ?? 0);
    });

    it('should use correct file extension for JPEG', async () => {
      const scene = createTestScene();
      vi.mocked(sceneRepository.findById).mockResolvedValue(scene);

      const jpegFile = {
        buffer: Buffer.from('fake-jpeg-data'),
        mimetype: 'image/jpeg',
        originalname: 'test-image.jpg',
      };

      await useCase.execute({
        sceneId: 'scene-1',
        file: jpegFile,
      });

      expect(tempStorageGateway.upload).toHaveBeenCalledWith({
        videoId: expect.stringContaining('.jpg'),
        content: jpegFile.buffer,
      });
    });

    it('should use correct file extension for WebP', async () => {
      const scene = createTestScene();
      vi.mocked(sceneRepository.findById).mockResolvedValue(scene);

      const webpFile = {
        buffer: Buffer.from('fake-webp-data'),
        mimetype: 'image/webp',
        originalname: 'test-image.webp',
      };

      await useCase.execute({
        sceneId: 'scene-1',
        file: webpFile,
      });

      expect(tempStorageGateway.upload).toHaveBeenCalledWith({
        videoId: expect.stringContaining('.webp'),
        content: webpFile.buffer,
      });
    });

    it('should store metadata with sourceType uploaded', async () => {
      const scene = createTestScene();
      vi.mocked(sceneRepository.findById).mockResolvedValue(scene);

      await useCase.execute({
        sceneId: 'scene-1',
        file: mockFile,
      });

      const savedAsset = vi.mocked(sceneAssetRepository.save).mock.calls[0]?.[0];
      expect(savedAsset?.metadata).toEqual({
        sourceType: 'uploaded',
        originalFilename: 'test-image.png',
        mimeType: 'image/png',
      });
    });

    it('should handle storage upload failure', async () => {
      const scene = createTestScene();
      vi.mocked(sceneRepository.findById).mockResolvedValue(scene);
      vi.mocked(tempStorageGateway.upload).mockRejectedValue(new Error('Storage error'));

      await expect(
        useCase.execute({
          sceneId: 'scene-1',
          file: mockFile,
        })
      ).rejects.toThrow('Storage error');

      expect(sceneAssetRepository.save).not.toHaveBeenCalled();
    });
  });
});
