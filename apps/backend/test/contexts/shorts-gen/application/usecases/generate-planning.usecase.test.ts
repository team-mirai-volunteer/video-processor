import { err, ok } from '@shared/domain/types/result.js';
import {
  AiGenerationError,
  NotFoundError,
  ValidationError,
} from '@shorts-gen/application/errors/errors.js';
import {
  GeneratePlanningUseCase,
  type GeneratePlanningUseCaseDeps,
} from '@shorts-gen/application/usecases/generate-planning.usecase.js';
import type {
  AgenticAiGateway,
  ChatCompletionResult,
  StreamChunk,
} from '@shorts-gen/domain/gateways/agentic-ai.gateway.js';
import type { ShortsPlanningRepositoryGateway } from '@shorts-gen/domain/gateways/planning-repository.gateway.js';
import type { ShortsProjectRepositoryGateway } from '@shorts-gen/domain/gateways/project-repository.gateway.js';
import type { UrlContentFetcherGateway } from '@shorts-gen/domain/gateways/url-content-fetcher.gateway.js';
import { ShortsPlanning } from '@shorts-gen/domain/models/planning.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GeneratePlanningUseCase', () => {
  let useCase: GeneratePlanningUseCase;
  let agenticAiGateway: AgenticAiGateway;
  let planningRepository: ShortsPlanningRepositoryGateway;
  let projectRepository: ShortsProjectRepositoryGateway;
  let urlContentFetcherGateway: UrlContentFetcherGateway;
  let idCounter: number;

  const createDeps = (): GeneratePlanningUseCaseDeps => ({
    agenticAiGateway,
    planningRepository,
    projectRepository,
    urlContentFetcherGateway,
    generateId: () => `planning-${++idCounter}`,
  });

  beforeEach(() => {
    idCounter = 0;

    // Mock AgenticAiGateway
    agenticAiGateway = {
      chat: vi.fn(),
      chatStream: vi.fn(),
    };

    // Mock PlanningRepository
    planningRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByProjectId: vi.fn().mockResolvedValue(null),
      findAllVersionsByProjectId: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByProjectId: vi.fn().mockResolvedValue(undefined),
    };

    // Mock ProjectRepository
    projectRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue({ projects: [], total: 0 }),
      delete: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(true),
    };

    // Mock UrlContentFetcherGateway
    urlContentFetcherGateway = {
      fetchContent: vi.fn().mockResolvedValue(ok({ content: 'Fetched content' })),
    };

    useCase = new GeneratePlanningUseCase(createDeps());
  });

  describe('execute (non-streaming)', () => {
    it('should generate planning and save via tool use', async () => {
      const planningContent = '# 企画書\n\nこれはテスト企画書です。';
      const chatResult: ChatCompletionResult = {
        content: '企画書を作成しました。',
        toolCalls: [
          {
            id: 'call-1',
            name: 'save_planning',
            arguments: { content: planningContent },
          },
        ],
        finishReason: 'tool_calls',
      };
      vi.mocked(agenticAiGateway.chat).mockResolvedValue(ok(chatResult));

      const input = {
        projectId: 'project-1',
        userMessage: 'AIについてのショート動画の企画書を作成してください。',
      };

      const result = await useCase.execute(input);

      expect(result.responseText).toBe('企画書を作成しました。');
      expect(result.savedPlanning).not.toBeNull();
      expect(result.savedPlanning?.content).toBe(planningContent);
      expect(result.savedPlanning?.projectId).toBe('project-1');
      expect(result.savedPlanning?.version).toBe(1);

      expect(planningRepository.save).toHaveBeenCalledTimes(1);
      expect(agenticAiGateway.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: input.userMessage }],
          tools: expect.arrayContaining([expect.objectContaining({ name: 'save_planning' })]),
        })
      );
    });

    it('should return null savedPlanning when no tool call is made', async () => {
      const chatResult: ChatCompletionResult = {
        content: 'もう少し詳しい情報を教えてください。',
        toolCalls: [],
        finishReason: 'stop',
      };
      vi.mocked(agenticAiGateway.chat).mockResolvedValue(ok(chatResult));

      const input = {
        projectId: 'project-1',
        userMessage: '企画書を作って',
      };

      const result = await useCase.execute(input);

      expect(result.responseText).toBe('もう少し詳しい情報を教えてください。');
      expect(result.savedPlanning).toBeNull();
      expect(planningRepository.save).not.toHaveBeenCalled();
    });

    it('should update existing planning when one exists', async () => {
      const existingPlanning = ShortsPlanning.fromProps({
        id: 'existing-planning-1',
        projectId: 'project-1',
        content: '# 古い企画書',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(planningRepository.findByProjectId).mockResolvedValue(existingPlanning);

      const newContent = '# 更新された企画書\n\n新しい内容です。';
      const chatResult: ChatCompletionResult = {
        content: '企画書を更新しました。',
        toolCalls: [
          {
            id: 'call-1',
            name: 'save_planning',
            arguments: { content: newContent },
          },
        ],
        finishReason: 'tool_calls',
      };
      vi.mocked(agenticAiGateway.chat).mockResolvedValue(ok(chatResult));

      const input = {
        projectId: 'project-1',
        userMessage: '企画書を修正してください。',
      };

      const result = await useCase.execute(input);

      expect(result.savedPlanning?.content).toBe(newContent);
      expect(result.savedPlanning?.version).toBe(2);
      expect(result.savedPlanning?.id).toBe('existing-planning-1');
      expect(planningRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should include conversation history in messages', async () => {
      const chatResult: ChatCompletionResult = {
        content: '了解しました。',
        toolCalls: [],
        finishReason: 'stop',
      };
      vi.mocked(agenticAiGateway.chat).mockResolvedValue(ok(chatResult));

      const input = {
        projectId: 'project-1',
        userMessage: 'タイトルを変更してください。',
        conversationHistory: [
          { role: 'user' as const, content: '企画書を作って' },
          { role: 'assistant' as const, content: '企画書を作成しました。' },
        ],
      };

      await useCase.execute(input);

      expect(agenticAiGateway.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'user', content: '企画書を作って' },
            { role: 'assistant', content: '企画書を作成しました。' },
            { role: 'user', content: 'タイトルを変更してください。' },
          ],
        })
      );
    });

    it('should throw NotFoundError when project does not exist', async () => {
      vi.mocked(projectRepository.exists).mockResolvedValue(false);

      const input = {
        projectId: 'non-existent-project',
        userMessage: 'テスト',
      };

      await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
      expect(agenticAiGateway.chat).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when projectId is empty', async () => {
      const input = {
        projectId: '',
        userMessage: 'テスト',
      };

      await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
      expect(projectRepository.exists).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when userMessage is empty', async () => {
      const input = {
        projectId: 'project-1',
        userMessage: '',
      };

      await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
      expect(projectRepository.exists).not.toHaveBeenCalled();
    });

    it('should throw AiGenerationError when AI gateway returns error', async () => {
      vi.mocked(agenticAiGateway.chat).mockResolvedValue(
        err({ type: 'GENERATION_FAILED', message: 'API error' })
      );

      const input = {
        projectId: 'project-1',
        userMessage: 'テスト',
      };

      await expect(useCase.execute(input)).rejects.toThrow(AiGenerationError);
    });
  });

  describe('executeStream (streaming)', () => {
    it('should stream chunks and save planning on tool call', async () => {
      const planningContent = '# ストリーミング企画書';
      const mockChunks: StreamChunk[] = [
        { type: 'text_delta', textDelta: '企画書を' },
        { type: 'text_delta', textDelta: '作成中...' },
        {
          type: 'tool_call',
          toolCall: {
            id: 'call-1',
            name: 'save_planning',
            arguments: { content: planningContent },
          },
        },
        { type: 'done', finishReason: 'tool_calls' },
      ];

      async function* mockStream(): AsyncIterable<StreamChunk> {
        for (const chunk of mockChunks) {
          yield chunk;
        }
      }

      vi.mocked(agenticAiGateway.chatStream).mockResolvedValue(ok(mockStream()));

      const input = {
        projectId: 'project-1',
        userMessage: 'ストリーミングで企画書を作成してください。',
      };

      const chunks = [];
      for await (const chunk of useCase.executeStream(input)) {
        chunks.push(chunk);
      }

      // 新しいフロー: text_delta x2, tool_call (通知), tool_call (保存完了), done
      expect(chunks).toHaveLength(5);
      expect(chunks[0]).toEqual({ type: 'text_delta', textDelta: '企画書を' });
      expect(chunks[1]).toEqual({ type: 'text_delta', textDelta: '作成中...' });
      expect(chunks[2]?.type).toBe('tool_call');
      // チャンク[3]が保存完了通知（savedPlanningを含む）
      expect(chunks[3]?.type).toBe('tool_call');
      expect(chunks[3]?.savedPlanning).toBeDefined();
      expect(chunks[3]?.savedPlanning?.planning?.content).toBe(planningContent);
      expect(chunks[4]).toEqual({ type: 'done', finishReason: 'stop' });

      expect(planningRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should yield error chunk when AI gateway returns error', async () => {
      vi.mocked(agenticAiGateway.chatStream).mockResolvedValue(
        err({ type: 'GENERATION_FAILED', message: 'Stream error' })
      );

      const input = {
        projectId: 'project-1',
        userMessage: 'テスト',
      };

      const chunks = [];
      for await (const chunk of useCase.executeStream(input)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.type).toBe('error');
      expect(chunks[0]?.error).toBe('Stream error');
    });

    it('should throw NotFoundError when project does not exist in streaming', async () => {
      vi.mocked(projectRepository.exists).mockResolvedValue(false);

      const input = {
        projectId: 'non-existent-project',
        userMessage: 'テスト',
      };

      await expect(async () => {
        for await (const _ of useCase.executeStream(input)) {
          // consume stream
        }
      }).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when input is invalid in streaming', async () => {
      const input = {
        projectId: 'project-1',
        userMessage: '   ',
      };

      await expect(async () => {
        for await (const _ of useCase.executeStream(input)) {
          // consume stream
        }
      }).rejects.toThrow(ValidationError);
    });
  });
});
