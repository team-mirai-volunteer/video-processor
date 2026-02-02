import { err, ok } from '@shared/domain/types/result.js';
import {
  AiGenerationError,
  NotFoundError,
  ValidationError,
} from '@shorts-gen/application/errors/errors.js';
import {
  GenerateImagePromptsUseCase,
  type GenerateImagePromptsUseCaseDeps,
} from '@shorts-gen/application/usecases/generate-image-prompts.usecase.js';
import type {
  AgenticAiGateway,
  AgenticAiGatewayError,
  ChatCompletionResult,
} from '@shorts-gen/domain/gateways/agentic-ai.gateway.js';
import type { ShortsSceneRepositoryGateway } from '@shorts-gen/domain/gateways/scene-repository.gateway.js';
import type { ShortsScriptRepositoryGateway } from '@shorts-gen/domain/gateways/script-repository.gateway.js';
import { ShortsScene } from '@shorts-gen/domain/models/scene.js';
import { ShortsScript } from '@shorts-gen/domain/models/script.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GenerateImagePromptsUseCase', () => {
  let useCase: GenerateImagePromptsUseCase;
  let sceneRepository: ShortsSceneRepositoryGateway;
  let scriptRepository: ShortsScriptRepositoryGateway;
  let agenticAiGateway: AgenticAiGateway;

  // Helper to create a mock script
  const createMockScript = (id = 'script-1'): ShortsScript => {
    return ShortsScript.fromProps({
      id,
      projectId: 'project-1',
      planningId: 'planning-1',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  // Helper to create a mock scene
  const createMockScene = (
    id: string,
    order: number,
    visualType: 'image_gen' | 'stock_video' | 'solid_color' = 'image_gen'
  ): ShortsScene => {
    const baseProps = {
      id,
      scriptId: 'script-1',
      order,
      summary: `Scene ${order + 1} summary`,
      visualType,
      voiceText: `Voice text for scene ${order + 1}`,
      subtitles: [`Subtitle ${order + 1}`],
      silenceDurationMs: null,
      stockVideoKey: visualType === 'stock_video' ? 'leader_speech_01' : null,
      solidColor: visualType === 'solid_color' ? '#000000' : null,
      imagePrompt: null,
      imageStyleHint: null,
      voiceKey: null,
      voiceSpeed: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return ShortsScene.fromProps(baseProps);
  };

  // Helper to create AI response
  const createMockAiResponse = (
    scenePrompts: Array<{ sceneId: string; imagePrompt: string }>
  ): string => {
    return JSON.stringify(scenePrompts);
  };

  beforeEach(() => {
    // Create mock repositories
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

    scriptRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByProjectId: vi.fn().mockResolvedValue(null),
      findByPlanningId: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByProjectId: vi.fn().mockResolvedValue(undefined),
    };

    agenticAiGateway = {
      chat: vi.fn().mockResolvedValue(
        ok({
          content: '[]',
          toolCalls: [],
          finishReason: 'stop',
        } as ChatCompletionResult)
      ),
      chatStream: vi.fn().mockResolvedValue(ok((async function* () {})())),
    };

    const deps: GenerateImagePromptsUseCaseDeps = {
      sceneRepository,
      scriptRepository,
      agenticAiGateway,
    };

    useCase = new GenerateImagePromptsUseCase(deps);
  });

  describe('execute', () => {
    it('should generate image prompts for image_gen scenes', async () => {
      // Arrange
      const mockScript = createMockScript();
      const mockScenes = [
        createMockScene('scene-1', 0, 'image_gen'),
        createMockScene('scene-2', 1, 'image_gen'),
      ];
      const aiResponse = createMockAiResponse([
        { sceneId: 'scene-1', imagePrompt: 'A beautiful landscape with mountains' },
        { sceneId: 'scene-2', imagePrompt: 'A person standing in a field' },
      ]);

      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue(mockScenes);
      vi.mocked(agenticAiGateway.chat).mockResolvedValue(
        ok({
          content: aiResponse,
          toolCalls: [],
          finishReason: 'stop',
        })
      );

      // Act
      const result = await useCase.execute({ scriptId: 'script-1' });

      // Assert
      expect(result.scriptId).toBe('script-1');
      expect(result.totalProcessed).toBe(2);
      expect(result.totalSkipped).toBe(0);
      expect(result.generatedPrompts).toHaveLength(2);
      expect(result.generatedPrompts[0]?.imagePrompt).toBe('A beautiful landscape with mountains');
      expect(result.generatedPrompts[1]?.imagePrompt).toBe('A person standing in a field');

      expect(sceneRepository.saveMany).toHaveBeenCalledTimes(1);
      expect(agenticAiGateway.chat).toHaveBeenCalledTimes(1);
    });

    it('should skip non-image_gen scenes', async () => {
      // Arrange
      const mockScript = createMockScript();
      const mockScenes = [
        createMockScene('scene-1', 0, 'image_gen'),
        createMockScene('scene-2', 1, 'stock_video'),
        createMockScene('scene-3', 2, 'solid_color'),
      ];
      const aiResponse = createMockAiResponse([
        { sceneId: 'scene-1', imagePrompt: 'A beautiful landscape' },
      ]);

      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue(mockScenes);
      vi.mocked(agenticAiGateway.chat).mockResolvedValue(
        ok({
          content: aiResponse,
          toolCalls: [],
          finishReason: 'stop',
        })
      );

      // Act
      const result = await useCase.execute({ scriptId: 'script-1' });

      // Assert
      expect(result.totalProcessed).toBe(1);
      expect(result.totalSkipped).toBe(2);
      expect(result.generatedPrompts).toHaveLength(1);
    });

    it('should apply styleHint to all scenes', async () => {
      // Arrange
      const mockScript = createMockScript();
      const mockScenes = [createMockScene('scene-1', 0, 'image_gen')];
      const aiResponse = createMockAiResponse([
        { sceneId: 'scene-1', imagePrompt: 'A cute anime cat character' },
      ]);

      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue(mockScenes);
      vi.mocked(agenticAiGateway.chat).mockResolvedValue(
        ok({
          content: aiResponse,
          toolCalls: [],
          finishReason: 'stop',
        })
      );

      const styleHint = 'Use cute anime-style cat characters';

      // Act
      const result = await useCase.execute({ scriptId: 'script-1', styleHint });

      // Assert
      expect(result.generatedPrompts[0]?.styleHint).toBe(styleHint);

      // Verify styleHint was included in the system prompt
      const chatCall = vi.mocked(agenticAiGateway.chat).mock.calls[0]?.[0];
      expect(chatCall?.systemPrompt).toContain(styleHint);
    });

    it('should filter by specific sceneIds when provided', async () => {
      // Arrange
      const mockScript = createMockScript();
      const mockScenes = [
        createMockScene('scene-1', 0, 'image_gen'),
        createMockScene('scene-2', 1, 'image_gen'),
        createMockScene('scene-3', 2, 'image_gen'),
      ];
      const aiResponse = createMockAiResponse([
        { sceneId: 'scene-2', imagePrompt: 'Regenerated prompt for scene 2' },
      ]);

      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue(mockScenes);
      vi.mocked(agenticAiGateway.chat).mockResolvedValue(
        ok({
          content: aiResponse,
          toolCalls: [],
          finishReason: 'stop',
        })
      );

      // Act
      const result = await useCase.execute({
        scriptId: 'script-1',
        sceneIds: ['scene-2'],
      });

      // Assert
      expect(result.totalProcessed).toBe(1);
      expect(result.generatedPrompts).toHaveLength(1);
      expect(result.generatedPrompts[0]?.sceneId).toBe('scene-2');
    });

    it('should throw NotFoundError when script does not exist', async () => {
      // Arrange
      vi.mocked(scriptRepository.findById).mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute({ scriptId: 'non-existent' })).rejects.toThrow(NotFoundError);
      expect(sceneRepository.findByScriptId).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when no scenes exist for script', async () => {
      // Arrange
      const mockScript = createMockScript();
      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue([]);

      // Act & Assert
      await expect(useCase.execute({ scriptId: 'script-1' })).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when specified sceneIds do not match any scenes', async () => {
      // Arrange
      const mockScript = createMockScript();
      const mockScenes = [createMockScene('scene-1', 0, 'image_gen')];

      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue(mockScenes);

      // Act & Assert
      await expect(
        useCase.execute({
          scriptId: 'script-1',
          sceneIds: ['non-existent-scene'],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should return empty result when no image_gen scenes exist', async () => {
      // Arrange
      const mockScript = createMockScript();
      const mockScenes = [
        createMockScene('scene-1', 0, 'stock_video'),
        createMockScene('scene-2', 1, 'solid_color'),
      ];

      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue(mockScenes);

      // Act
      const result = await useCase.execute({ scriptId: 'script-1' });

      // Assert
      expect(result.totalProcessed).toBe(0);
      expect(result.totalSkipped).toBe(2);
      expect(result.generatedPrompts).toHaveLength(0);
      expect(agenticAiGateway.chat).not.toHaveBeenCalled();
    });

    it('should throw AiGenerationError when AI call fails', async () => {
      // Arrange
      const mockScript = createMockScript();
      const mockScenes = [createMockScene('scene-1', 0, 'image_gen')];

      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue(mockScenes);
      vi.mocked(agenticAiGateway.chat).mockResolvedValue(
        err({
          type: 'GENERATION_FAILED',
          message: 'AI service unavailable',
        } as AgenticAiGatewayError)
      );

      // Act & Assert
      await expect(useCase.execute({ scriptId: 'script-1' })).rejects.toThrow(AiGenerationError);
    });

    it('should handle AI response with JSON code block', async () => {
      // Arrange
      const mockScript = createMockScript();
      const mockScenes = [createMockScene('scene-1', 0, 'image_gen')];
      const aiResponse =
        '```json\n[{"sceneId":"scene-1","imagePrompt":"Prompt from code block"}]\n```';

      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue(mockScenes);
      vi.mocked(agenticAiGateway.chat).mockResolvedValue(
        ok({
          content: aiResponse,
          toolCalls: [],
          finishReason: 'stop',
        })
      );

      // Act
      const result = await useCase.execute({ scriptId: 'script-1' });

      // Assert
      expect(result.generatedPrompts[0]?.imagePrompt).toBe('Prompt from code block');
    });

    it('should handle rate limit error with appropriate message', async () => {
      // Arrange
      const mockScript = createMockScript();
      const mockScenes = [createMockScene('scene-1', 0, 'image_gen')];

      vi.mocked(scriptRepository.findById).mockResolvedValue(mockScript);
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue(mockScenes);
      vi.mocked(agenticAiGateway.chat).mockResolvedValue(
        err({ type: 'RATE_LIMIT_EXCEEDED' } as AgenticAiGatewayError)
      );

      // Act & Assert
      await expect(useCase.execute({ scriptId: 'script-1' })).rejects.toThrow(AiGenerationError);
    });
  });
});
