import { NotFoundError, ValidationError } from '@shorts-gen/application/errors/errors.js';
import {
  AddSceneUseCase,
  type AddSceneUseCaseDeps,
} from '@shorts-gen/application/usecases/add-scene.usecase.js';
import type { ShortsSceneRepositoryGateway } from '@shorts-gen/domain/gateways/scene-repository.gateway.js';
import type { ShortsScriptRepositoryGateway } from '@shorts-gen/domain/gateways/script-repository.gateway.js';
import { ShortsScript } from '@shorts-gen/domain/models/script.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('AddSceneUseCase', () => {
  let useCase: AddSceneUseCase;
  let scriptRepository: ShortsScriptRepositoryGateway;
  let sceneRepository: ShortsSceneRepositoryGateway;
  let idCounter: number;

  const createDeps = (): AddSceneUseCaseDeps => ({
    scriptRepository,
    sceneRepository,
    generateId: () => `scene-${++idCounter}`,
  });

  const createMockScript = () => {
    return ShortsScript.fromProps({
      id: 'script-1',
      projectId: 'project-1',
      planningId: 'planning-1',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  beforeEach(() => {
    idCounter = 0;

    // Mock ScriptRepository
    scriptRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByProjectId: vi.fn().mockResolvedValue(null),
      findByPlanningId: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByProjectId: vi.fn().mockResolvedValue(undefined),
    };

    // Mock SceneRepository
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

    useCase = new AddSceneUseCase(createDeps());
  });

  describe('execute', () => {
    it('should add a scene with image_gen visual type', async () => {
      const mockScript = createMockScript();
      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);
      vi.mocked(sceneRepository.countByScriptId).mockResolvedValue(0);

      const input = {
        scriptId: 'script-1',
        summary: 'Introduction scene',
        visualType: 'image_gen' as const,
        voiceText: 'Welcome to our video!',
        subtitles: ['Welcome', 'to our video!'],
      };

      const result = await useCase.execute(input);

      expect(result.scene).toBeDefined();
      expect(result.scene.id).toBe('scene-1');
      expect(result.scene.scriptId).toBe('script-1');
      expect(result.scene.summary).toBe('Introduction scene');
      expect(result.scene.visualType).toBe('image_gen');
      expect(result.scene.voiceText).toBe('Welcome to our video!');
      expect(result.scene.subtitles).toEqual(['Welcome', 'to our video!']);
      expect(result.scene.order).toBe(0);

      expect(sceneRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should add a scene with stock_video visual type', async () => {
      const mockScript = createMockScript();
      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);
      vi.mocked(sceneRepository.countByScriptId).mockResolvedValue(2);

      const input = {
        scriptId: 'script-1',
        summary: 'Party leader speech',
        visualType: 'stock_video' as const,
        voiceText: 'Here is the speech.',
        stockVideoKey: 'leader-speech-001',
      };

      const result = await useCase.execute(input);

      expect(result.scene.visualType).toBe('stock_video');
      expect(result.scene.stockVideoKey).toBe('leader-speech-001');
      expect(result.scene.order).toBe(2); // Auto-assigned based on count
    });

    it('should add a scene with solid_color visual type', async () => {
      const mockScript = createMockScript();
      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);

      const input = {
        scriptId: 'script-1',
        summary: 'Title card',
        visualType: 'solid_color' as const,
        silenceDurationMs: 2000,
        solidColor: '#000000',
      };

      const result = await useCase.execute(input);

      expect(result.scene.visualType).toBe('solid_color');
      expect(result.scene.solidColor).toBe('#000000');
      expect(result.scene.silenceDurationMs).toBe(2000);
      expect(result.scene.voiceText).toBeNull();
    });

    it('should use provided order instead of auto-assigning', async () => {
      const mockScript = createMockScript();
      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);
      vi.mocked(sceneRepository.countByScriptId).mockResolvedValue(5);

      const input = {
        scriptId: 'script-1',
        summary: 'Inserted scene',
        visualType: 'image_gen' as const,
        voiceText: 'This is inserted.',
        order: 2,
      };

      const result = await useCase.execute(input);

      expect(result.scene.order).toBe(2);
      // countByScriptId should not be called when order is provided
      expect(sceneRepository.countByScriptId).not.toHaveBeenCalled();
    });

    it('should add scene with imageStyleHint', async () => {
      const mockScript = createMockScript();
      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);

      const input = {
        scriptId: 'script-1',
        summary: 'Anime style scene',
        visualType: 'image_gen' as const,
        voiceText: 'An anime scene.',
        imageStyleHint: 'anime style, vibrant colors',
      };

      const result = await useCase.execute(input);

      expect(result.scene.imageStyleHint).toBe('anime style, vibrant colors');
    });

    it('should throw NotFoundError when script does not exist', async () => {
      vi.mocked(scriptRepository.findById).mockResolvedValue(null);

      const input = {
        scriptId: 'non-existent-script',
        summary: 'Test scene',
        visualType: 'image_gen' as const,
        voiceText: 'Test voice',
      };

      await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
      expect(sceneRepository.save).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for empty summary', async () => {
      const mockScript = createMockScript();
      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);

      const input = {
        scriptId: 'script-1',
        summary: '',
        visualType: 'image_gen' as const,
        voiceText: 'Test voice',
      };

      await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when neither voiceText nor silenceDurationMs provided', async () => {
      const mockScript = createMockScript();
      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);

      const input = {
        scriptId: 'script-1',
        summary: 'Test scene',
        visualType: 'image_gen' as const,
        // No voiceText and no silenceDurationMs
      };

      await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for stock_video without stockVideoKey', async () => {
      const mockScript = createMockScript();
      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);

      const input = {
        scriptId: 'script-1',
        summary: 'Stock video scene',
        visualType: 'stock_video' as const,
        voiceText: 'Test',
        // Missing stockVideoKey
      };

      await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for solid_color without solidColor', async () => {
      const mockScript = createMockScript();
      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);

      const input = {
        scriptId: 'script-1',
        summary: 'Solid color scene',
        visualType: 'solid_color' as const,
        silenceDurationMs: 1000,
        // Missing solidColor
      };

      await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid solidColor format', async () => {
      const mockScript = createMockScript();
      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);

      const input = {
        scriptId: 'script-1',
        summary: 'Invalid color scene',
        visualType: 'solid_color' as const,
        silenceDurationMs: 1000,
        solidColor: 'invalid-color',
      };

      await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for negative order', async () => {
      const mockScript = createMockScript();
      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);

      const input = {
        scriptId: 'script-1',
        summary: 'Test scene',
        visualType: 'image_gen' as const,
        voiceText: 'Test',
        order: -1,
      };

      await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid silenceDurationMs', async () => {
      const mockScript = createMockScript();
      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);

      const input = {
        scriptId: 'script-1',
        summary: 'Test scene',
        visualType: 'image_gen' as const,
        silenceDurationMs: -100,
      };

      await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
    });
  });
});
