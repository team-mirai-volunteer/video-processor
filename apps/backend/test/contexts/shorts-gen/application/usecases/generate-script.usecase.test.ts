import { err, ok } from '@shared/domain/types/result.js';
import {
  AiGenerationError,
  NotFoundError,
  ValidationError,
} from '@shorts-gen/application/errors/errors.js';
import {
  GenerateScriptUseCase,
  type GenerateScriptUseCaseDeps,
} from '@shorts-gen/application/usecases/generate-script.usecase.js';
import type {
  AgenticAiGateway,
  ChatCompletionResult,
  StreamChunk,
} from '@shorts-gen/domain/gateways/agentic-ai.gateway.js';
import type { AssetRegistryGateway } from '@shorts-gen/domain/gateways/asset-registry.gateway.js';
import type { ShortsPlanningRepositoryGateway } from '@shorts-gen/domain/gateways/planning-repository.gateway.js';
import type { ShortsSceneRepositoryGateway } from '@shorts-gen/domain/gateways/scene-repository.gateway.js';
import type { ShortsScriptRepositoryGateway } from '@shorts-gen/domain/gateways/script-repository.gateway.js';
import { ShortsPlanning } from '@shorts-gen/domain/models/planning.js';
import { ShortsScene } from '@shorts-gen/domain/models/scene.js';
import { ShortsScript } from '@shorts-gen/domain/models/script.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GenerateScriptUseCase', () => {
  let useCase: GenerateScriptUseCase;
  let agenticAiGateway: AgenticAiGateway;
  let planningRepository: ShortsPlanningRepositoryGateway;
  let scriptRepository: ShortsScriptRepositoryGateway;
  let sceneRepository: ShortsSceneRepositoryGateway;
  let assetRegistryGateway: AssetRegistryGateway;
  let idCounter: number;

  const testProjectId = 'project-1';
  const testPlanningId = 'planning-1';

  const testPlanning = ShortsPlanning.fromProps({
    id: testPlanningId,
    projectId: testProjectId,
    content: '# テスト企画書\n\nこれはテスト用の企画書です。',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const validScenesData = [
    {
      summary: 'オープニング',
      visualType: 'image_gen',
      voiceText: 'こんにちは、今日は特別なお話をします。',
      subtitles: ['こんにちは', '今日は特別なお話をします'],
    },
    {
      summary: '本題',
      visualType: 'stock_video',
      voiceText: '政治について考えてみましょう。',
      subtitles: ['政治について', '考えてみましょう'],
      stockVideoKey: 'politician-speech-1',
    },
    {
      summary: 'エンディング',
      visualType: 'solid_color',
      silenceDurationMs: 3000,
      subtitles: ['ご視聴ありがとうございました'],
      solidColor: '#000000',
    },
  ];

  beforeEach(() => {
    idCounter = 0;

    agenticAiGateway = {
      chat: vi.fn(),
      chatStream: vi.fn(),
    };

    planningRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(testPlanning),
      findByProjectId: vi.fn().mockResolvedValue(testPlanning),
      findAllVersionsByProjectId: vi.fn().mockResolvedValue([testPlanning]),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByProjectId: vi.fn().mockResolvedValue(undefined),
    };

    scriptRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByProjectId: vi.fn().mockResolvedValue(null),
      findByPlanningId: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByProjectId: vi.fn().mockResolvedValue(undefined),
    };

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

    assetRegistryGateway = {
      getVideoAsset: vi.fn().mockReturnValue({
        success: true,
        value: {
          key: 'speech_exciting',
          absolutePath: '/path/to/video.mov',
          description: '党首演説',
          durationMs: 10000,
        },
      }),
      getBgmAsset: vi.fn().mockReturnValue({
        success: false,
        error: { type: 'ASSET_NOT_FOUND', key: 'test', assetType: 'bgm' },
      }),
      getVoiceAsset: vi.fn().mockReturnValue({
        success: true,
        value: {
          key: 'default',
          modelId: 'test-voice-model-id',
          name: 'デフォルト',
          description: '標準的な声',
        },
      }),
      listVideoAssetKeys: vi
        .fn()
        .mockReturnValue(['speech_exciting', 'speech_serious', 'family_financial_struggle']),
      listBgmAssetKeys: vi.fn().mockReturnValue([]),
      listVoiceAssets: vi.fn().mockReturnValue([
        {
          key: 'default',
          modelId: 'test-voice-model-id',
          name: 'デフォルト',
          description: '標準的な声',
        },
      ]),
      assetExists: vi.fn().mockReturnValue(true),
    };

    const deps: GenerateScriptUseCaseDeps = {
      agenticAiGateway,
      planningRepository,
      scriptRepository,
      sceneRepository,
      assetRegistryGateway,
      generateId: () => `id-${++idCounter}`,
    };

    useCase = new GenerateScriptUseCase(deps);
  });

  describe('execute (non-streaming)', () => {
    it('should generate script and scenes when AI calls save_script tool', async () => {
      const mockResult: ChatCompletionResult = {
        content: '台本を作成しました。',
        toolCalls: [
          {
            id: 'call-1',
            name: 'save_script',
            arguments: { scenes: validScenesData },
          },
        ],
        finishReason: 'tool_calls',
      };

      vi.mocked(agenticAiGateway.chat).mockResolvedValue(ok(mockResult));

      const result = await useCase.execute({
        projectId: testProjectId,
        planningId: testPlanningId,
      });

      expect(result.scriptId).toBe('id-1');
      expect(result.scenes).toHaveLength(3);
      expect(result.aiResponse).toBe('台本を作成しました。');

      expect(scriptRepository.save).toHaveBeenCalledTimes(1);
      expect(sceneRepository.saveMany).toHaveBeenCalledTimes(1);

      const saveManyCall = vi.mocked(sceneRepository.saveMany).mock.calls[0];
      expect(saveManyCall).toBeDefined();
      const savedScenes = saveManyCall?.[0];
      expect(savedScenes).toBeDefined();
      expect(savedScenes).toHaveLength(3);
      if (savedScenes) {
        expect(savedScenes[0]?.summary).toBe('オープニング');
        expect(savedScenes[0]?.visualType).toBe('image_gen');
        expect(savedScenes[1]?.stockVideoKey).toBe('politician-speech-1');
        expect(savedScenes[2]?.solidColor).toBe('#000000');
      }
    });

    it('should throw NotFoundError when planning does not exist', async () => {
      vi.mocked(planningRepository.findById).mockResolvedValue(null);

      await expect(
        useCase.execute({
          projectId: testProjectId,
          planningId: testPlanningId,
        })
      ).rejects.toThrow(NotFoundError);

      expect(agenticAiGateway.chat).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when planning belongs to different project', async () => {
      const wrongProjectPlanning = ShortsPlanning.fromProps({
        ...testPlanning.toProps(),
        projectId: 'different-project',
      });
      vi.mocked(planningRepository.findById).mockResolvedValue(wrongProjectPlanning);

      await expect(
        useCase.execute({
          projectId: testProjectId,
          planningId: testPlanningId,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw AiGenerationError when AI fails', async () => {
      vi.mocked(agenticAiGateway.chat).mockResolvedValue(
        err({ type: 'GENERATION_FAILED', message: 'AI error' })
      );

      await expect(
        useCase.execute({
          projectId: testProjectId,
          planningId: testPlanningId,
        })
      ).rejects.toThrow(AiGenerationError);
    });

    it('should throw AiGenerationError when AI does not call save_script', async () => {
      const mockResult: ChatCompletionResult = {
        content: 'この企画書について質問があります。',
        toolCalls: [],
        finishReason: 'stop',
      };

      vi.mocked(agenticAiGateway.chat).mockResolvedValue(ok(mockResult));

      await expect(
        useCase.execute({
          projectId: testProjectId,
          planningId: testPlanningId,
        })
      ).rejects.toThrow(AiGenerationError);
    });

    it('should delete existing script before creating new one', async () => {
      const existingScript = ShortsScript.fromProps({
        id: 'existing-script',
        projectId: testProjectId,
        planningId: testPlanningId,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(scriptRepository.findByProjectId).mockResolvedValue(existingScript);

      const mockResult: ChatCompletionResult = {
        content: '台本を更新しました。',
        toolCalls: [
          {
            id: 'call-1',
            name: 'save_script',
            arguments: { scenes: validScenesData },
          },
        ],
        finishReason: 'tool_calls',
      };

      vi.mocked(agenticAiGateway.chat).mockResolvedValue(ok(mockResult));

      await useCase.execute({
        projectId: testProjectId,
        planningId: testPlanningId,
      });

      expect(sceneRepository.deleteByScriptId).toHaveBeenCalledWith('existing-script');
      expect(scriptRepository.delete).toHaveBeenCalledWith('existing-script');
    });

    it('should include user message in conversation when provided', async () => {
      const mockResult: ChatCompletionResult = {
        content: '修正しました。',
        toolCalls: [
          {
            id: 'call-1',
            name: 'save_script',
            arguments: { scenes: validScenesData },
          },
        ],
        finishReason: 'tool_calls',
      };

      vi.mocked(agenticAiGateway.chat).mockResolvedValue(ok(mockResult));

      await useCase.execute({
        projectId: testProjectId,
        planningId: testPlanningId,
        userMessage: 'もう少し短くしてください',
        conversationHistory: [{ role: 'assistant', content: '最初の台本です' }],
      });

      const chatCalls = vi.mocked(agenticAiGateway.chat).mock.calls[0];
      expect(chatCalls).toBeDefined();
      const chatCall = chatCalls?.[0];
      expect(chatCall).toBeDefined();
      if (chatCall) {
        expect(chatCall.messages).toHaveLength(2);
        expect(chatCall.messages[0]?.role).toBe('assistant');
        expect(chatCall.messages[1]?.role).toBe('user');
        expect(chatCall.messages[1]?.content).toBe('もう少し短くしてください');
      }
    });
  });

  describe('executeStream', () => {
    it('should return stream and handle tool calls', async () => {
      async function* mockStream(): AsyncIterable<StreamChunk> {
        yield { type: 'text_delta', textDelta: '台本を' };
        yield { type: 'text_delta', textDelta: '作成します。' };
        yield {
          type: 'tool_call',
          toolCall: {
            id: 'call-1',
            name: 'save_script',
            arguments: { scenes: validScenesData },
          },
        };
        yield { type: 'done', finishReason: 'tool_calls' };
      }

      vi.mocked(agenticAiGateway.chatStream).mockResolvedValue(ok(mockStream()));

      const result = await useCase.executeStream({
        projectId: testProjectId,
        planningId: testPlanningId,
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of result.stream) {
        chunks.push(chunk);
      }

      // Original chunks plus the tool result message
      expect(chunks.length).toBeGreaterThanOrEqual(4);
      expect(chunks[0]?.textDelta).toBe('台本を');
      expect(chunks[1]?.textDelta).toBe('作成します。');
      expect(chunks[2]?.type).toBe('tool_call');

      // Script and scenes should be saved
      expect(scriptRepository.save).toHaveBeenCalledTimes(1);
      expect(sceneRepository.saveMany).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundError when planning does not exist', async () => {
      vi.mocked(planningRepository.findById).mockResolvedValue(null);

      await expect(
        useCase.executeStream({
          projectId: testProjectId,
          planningId: testPlanningId,
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw AiGenerationError when stream fails', async () => {
      vi.mocked(agenticAiGateway.chatStream).mockResolvedValue(
        err({ type: 'GENERATION_FAILED', message: 'Stream error' })
      );

      await expect(
        useCase.executeStream({
          projectId: testProjectId,
          planningId: testPlanningId,
        })
      ).rejects.toThrow(AiGenerationError);
    });
  });

  describe('scene validation', () => {
    it('should throw ValidationError for invalid scene data', async () => {
      const invalidScenesData = [
        {
          summary: 'Invalid scene',
          visualType: 'image_gen',
          // Missing both voiceText and silenceDurationMs
        },
      ];

      const mockResult: ChatCompletionResult = {
        content: '台本を作成しました。',
        toolCalls: [
          {
            id: 'call-1',
            name: 'save_script',
            arguments: { scenes: invalidScenesData },
          },
        ],
        finishReason: 'tool_calls',
      };

      vi.mocked(agenticAiGateway.chat).mockResolvedValue(ok(mockResult));

      await expect(
        useCase.execute({
          projectId: testProjectId,
          planningId: testPlanningId,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for stock_video without stockVideoKey', async () => {
      const invalidScenesData = [
        {
          summary: 'Stock video without key',
          visualType: 'stock_video',
          voiceText: 'Some text',
          // Missing stockVideoKey
        },
      ];

      const mockResult: ChatCompletionResult = {
        content: '台本を作成しました。',
        toolCalls: [
          {
            id: 'call-1',
            name: 'save_script',
            arguments: { scenes: invalidScenesData },
          },
        ],
        finishReason: 'tool_calls',
      };

      vi.mocked(agenticAiGateway.chat).mockResolvedValue(ok(mockResult));

      await expect(
        useCase.execute({
          projectId: testProjectId,
          planningId: testPlanningId,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for solid_color without solidColor', async () => {
      const invalidScenesData = [
        {
          summary: 'Solid color without color',
          visualType: 'solid_color',
          silenceDurationMs: 3000,
          // Missing solidColor
        },
      ];

      const mockResult: ChatCompletionResult = {
        content: '台本を作成しました。',
        toolCalls: [
          {
            id: 'call-1',
            name: 'save_script',
            arguments: { scenes: invalidScenesData },
          },
        ],
        finishReason: 'tool_calls',
      };

      vi.mocked(agenticAiGateway.chat).mockResolvedValue(ok(mockResult));

      await expect(
        useCase.execute({
          projectId: testProjectId,
          planningId: testPlanningId,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('load_script tool', () => {
    it('should return formatted script when script exists', async () => {
      const existingScript = ShortsScript.fromProps({
        id: 'existing-script',
        projectId: testProjectId,
        planningId: testPlanningId,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mockScenes = [
        ShortsScene.fromProps({
          id: 'scene-1',
          scriptId: 'existing-script',
          order: 0,
          summary: 'オープニング',
          visualType: 'image_gen',
          voiceText: 'こんにちは',
          subtitles: ['こんにちは'],
          silenceDurationMs: null,
          stockVideoKey: null,
          solidColor: null,
          imagePrompt: null,
          imageStyleHint: 'アニメ風',
          voiceKey: null,
          voiceSpeed: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        ShortsScene.fromProps({
          id: 'scene-2',
          scriptId: 'existing-script',
          order: 1,
          summary: 'エンディング',
          visualType: 'solid_color',
          voiceText: null,
          subtitles: ['ご視聴ありがとう'],
          silenceDurationMs: 3000,
          stockVideoKey: null,
          solidColor: '#000000',
          imagePrompt: null,
          imageStyleHint: null,
          voiceKey: null,
          voiceSpeed: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ];

      vi.mocked(scriptRepository.findByProjectId).mockResolvedValue(existingScript);
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue(mockScenes);

      async function* mockStream(): AsyncIterable<StreamChunk> {
        yield { type: 'text_delta', textDelta: '台本を読み込みます。' };
        yield {
          type: 'tool_call',
          toolCall: {
            id: 'call-1',
            name: 'load_script',
            arguments: {},
          },
        };
        yield { type: 'done', finishReason: 'tool_calls' };
      }

      vi.mocked(agenticAiGateway.chatStream).mockResolvedValue(ok(mockStream()));

      const result = await useCase.executeStream({
        projectId: testProjectId,
        planningId: testPlanningId,
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of result.stream) {
        chunks.push(chunk);
      }

      // Verify load_script tool was processed
      expect(scriptRepository.findByProjectId).toHaveBeenCalledWith(testProjectId);
      expect(sceneRepository.findByScriptId).toHaveBeenCalledWith('existing-script');

      // Find the text_delta chunk that contains the loaded script
      const loadResultChunk = chunks.find(
        (c) => c.type === 'text_delta' && c.textDelta?.includes('現在の台本')
      );
      expect(loadResultChunk).toBeDefined();
      expect(loadResultChunk?.textDelta).toContain('シーン1');
      expect(loadResultChunk?.textDelta).toContain('オープニング');
      expect(loadResultChunk?.textDelta).toContain('シーン2');
      expect(loadResultChunk?.textDelta).toContain('エンディング');
      expect(loadResultChunk?.textDelta).toContain('3000ms');
      expect(loadResultChunk?.textDelta).toContain('#000000');
      expect(loadResultChunk?.textDelta).toContain('アニメ風');
    });

    it('should return "台本はまだ作成されていません" when no script exists', async () => {
      vi.mocked(scriptRepository.findByProjectId).mockResolvedValue(null);

      async function* mockStream(): AsyncIterable<StreamChunk> {
        yield { type: 'text_delta', textDelta: '台本を読み込みます。' };
        yield {
          type: 'tool_call',
          toolCall: {
            id: 'call-1',
            name: 'load_script',
            arguments: {},
          },
        };
        yield { type: 'done', finishReason: 'tool_calls' };
      }

      vi.mocked(agenticAiGateway.chatStream).mockResolvedValue(ok(mockStream()));

      const result = await useCase.executeStream({
        projectId: testProjectId,
        planningId: testPlanningId,
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of result.stream) {
        chunks.push(chunk);
      }

      // Find the text_delta chunk that contains the result
      const loadResultChunk = chunks.find(
        (c) => c.type === 'text_delta' && c.textDelta?.includes('台本はまだ作成されていません')
      );
      expect(loadResultChunk).toBeDefined();
    });

    it('should return "台本はまだ作成されていません" when script has no scenes', async () => {
      const existingScript = ShortsScript.fromProps({
        id: 'existing-script',
        projectId: testProjectId,
        planningId: testPlanningId,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(scriptRepository.findByProjectId).mockResolvedValue(existingScript);
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue([]);

      async function* mockStream(): AsyncIterable<StreamChunk> {
        yield { type: 'text_delta', textDelta: '台本を読み込みます。' };
        yield {
          type: 'tool_call',
          toolCall: {
            id: 'call-1',
            name: 'load_script',
            arguments: {},
          },
        };
        yield { type: 'done', finishReason: 'tool_calls' };
      }

      vi.mocked(agenticAiGateway.chatStream).mockResolvedValue(ok(mockStream()));

      const result = await useCase.executeStream({
        projectId: testProjectId,
        planningId: testPlanningId,
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of result.stream) {
        chunks.push(chunk);
      }

      // Find the text_delta chunk that contains the result
      const loadResultChunk = chunks.find(
        (c) => c.type === 'text_delta' && c.textDelta?.includes('台本はまだ作成されていません')
      );
      expect(loadResultChunk).toBeDefined();
    });
  });
});
