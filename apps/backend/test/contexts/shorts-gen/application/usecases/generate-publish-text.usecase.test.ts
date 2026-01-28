import {
  AiGenerationError,
  NotFoundError,
  ValidationError,
} from '@shorts-gen/application/errors/errors.js';
import { GeneratePublishTextUseCase } from '@shorts-gen/application/usecases/generate-publish-text.usecase.js';
import type {
  AgenticAiGateway,
  ChatCompletionResult,
} from '@shorts-gen/domain/gateways/agentic-ai.gateway.js';
import type { ShortsPlanningRepositoryGateway } from '@shorts-gen/domain/gateways/planning-repository.gateway.js';
import type { ShortsPublishTextRepositoryGateway } from '@shorts-gen/domain/gateways/publish-text-repository.gateway.js';
import type { ShortsSceneRepositoryGateway } from '@shorts-gen/domain/gateways/scene-repository.gateway.js';
import type { ShortsScriptRepositoryGateway } from '@shorts-gen/domain/gateways/script-repository.gateway.js';
import { ShortsPlanning } from '@shorts-gen/domain/models/planning.js';
import { ShortsScene } from '@shorts-gen/domain/models/scene.js';
import { ShortsScript } from '@shorts-gen/domain/models/script.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GeneratePublishTextUseCase', () => {
  let useCase: GeneratePublishTextUseCase;
  let agenticAiGateway: AgenticAiGateway;
  let planningRepository: ShortsPlanningRepositoryGateway;
  let scriptRepository: ShortsScriptRepositoryGateway;
  let sceneRepository: ShortsSceneRepositoryGateway;
  let publishTextRepository: ShortsPublishTextRepositoryGateway;
  let idCounter: number;

  const mockPlanning = ShortsPlanning.fromProps({
    id: 'planning-1',
    projectId: 'project-1',
    content: '# 企画書\n\nAIについて解説する動画',
    version: 1,
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

  const mockScenes = [
    ShortsScene.fromProps({
      id: 'scene-1',
      scriptId: 'script-1',
      order: 0,
      summary: 'AIの基礎概念を説明',
      visualType: 'image_gen',
      voiceText: 'AIとは人工知能のことです。',
      subtitles: ['AIとは人工知能'],
      silenceDurationMs: null,
      stockVideoKey: null,
      solidColor: null,
      imagePrompt: null,
      imageStyleHint: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    ShortsScene.fromProps({
      id: 'scene-2',
      scriptId: 'script-1',
      order: 1,
      summary: '機械学習について解説',
      visualType: 'image_gen',
      voiceText: '機械学習はAIの一種です。',
      subtitles: ['機械学習とは'],
      silenceDurationMs: null,
      stockVideoKey: null,
      solidColor: null,
      imagePrompt: null,
      imageStyleHint: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  ];

  const successfulAiResponse: ChatCompletionResult = {
    content:
      '{"title": "AIって何?3分でわかる人工知能入門", "description": "AIについて初心者向けに解説します。機械学習やディープラーニングの基礎を学びましょう。 #AI #人工知能 #機械学習 #テクノロジー"}',
    toolCalls: [],
    finishReason: 'stop',
  };

  beforeEach(() => {
    idCounter = 0;

    agenticAiGateway = {
      chat: vi.fn().mockResolvedValue({ success: true, value: successfulAiResponse }),
      chatStream: vi.fn(),
    };

    planningRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByProjectId: vi.fn().mockResolvedValue(mockPlanning),
      findAllVersionsByProjectId: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByProjectId: vi.fn().mockResolvedValue(undefined),
    };

    scriptRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByProjectId: vi.fn().mockResolvedValue(mockScript),
      findByPlanningId: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByProjectId: vi.fn().mockResolvedValue(undefined),
    };

    sceneRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      saveMany: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByScriptId: vi.fn().mockResolvedValue(mockScenes),
      findByScriptIdAndOrder: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByScriptId: vi.fn().mockResolvedValue(undefined),
      countByScriptId: vi.fn().mockResolvedValue(2),
    };

    publishTextRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByProjectId: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByProjectId: vi.fn().mockResolvedValue(undefined),
    };

    useCase = new GeneratePublishTextUseCase({
      agenticAiGateway,
      planningRepository,
      scriptRepository,
      sceneRepository,
      publishTextRepository,
      generateId: () => `id-${++idCounter}`,
    });
  });

  it('should generate publish text successfully', async () => {
    const input = { projectId: 'project-1' };

    const result = await useCase.execute(input);

    expect(result.publishTextId).toBe('id-1');
    expect(result.title).toBe('AIって何?3分でわかる人工知能入門');
    expect(result.description).toContain('AIについて初心者向けに解説します');
    expect(publishTextRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should throw NotFoundError when planning is not found', async () => {
    vi.mocked(planningRepository.findByProjectId).mockResolvedValue(null);

    const input = { projectId: 'project-1' };

    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
    expect(publishTextRepository.save).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when script is not found', async () => {
    vi.mocked(scriptRepository.findByProjectId).mockResolvedValue(null);

    const input = { projectId: 'project-1' };

    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
    expect(publishTextRepository.save).not.toHaveBeenCalled();
  });

  it('should throw ValidationError when script has no scenes', async () => {
    vi.mocked(sceneRepository.findByScriptId).mockResolvedValue([]);

    const input = { projectId: 'project-1' };

    await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
    expect(publishTextRepository.save).not.toHaveBeenCalled();
  });

  it('should throw AiGenerationError when AI generation fails', async () => {
    vi.mocked(agenticAiGateway.chat).mockResolvedValue({
      success: false,
      error: { type: 'GENERATION_FAILED', message: 'AI generation failed' },
    });

    const input = { projectId: 'project-1' };

    await expect(useCase.execute(input)).rejects.toThrow(AiGenerationError);
    expect(publishTextRepository.save).not.toHaveBeenCalled();
  });

  it('should throw AiGenerationError when AI response is invalid JSON', async () => {
    vi.mocked(agenticAiGateway.chat).mockResolvedValue({
      success: true,
      value: {
        content: 'This is not valid JSON',
        toolCalls: [],
        finishReason: 'stop',
      },
    });

    const input = { projectId: 'project-1' };

    await expect(useCase.execute(input)).rejects.toThrow(AiGenerationError);
    expect(publishTextRepository.save).not.toHaveBeenCalled();
  });

  it('should throw AiGenerationError when AI response is missing title', async () => {
    vi.mocked(agenticAiGateway.chat).mockResolvedValue({
      success: true,
      value: {
        content: '{"description": "Some description"}',
        toolCalls: [],
        finishReason: 'stop',
      },
    });

    const input = { projectId: 'project-1' };

    await expect(useCase.execute(input)).rejects.toThrow(AiGenerationError);
    expect(publishTextRepository.save).not.toHaveBeenCalled();
  });

  it('should throw AiGenerationError when AI response is missing description', async () => {
    vi.mocked(agenticAiGateway.chat).mockResolvedValue({
      success: true,
      value: {
        content: '{"title": "Some title"}',
        toolCalls: [],
        finishReason: 'stop',
      },
    });

    const input = { projectId: 'project-1' };

    await expect(useCase.execute(input)).rejects.toThrow(AiGenerationError);
    expect(publishTextRepository.save).not.toHaveBeenCalled();
  });

  it('should extract JSON from AI response with extra text', async () => {
    vi.mocked(agenticAiGateway.chat).mockResolvedValue({
      success: true,
      value: {
        content:
          'Here is the result:\n{"title": "テストタイトル", "description": "テスト説明文 #AI #テスト"}\nI hope this helps!',
        toolCalls: [],
        finishReason: 'stop',
      },
    });

    const input = { projectId: 'project-1' };

    const result = await useCase.execute(input);

    expect(result.title).toBe('テストタイトル');
    expect(result.description).toBe('テスト説明文 #AI #テスト');
    expect(publishTextRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should pass correct data to AI gateway', async () => {
    const input = { projectId: 'project-1' };

    await useCase.execute(input);

    expect(agenticAiGateway.chat).toHaveBeenCalledTimes(1);
    const chatCall = vi.mocked(agenticAiGateway.chat).mock.calls[0]?.[0];
    expect(chatCall).toBeDefined();

    expect(chatCall?.systemPrompt).toContain('タイトルとディスクリプションを作成');
    expect(chatCall?.messages[0]?.role).toBe('user');
    expect(chatCall?.messages[0]?.content).toContain('企画書');
    expect(chatCall?.messages[0]?.content).toContain(mockPlanning.content);
    expect(chatCall?.messages[0]?.content).toContain('シーン1: AIの基礎概念を説明');
    expect(chatCall?.messages[0]?.content).toContain('シーン2: 機械学習について解説');
  });
});
