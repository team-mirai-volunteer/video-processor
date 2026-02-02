import { err, ok } from '@shared/domain/types/result.js';
import { NotFoundError, ValidationError } from '@shorts-gen/application/errors/errors.js';
import {
  GenerateImagesUseCase,
  type ImageStorageGateway,
} from '@shorts-gen/application/usecases/generate-images.usecase.js';
import type {
  ImageGenGateway,
  ImageGenResult,
} from '@shorts-gen/domain/gateways/image-gen.gateway.js';
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

// Helper to safely get first result and assert it exists
function getFirstResult<T>(arr: T[]): T {
  const first = arr[0];
  if (first === undefined) {
    throw new Error('Expected array to have at least one element');
  }
  return first;
}

describe('GenerateImagesUseCase', () => {
  let useCase: GenerateImagesUseCase;
  let sceneRepository: ShortsSceneRepositoryGateway;
  let sceneAssetRepository: ShortsSceneAssetRepositoryGateway;
  let imageGenGateway: ImageGenGateway;
  let storageGateway: ImageStorageGateway;
  let idCounter: number;

  const mockImageResult: ImageGenResult = {
    imageBuffer: Buffer.from('fake-image-data'),
    format: 'png',
    width: 1080,
    height: 1920,
    seed: 12345,
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

    imageGenGateway = {
      generate: vi.fn().mockResolvedValue(ok(mockImageResult)),
      getSupportedDimensions: vi.fn().mockReturnValue([{ width: 1080, height: 1920 }]),
      getSupportedStyles: vi.fn().mockReturnValue(['photorealistic', 'anime']),
    };

    storageGateway = {
      uploadFile: vi.fn().mockResolvedValue({
        id: 'file-id',
        webViewLink: 'https://drive.google.com/file/d/file-id/view',
      }),
    };

    useCase = new GenerateImagesUseCase({
      sceneRepository,
      sceneAssetRepository,
      imageGenGateway,
      storageGateway,
      generateId: () => `id-${++idCounter}`,
    });
  });

  describe('executeForScript', () => {
    it('should generate images for all image_gen scenes in a script', async () => {
      const scene1 = createTestScene({
        id: 'scene-1',
        order: 0,
        imagePrompt: 'Prompt 1',
      });
      const scene2 = createTestScene({
        id: 'scene-2',
        order: 1,
        imagePrompt: 'Prompt 2',
      });
      const scene3 = createTestScene({
        id: 'scene-3',
        order: 2,
        visualType: 'solid_color',
        solidColor: '#000000',
        imagePrompt: null,
      });

      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue([scene1, scene2, scene3]);

      const result = await useCase.executeForScript({ scriptId: 'script-1' });

      expect(result.scriptId).toBe('script-1');
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(result.results).toHaveLength(2);

      expect(imageGenGateway.generate).toHaveBeenCalledTimes(2);
      expect(storageGateway.uploadFile).toHaveBeenCalledTimes(2);
      expect(sceneAssetRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundError when no scenes found for script', async () => {
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue([]);

      await expect(useCase.executeForScript({ scriptId: 'script-1' })).rejects.toThrow(
        NotFoundError
      );
    });

    it('should handle image generation failures gracefully', async () => {
      const scene = createTestScene();
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue([scene]);
      vi.mocked(imageGenGateway.generate).mockResolvedValue(
        err({
          type: 'CONTENT_POLICY_VIOLATION',
          message: 'Prompt violates content policy',
        })
      );

      const result = await useCase.executeForScript({ scriptId: 'script-1' });

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
      const firstResult = getFirstResult(result.results);
      expect(firstResult.success).toBe(false);
      expect(firstResult.error).toContain('Content policy violation');
    });

    it('should skip scenes without image prompts', async () => {
      const sceneWithPrompt = createTestScene({
        id: 'scene-1',
        imagePrompt: 'A valid prompt',
      });
      const sceneWithoutPrompt = createTestScene({
        id: 'scene-2',
        imagePrompt: null,
      });

      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue([
        sceneWithPrompt,
        sceneWithoutPrompt,
      ]);

      const result = await useCase.executeForScript({ scriptId: 'script-1' });

      expect(result.successCount).toBe(1);
      expect(result.skippedCount).toBe(1);
      expect(imageGenGateway.generate).toHaveBeenCalledTimes(1);
    });

    it('should delete existing background_image assets before regenerating', async () => {
      const scene = createTestScene();
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue([scene]);

      await useCase.executeForScript({ scriptId: 'script-1' });

      expect(sceneAssetRepository.deleteBySceneIdAndType).toHaveBeenCalledWith(
        scene.id,
        'background_image'
      );
    });

    it('should pass style hint to image generation', async () => {
      const scene = createTestScene({
        imageStyleHint: 'anime',
      });
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue([scene]);

      await useCase.executeForScript({ scriptId: 'script-1' });

      expect(imageGenGateway.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          style: 'anime',
        })
      );
    });
  });

  describe('executeForScene', () => {
    it('should generate image for a single scene', async () => {
      const scene = createTestScene();
      vi.mocked(sceneRepository.findById).mockResolvedValue(scene);

      const result = await useCase.executeForScene({ sceneId: 'scene-1' });

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.results).toHaveLength(1);
      const firstResult = getFirstResult(result.results);
      expect(firstResult.success).toBe(true);
      expect(firstResult.fileUrl).toBe('https://drive.google.com/file/d/file-id/view');
    });

    it('should throw NotFoundError when scene not found', async () => {
      vi.mocked(sceneRepository.findById).mockResolvedValue(null);

      await expect(useCase.executeForScene({ sceneId: 'scene-1' })).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when scene is not image_gen type', async () => {
      const scene = createTestScene({
        visualType: 'stock_video',
        stockVideoKey: 'video-key',
      });
      vi.mocked(sceneRepository.findById).mockResolvedValue(scene);

      await expect(useCase.executeForScene({ sceneId: 'scene-1' })).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError when scene has no image prompt', async () => {
      const scene = createTestScene({
        imagePrompt: null,
      });
      vi.mocked(sceneRepository.findById).mockResolvedValue(scene);

      await expect(useCase.executeForScene({ sceneId: 'scene-1' })).rejects.toThrow(
        ValidationError
      );
    });

    it('should handle storage upload failure', async () => {
      const scene = createTestScene();
      vi.mocked(sceneRepository.findById).mockResolvedValue(scene);
      vi.mocked(storageGateway.uploadFile).mockRejectedValue(new Error('Upload failed'));

      const result = await useCase.executeForScene({ sceneId: 'scene-1' });

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
      const firstResult = getFirstResult(result.results);
      expect(firstResult.error).toContain('Upload failed');
    });
  });

  describe('error formatting', () => {
    it('should format RATE_LIMIT_EXCEEDED error with retry info', async () => {
      const scene = createTestScene();
      vi.mocked(sceneRepository.findById).mockResolvedValue(scene);
      vi.mocked(imageGenGateway.generate).mockResolvedValue(
        err({
          type: 'RATE_LIMIT_EXCEEDED',
          retryAfterMs: 5000,
        })
      );

      const result = await useCase.executeForScene({ sceneId: 'scene-1' });

      const firstResult = getFirstResult(result.results);
      expect(firstResult.error).toContain('Rate limit exceeded');
      expect(firstResult.error).toContain('5000ms');
    });

    it('should format API_ERROR with status code', async () => {
      const scene = createTestScene();
      vi.mocked(sceneRepository.findById).mockResolvedValue(scene);
      vi.mocked(imageGenGateway.generate).mockResolvedValue(
        err({
          type: 'API_ERROR',
          statusCode: 500,
          message: 'Internal server error',
        })
      );

      const result = await useCase.executeForScene({ sceneId: 'scene-1' });

      const firstResult = getFirstResult(result.results);
      expect(firstResult.error).toContain('API error');
      expect(firstResult.error).toContain('500');
    });
  });

  describe('configuration', () => {
    it('should use default dimensions when not specified', async () => {
      const scene = createTestScene();
      vi.mocked(sceneRepository.findById).mockResolvedValue(scene);

      await useCase.executeForScene({ sceneId: 'scene-1' });

      expect(imageGenGateway.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 1080,
          height: 1920,
        })
      );
    });

    it('should use custom dimensions when specified', async () => {
      const customUseCase = new GenerateImagesUseCase({
        sceneRepository,
        sceneAssetRepository,
        imageGenGateway,
        storageGateway,
        generateId: () => `id-${++idCounter}`,
        defaultWidth: 1920,
        defaultHeight: 1080,
      });

      const scene = createTestScene();
      vi.mocked(sceneRepository.findById).mockResolvedValue(scene);

      await customUseCase.executeForScene({ sceneId: 'scene-1' });

      expect(imageGenGateway.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 1920,
          height: 1080,
        })
      );
    });

    it('should pass outputFolderId to storage gateway', async () => {
      const scene = createTestScene();
      vi.mocked(sceneRepository.findById).mockResolvedValue(scene);

      await useCase.executeForScene({
        sceneId: 'scene-1',
        outputFolderId: 'custom-folder-id',
      });

      expect(storageGateway.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          parentFolderId: 'custom-folder-id',
        })
      );
    });
  });
});
