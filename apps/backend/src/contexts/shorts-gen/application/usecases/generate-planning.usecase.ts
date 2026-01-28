import type {
  AgenticAiGateway,
  ChatMessage,
  StreamChunk,
  ToolDefinition,
} from '@shorts-gen/domain/gateways/index.js';
import type { ShortsPlanningRepositoryGateway } from '@shorts-gen/domain/gateways/planning-repository.gateway.js';
import type { ShortsProjectRepositoryGateway } from '@shorts-gen/domain/gateways/project-repository.gateway.js';
import { ShortsPlanning } from '@shorts-gen/domain/models/planning.js';
import { AiGenerationError, NotFoundError, ValidationError } from '../errors/errors.js';

/**
 * 企画書生成のシステムプロンプト
 */
const PLANNING_SYSTEM_PROMPT = `あなたはショート動画の企画書を作成するAIアシスタントです。

ユーザーから提供された情報（マニフェスト、URL、テキストなど）を元に、魅力的なショート動画の企画書をマークダウン形式で作成してください。

企画書には以下の要素を含めてください：
- タイトル案
- 動画の目的・コンセプト
- ターゲット視聴者
- 主要なメッセージ
- 想定される構成（概要レベル）
- 期待される効果

企画書が完成したら、必ず save_planning ツールを使用して保存してください。
ユーザーからのフィードバックに応じて企画書を修正し、再度保存することも可能です。`;

/**
 * save_planning ツールの定義
 */
const SAVE_PLANNING_TOOL: ToolDefinition = {
  name: 'save_planning',
  description:
    '企画書をマークダウン形式で保存します。企画書が完成したら、このツールを使用して保存してください。',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: '企画書のマークダウンコンテンツ',
      },
    },
    required: ['content'],
  },
};

/**
 * GeneratePlanningUseCase の依存関係
 */
export interface GeneratePlanningUseCaseDeps {
  agenticAiGateway: AgenticAiGateway;
  planningRepository: ShortsPlanningRepositoryGateway;
  projectRepository: ShortsProjectRepositoryGateway;
  generateId: () => string;
}

/**
 * 企画書生成の入力パラメータ
 */
export interface GeneratePlanningInput {
  /** プロジェクトID */
  projectId: string;
  /** ユーザーからのメッセージ（マニフェスト、URL、指示など） */
  userMessage: string;
  /** 会話履歴（オプション） */
  conversationHistory?: ChatMessage[];
}

/**
 * 企画書生成の結果
 */
export interface GeneratePlanningResult {
  /** 生成されたAIの応答テキスト */
  responseText: string;
  /** 保存された企画書（tool useで保存された場合） */
  savedPlanning: ShortsPlanning | null;
}

/**
 * ストリーミングチャンク（拡張版）
 */
export interface PlanningStreamChunk extends StreamChunk {
  /** 保存された企画書（tool_callで保存された場合） */
  savedPlanning?: ShortsPlanning;
}

/**
 * GeneratePlanningUseCase
 *
 * 企画書を生成するUseCase。
 * OpenAI Agentic AIを使用して、ユーザーの入力から企画書をマークダウン形式で生成し、
 * tool useを通じてDBに保存します。
 *
 * 対話的なフローをサポートし、SSE対応のストリーミング実行も可能です。
 */
export class GeneratePlanningUseCase {
  private readonly agenticAiGateway: AgenticAiGateway;
  private readonly planningRepository: ShortsPlanningRepositoryGateway;
  private readonly projectRepository: ShortsProjectRepositoryGateway;
  private readonly generateId: () => string;

  constructor(deps: GeneratePlanningUseCaseDeps) {
    this.agenticAiGateway = deps.agenticAiGateway;
    this.planningRepository = deps.planningRepository;
    this.projectRepository = deps.projectRepository;
    this.generateId = deps.generateId;
  }

  /**
   * 企画書を生成する（非ストリーミング）
   */
  async execute(input: GeneratePlanningInput): Promise<GeneratePlanningResult> {
    // 入力バリデーション
    this.validateInput(input);

    // プロジェクトの存在確認
    const projectExists = await this.projectRepository.exists(input.projectId);
    if (!projectExists) {
      throw new NotFoundError('Project', input.projectId);
    }

    // メッセージ履歴を構築
    const messages: ChatMessage[] = [
      ...(input.conversationHistory ?? []),
      { role: 'user', content: input.userMessage },
    ];

    // AIに生成を依頼
    const chatResult = await this.agenticAiGateway.chat({
      messages,
      tools: [SAVE_PLANNING_TOOL],
      systemPrompt: PLANNING_SYSTEM_PROMPT,
    });

    if (!chatResult.success) {
      const errorMessage =
        'message' in chatResult.error ? chatResult.error.message : chatResult.error.type;
      throw new AiGenerationError(errorMessage);
    }

    const result = chatResult.value;
    let savedPlanning: ShortsPlanning | null = null;

    // tool_callがあった場合、企画書を保存
    for (const toolCall of result.toolCalls) {
      if (toolCall.name === 'save_planning') {
        const content = toolCall.arguments.content as string;
        savedPlanning = await this.savePlanning(input.projectId, content);
      }
    }

    return {
      responseText: result.content,
      savedPlanning,
    };
  }

  /**
   * 企画書を生成する（ストリーミング）
   * SSE対応で、チャンクを逐次返します。
   */
  async *executeStream(input: GeneratePlanningInput): AsyncGenerator<PlanningStreamChunk> {
    // 入力バリデーション
    this.validateInput(input);

    // プロジェクトの存在確認
    const projectExists = await this.projectRepository.exists(input.projectId);
    if (!projectExists) {
      throw new NotFoundError('Project', input.projectId);
    }

    // メッセージ履歴を構築
    const messages: ChatMessage[] = [
      ...(input.conversationHistory ?? []),
      { role: 'user', content: input.userMessage },
    ];

    // AIにストリーミング生成を依頼
    const streamResult = await this.agenticAiGateway.chatStream({
      messages,
      tools: [SAVE_PLANNING_TOOL],
      systemPrompt: PLANNING_SYSTEM_PROMPT,
    });

    if (!streamResult.success) {
      const errorMessage =
        'message' in streamResult.error ? streamResult.error.message : streamResult.error.type;
      yield {
        type: 'error',
        error: errorMessage,
      };
      return;
    }

    // ストリームを処理
    for await (const chunk of streamResult.value) {
      // tool_callの場合、企画書を保存
      if (chunk.type === 'tool_call' && chunk.toolCall?.name === 'save_planning') {
        const content = chunk.toolCall.arguments.content as string;
        const savedPlanning = await this.savePlanning(input.projectId, content);

        yield {
          ...chunk,
          savedPlanning,
        };
      } else {
        yield chunk;
      }
    }
  }

  /**
   * 入力のバリデーション
   */
  private validateInput(input: GeneratePlanningInput): void {
    if (!input.projectId || input.projectId.trim().length === 0) {
      throw new ValidationError('Project ID is required');
    }

    if (!input.userMessage || input.userMessage.trim().length === 0) {
      throw new ValidationError('User message is required');
    }
  }

  /**
   * 企画書を保存する
   */
  private async savePlanning(projectId: string, content: string): Promise<ShortsPlanning> {
    // 既存の企画書があるか確認
    const existingPlanning = await this.planningRepository.findByProjectId(projectId);

    let planning: ShortsPlanning;

    if (existingPlanning) {
      // 既存の企画書を更新（新しいバージョンとして）
      const updateResult = existingPlanning.withContent(content);
      if (!updateResult.success) {
        throw new ValidationError(updateResult.error.message);
      }
      planning = updateResult.value;
    } else {
      // 新規作成
      const createResult = ShortsPlanning.create({ projectId, content }, this.generateId);
      if (!createResult.success) {
        throw new ValidationError(createResult.error.message);
      }
      planning = createResult.value;
    }

    // DBに保存
    await this.planningRepository.save(planning);

    return planning;
  }
}
