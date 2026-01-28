import {
  GENERATE_SUBTITLES_ERROR_CODES,
  GenerateSubtitlesError,
} from '@shorts-gen/application/errors/generate-subtitles.errors.js';
import {
  GenerateSubtitlesUseCase,
  type GenerateSubtitlesUseCaseDeps,
} from '@shorts-gen/application/usecases/generate-subtitles.usecase.js';
import type { AssetStorageGateway } from '@shorts-gen/domain/gateways/asset-storage.gateway.js';
import type { ShortsProjectRepositoryGateway } from '@shorts-gen/domain/gateways/project-repository.gateway.js';
import type { ShortsSceneAssetRepositoryGateway } from '@shorts-gen/domain/gateways/scene-asset-repository.gateway.js';
import type { ShortsSceneRepositoryGateway } from '@shorts-gen/domain/gateways/scene-repository.gateway.js';
import type { ShortsScriptRepositoryGateway } from '@shorts-gen/domain/gateways/script-repository.gateway.js';
import type { SubtitleGeneratorGateway } from '@shorts-gen/domain/gateways/subtitle-generator.gateway.js';
import { ShortsProject } from '@shorts-gen/domain/models/project.js';
import { ShortsScene } from '@shorts-gen/domain/models/scene.js';
import { ShortsScript } from '@shorts-gen/domain/models/script.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GenerateSubtitlesUseCase', () => {
  let useCase: GenerateSubtitlesUseCase;
  let scriptRepository: ShortsScriptRepositoryGateway;
  let projectRepository: ShortsProjectRepositoryGateway;
  let sceneRepository: ShortsSceneRepositoryGateway;
  let sceneAssetRepository: ShortsSceneAssetRepositoryGateway;
  let subtitleGenerator: SubtitleGeneratorGateway;
  let assetStorage: AssetStorageGateway;
  let generateId: () => string;

  const mockProject = ShortsProject.fromProps({
    id: 'project-1',
    title: 'Test Project',
    aspectRatio: '9:16',
    resolutionWidth: 1080,
    resolutionHeight: 1920,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockScript = ShortsScript.fromProps({
    id: 'script-1',
    projectId: 'project-1',
    planningId: 'planning-1',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockScene1 = ShortsScene.fromProps({
    id: 'scene-1',
    scriptId: 'script-1',
    order: 0,
    summary: 'First scene',
    visualType: 'image_gen',
    voiceText: 'Hello, welcome to our video!',
    subtitles: ['Hello, welcome', 'to our video!'],
    silenceDurationMs: null,
    stockVideoKey: null,
    solidColor: null,
    imagePrompt: null,
    imageStyleHint: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockScene2 = ShortsScene.fromProps({
    id: 'scene-2',
    scriptId: 'script-1',
    order: 1,
    summary: 'Second scene',
    visualType: 'image_gen',
    voiceText: 'Thank you for watching!',
    subtitles: ['Thank you for watching!'],
    silenceDurationMs: null,
    stockVideoKey: null,
    solidColor: null,
    imagePrompt: null,
    imageStyleHint: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockSceneNoSubtitles = ShortsScene.fromProps({
    id: 'scene-3',
    scriptId: 'script-1',
    order: 2,
    summary: 'Silent scene',
    visualType: 'solid_color',
    voiceText: null,
    subtitles: [],
    silenceDurationMs: 2000,
    stockVideoKey: null,
    solidColor: '#000000',
    imagePrompt: null,
    imageStyleHint: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  let idCounter = 0;

  beforeEach(() => {
    idCounter = 0;
    generateId = vi.fn(() => `asset-${++idCounter}`);

    scriptRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(mockScript),
      findByProjectId: vi.fn().mockResolvedValue(mockScript),
      findByPlanningId: vi.fn().mockResolvedValue([mockScript]),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByProjectId: vi.fn().mockResolvedValue(undefined),
    };

    projectRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(mockProject),
      findMany: vi.fn().mockResolvedValue({ projects: [mockProject], total: 1 }),
      delete: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(true),
    };

    sceneRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      saveMany: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(mockScene1),
      findByScriptId: vi.fn().mockResolvedValue([mockScene1, mockScene2, mockSceneNoSubtitles]),
      findByScriptIdAndOrder: vi.fn().mockResolvedValue(mockScene1),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByScriptId: vi.fn().mockResolvedValue(undefined),
      countByScriptId: vi.fn().mockResolvedValue(3),
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

    subtitleGenerator = {
      generate: vi.fn().mockResolvedValue({
        success: true,
        value: {
          imageBuffer: Buffer.from('fake-png-data'),
          width: 1080,
          height: 1920,
          format: 'png',
        },
      }),
      generateBatch: vi.fn().mockResolvedValue({
        success: true,
        value: {
          images: [
            {
              imageBuffer: Buffer.from('fake-png-data-1'),
              width: 1080,
              height: 1920,
              format: 'png',
            },
          ],
        },
      }),
      listAvailableFonts: vi.fn().mockResolvedValue(['Noto Sans CJK JP']),
      getDefaultStyle: vi.fn().mockReturnValue({
        fontFamily: 'Noto Sans CJK JP',
        fontSize: 64,
        fontColor: '#FFFFFF',
      }),
    };

    assetStorage = {
      upload: vi.fn().mockResolvedValue({
        url: 'https://storage.example.com/subtitle.png',
        gcsUri: 'gs://bucket/subtitle.png',
      }),
      download: vi.fn().mockResolvedValue(Buffer.from('fake-data')),
      delete: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(true),
    };

    const deps: GenerateSubtitlesUseCaseDeps = {
      scriptRepository,
      projectRepository,
      sceneRepository,
      sceneAssetRepository,
      subtitleGenerator,
      assetStorage,
      generateId,
    };

    useCase = new GenerateSubtitlesUseCase(deps);
  });

  describe('execute', () => {
    it('should generate subtitles for all scenes with subtitles', async () => {
      const result = await useCase.execute({ scriptId: 'script-1' });

      expect(result.scriptId).toBe('script-1');
      expect(result.projectId).toBe('project-1');
      expect(result.totalScenesProcessed).toBe(2); // Only scenes with subtitles
      expect(result.totalAssetsGenerated).toBe(3); // 2 subtitles in scene1 + 1 in scene2

      // Verify repository calls
      expect(scriptRepository.findById).toHaveBeenCalledWith('script-1');
      expect(projectRepository.findById).toHaveBeenCalledWith('project-1');
      expect(sceneRepository.findByScriptId).toHaveBeenCalledWith('script-1');

      // Verify subtitle generator was called with correct dimensions
      expect(subtitleGenerator.generate).toHaveBeenCalledTimes(3);
      expect(subtitleGenerator.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 1080,
          height: 1920,
        })
      );

      // Verify assets were uploaded
      expect(assetStorage.upload).toHaveBeenCalledTimes(3);

      // Verify assets were saved
      expect(sceneAssetRepository.saveMany).toHaveBeenCalledTimes(2); // Once per scene
    });

    it('should generate subtitles for specific scenes when sceneIds provided', async () => {
      const result = await useCase.execute({
        scriptId: 'script-1',
        sceneIds: ['scene-1'],
      });

      expect(result.totalScenesProcessed).toBe(1);
      expect(result.totalAssetsGenerated).toBe(2); // Only scene1's 2 subtitles
      expect(result.sceneResults).toHaveLength(1);
      const firstResult = result.sceneResults[0];
      expect(firstResult).toBeDefined();
      expect(firstResult?.sceneId).toBe('scene-1');
    });

    it('should pass custom subtitle style to generator', async () => {
      const customStyle = {
        fontSize: 48,
        fontColor: '#FF0000',
      };

      await useCase.execute({
        scriptId: 'script-1',
        subtitleStyle: customStyle,
        verticalPosition: 0.9,
      });

      expect(subtitleGenerator.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          style: customStyle,
          verticalPosition: 0.9,
        })
      );
    });

    it('should delete existing subtitle assets before regeneration', async () => {
      await useCase.execute({ scriptId: 'script-1' });

      expect(sceneAssetRepository.deleteBySceneIdAndType).toHaveBeenCalledWith(
        'scene-1',
        'subtitle_image'
      );
      expect(sceneAssetRepository.deleteBySceneIdAndType).toHaveBeenCalledWith(
        'scene-2',
        'subtitle_image'
      );
    });

    it('should store correct metadata with assets', async () => {
      await useCase.execute({ scriptId: 'script-1' });

      // Check that saveMany was called with assets containing correct metadata
      const saveManyCall = vi.mocked(sceneAssetRepository.saveMany).mock.calls[0];
      expect(saveManyCall).toBeDefined();
      const savedAssets = saveManyCall?.[0];

      expect(savedAssets).toHaveLength(2); // First scene has 2 subtitles
      const firstAsset = savedAssets?.[0];
      expect(firstAsset).toBeDefined();
      expect(firstAsset?.metadata).toEqual(
        expect.objectContaining({
          subtitleIndex: 0,
          subtitleText: 'Hello, welcome',
          width: 1080,
          height: 1920,
        })
      );
    });

    it('should throw error when script not found', async () => {
      vi.mocked(scriptRepository.findById).mockResolvedValue(null);

      await expect(useCase.execute({ scriptId: 'nonexistent' })).rejects.toThrow(
        GenerateSubtitlesError
      );
      await expect(useCase.execute({ scriptId: 'nonexistent' })).rejects.toMatchObject({
        code: GENERATE_SUBTITLES_ERROR_CODES.SCRIPT_NOT_FOUND,
      });
    });

    it('should throw error when project not found', async () => {
      vi.mocked(projectRepository.findById).mockResolvedValue(null);

      await expect(useCase.execute({ scriptId: 'script-1' })).rejects.toThrow(
        GenerateSubtitlesError
      );
      await expect(useCase.execute({ scriptId: 'script-1' })).rejects.toMatchObject({
        code: GENERATE_SUBTITLES_ERROR_CODES.PROJECT_NOT_FOUND,
      });
    });

    it('should throw error when no scenes found', async () => {
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue([]);

      await expect(useCase.execute({ scriptId: 'script-1' })).rejects.toThrow(
        GenerateSubtitlesError
      );
      await expect(useCase.execute({ scriptId: 'script-1' })).rejects.toMatchObject({
        code: GENERATE_SUBTITLES_ERROR_CODES.NO_SCENES,
      });
    });

    it('should throw error when no scenes with subtitles found', async () => {
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue([mockSceneNoSubtitles]);

      await expect(useCase.execute({ scriptId: 'script-1' })).rejects.toThrow(
        GenerateSubtitlesError
      );
      await expect(useCase.execute({ scriptId: 'script-1' })).rejects.toMatchObject({
        code: GENERATE_SUBTITLES_ERROR_CODES.NO_SUBTITLES,
      });
    });

    it('should throw error when subtitle generation fails', async () => {
      vi.mocked(subtitleGenerator.generate).mockResolvedValue({
        success: false,
        error: {
          type: 'FFMPEG_ERROR',
          message: 'FFmpeg execution failed',
        },
      });

      await expect(useCase.execute({ scriptId: 'script-1' })).rejects.toThrow(
        GenerateSubtitlesError
      );
      await expect(useCase.execute({ scriptId: 'script-1' })).rejects.toMatchObject({
        code: GENERATE_SUBTITLES_ERROR_CODES.GENERATION_FAILED,
      });
    });

    it('should throw error when asset upload fails', async () => {
      vi.mocked(assetStorage.upload).mockRejectedValue(new Error('Upload failed'));

      await expect(useCase.execute({ scriptId: 'script-1' })).rejects.toThrow(
        GenerateSubtitlesError
      );
      await expect(useCase.execute({ scriptId: 'script-1' })).rejects.toMatchObject({
        code: GENERATE_SUBTITLES_ERROR_CODES.UPLOAD_FAILED,
      });
    });

    it('should return correct scene results in order', async () => {
      const result = await useCase.execute({ scriptId: 'script-1' });

      expect(result.sceneResults).toHaveLength(2);
      const scene1Result = result.sceneResults[0];
      const scene2Result = result.sceneResults[1];
      expect(scene1Result).toBeDefined();
      expect(scene2Result).toBeDefined();
      expect(scene1Result?.sceneId).toBe('scene-1');
      expect(scene1Result?.order).toBe(0);
      expect(scene1Result?.assets).toHaveLength(2);
      expect(scene2Result?.sceneId).toBe('scene-2');
      expect(scene2Result?.order).toBe(1);
      expect(scene2Result?.assets).toHaveLength(1);
    });

    it('should upload to correct storage path', async () => {
      await useCase.execute({ scriptId: 'script-1' });

      expect(assetStorage.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'shorts-gen/project-1/subtitles/scene-1/0.png',
          contentType: 'image/png',
        })
      );
    });
  });
});
