import { createLogger } from '@shared/infrastructure/logging/logger.js';
import type {
  AgenticAiGateway,
  AgenticAiGatewayError,
  ChatMessage,
  StreamChunk,
  ToolCall,
  ToolDefinition,
} from '@shorts-gen/domain/gateways/agentic-ai.gateway.js';
import type { AssetRegistryGateway } from '@shorts-gen/domain/gateways/asset-registry.gateway.js';
import type { ShortsPlanningRepositoryGateway } from '@shorts-gen/domain/gateways/planning-repository.gateway.js';
import type { ShortsSceneRepositoryGateway } from '@shorts-gen/domain/gateways/scene-repository.gateway.js';
import type { ShortsScriptRepositoryGateway } from '@shorts-gen/domain/gateways/script-repository.gateway.js';
import { ShortsScene, type VisualType } from '@shorts-gen/domain/models/scene.js';
import { ShortsScript } from '@shorts-gen/domain/models/script.js';
import { AiGenerationError, NotFoundError, ValidationError } from '../errors/errors.js';

const log = createLogger('GenerateScriptUseCase');

/**
 * AgenticAiGatewayError からエラーメッセージを取得する
 */
function getErrorMessage(error: AgenticAiGatewayError): string {
  if ('message' in error) {
    return error.message;
  }
  return error.type;
}

/**
 * シーン入力パラメータ（AIが生成する形式）
 */
interface SceneInput {
  summary: string;
  visualType: VisualType;
  voiceText?: string | null;
  subtitles?: string[];
  silenceDurationMs?: number | null;
  stockVideoKey?: string | null;
  solidColor?: string | null;
  imageStyleHint?: string | null;
}

/**
 * GenerateScriptUseCase 入力パラメータ
 */
export interface GenerateScriptInput {
  projectId: string;
  planningId: string;
  userMessage?: string;
  conversationHistory?: ChatMessage[];
}

/**
 * GenerateScriptUseCase ストリーミング結果
 */
export interface GenerateScriptStreamResult {
  stream: AsyncIterable<ScriptStreamChunk>;
  scriptId: string | null;
}

/**
 * スクリプト用のシーンデータ（フロントエンド向け）
 */
interface ScriptSceneData {
  id: string;
  scriptId: string;
  order: number;
  summary: string;
  visualType: VisualType;
  voiceText: string | null;
  subtitles: string[];
  silenceDurationMs: number | null;
  stockVideoKey: string | null;
  solidColor: string | null;
  imagePrompt: string | null;
  imageStyleHint: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * スクリプト用のストリームチャンク（拡張版）
 */
export interface ScriptStreamChunk extends StreamChunk {
  /** 保存されたスクリプトとシーン（tool_callで保存された場合） */
  savedScript?: {
    script: {
      id: string;
      projectId: string;
      planningId: string;
      version: number;
    };
    scenes: ScriptSceneData[];
  };
}

/**
 * GenerateScriptUseCase 依存関係
 */
export interface GenerateScriptUseCaseDeps {
  agenticAiGateway: AgenticAiGateway;
  planningRepository: ShortsPlanningRepositoryGateway;
  scriptRepository: ShortsScriptRepositoryGateway;
  sceneRepository: ShortsSceneRepositoryGateway;
  assetRegistryGateway: AssetRegistryGateway;
  generateId: () => string;
}

/**
 * save_script ツールの引数型
 */
interface SaveScriptToolArguments {
  scenes: SceneInput[];
}

/**
 * 台本生成用のシステムプロンプトのベース部分
 */
const SYSTEM_PROMPT_BASE = `あなたはショート動画の台本作成アシスタントです。
企画書の内容を元に、視聴者を引きつける魅力的な台本を作成してください。

## 台本の要件

1. **シーン構成**: 各シーンは以下の要素を含みます
   - summary: シーンの概要（何が起こるか）
   - visualType: 映像タイプ（image_gen: AI生成画像、stock_video: ストック動画、solid_color: 単色背景）
   - voiceText: ナレーション文（読み上げテキスト、無音の場合はnull）
   - subtitles: 字幕テキストの配列（1シーンに複数可）
   - silenceDurationMs: 無音シーンの長さ（ミリ秒、voiceTextがある場合はnull）
   - stockVideoKey: ストック動画のキー（visualTypeがstock_videoの場合のみ、下記の利用可能なキーから選択）
   - solidColor: 背景色（#RRGGBB形式、visualTypeがsolid_colorの場合のみ）
   - imageStyleHint: 画像生成時のスタイルヒント（任意）

2. **重要なルール**
   - 各シーンにはvoiceTextかsilenceDurationMsのいずれかが必須
   - visualTypeがstock_videoの場合はstockVideoKeyが必須（下記の利用可能なキーのみ使用可能）
   - visualTypeがsolid_colorの場合はsolidColor（#RRGGBB形式）が必須
   - ショート動画は60秒以内を目安に
   - 視聴者の注目を引く冒頭を心がける
   - 字幕は読みやすい長さに分割する

3. **台本完成時の操作**
   - 台本が完成したら、必ずsave_scriptツールを呼び出して保存してください
   - ユーザーからの修正要望があれば、修正した台本を再度save_scriptで保存してください

ユーザーと対話しながら、最適な台本を作成してください。`;

/**
 * save_script ツールの定義
 * Note: Using type assertion because the nested object schema structure
 * is more complex than ToolParameterSchema allows, but is valid JSON Schema
 */
const SAVE_SCRIPT_TOOL: ToolDefinition = {
  name: 'save_script',
  description:
    '台本（シーンの配列）をデータベースに保存します。台本が完成したら必ず呼び出してください。',
  parameters: {
    type: 'object',
    properties: {
      scenes: {
        type: 'array',
        description: 'シーンの配列',
        items: {
          type: 'object',
          properties: {
            summary: {
              type: 'string',
              description: 'シーンの概要・説明（必須、空文字不可）',
            },
            visualType: {
              type: 'string',
              enum: ['image_gen', 'stock_video', 'solid_color'],
              description:
                '映像タイプ: image_gen=AI生成画像、stock_video=ストック動画、solid_color=単色背景',
            },
            voiceText: {
              type: 'string',
              description: 'ナレーション文（読み上げテキスト）。無音シーンの場合はnullまたは省略',
            },
            subtitles: {
              type: 'array',
              items: { type: 'string' },
              description: '字幕テキストの配列（1シーンに複数可）',
            },
            silenceDurationMs: {
              type: 'number',
              description: '無音シーンの長さ（ミリ秒）。voiceTextがある場合はnullまたは省略',
            },
            stockVideoKey: {
              type: 'string',
              description: 'ストック動画のキー（visualTypeがstock_videoの場合のみ必須）',
            },
            solidColor: {
              type: 'string',
              description: '背景色（#RRGGBB形式、visualTypeがsolid_colorの場合のみ必須）',
            },
            imageStyleHint: {
              type: 'string',
              description: '画像生成時のスタイルヒント（任意）',
            },
          },
          required: ['summary', 'visualType'],
        },
      },
    },
    required: ['scenes'],
  },
};

/**
 * 台本生成UseCase
 * 企画書をベースにAIで台本（シーン配列）を対話的に生成する
 */
export class GenerateScriptUseCase {
  private readonly agenticAiGateway: AgenticAiGateway;
  private readonly planningRepository: ShortsPlanningRepositoryGateway;
  private readonly scriptRepository: ShortsScriptRepositoryGateway;
  private readonly sceneRepository: ShortsSceneRepositoryGateway;
  private readonly assetRegistryGateway: AssetRegistryGateway;
  private readonly generateId: () => string;

  constructor(deps: GenerateScriptUseCaseDeps) {
    this.agenticAiGateway = deps.agenticAiGateway;
    this.planningRepository = deps.planningRepository;
    this.scriptRepository = deps.scriptRepository;
    this.sceneRepository = deps.sceneRepository;
    this.assetRegistryGateway = deps.assetRegistryGateway;
    this.generateId = deps.generateId;
  }

  /**
   * 利用可能なストック動画一覧を含むシステムプロンプトを生成
   */
  private buildSystemPrompt(): string {
    const videoKeys = this.assetRegistryGateway.listVideoAssetKeys();

    // 各キーの説明を取得
    const videoDescriptions = videoKeys
      .map((key) => {
        const result = this.assetRegistryGateway.getVideoAsset(key);
        if (result.success) {
          return `   - ${key}: ${result.value.description}`;
        }
        return `   - ${key}`;
      })
      .join('\n');

    const stockVideoSection =
      videoKeys.length > 0
        ? `

4. **利用可能なストック動画（stockVideoKey）**
   visualTypeがstock_videoの場合、以下のキーのみ使用可能です:
${videoDescriptions}`
        : '';

    return SYSTEM_PROMPT_BASE + stockVideoSection;
  }

  /**
   * 台本生成を実行（ストリーミング）
   */
  async executeStream(input: GenerateScriptInput): Promise<GenerateScriptStreamResult> {
    const { projectId, planningId, userMessage, conversationHistory = [] } = input;

    log.info('Starting script generation', { projectId, planningId });

    // 1. 企画書を取得
    const planning = await this.planningRepository.findById(planningId);
    if (!planning) {
      throw new NotFoundError('Planning', planningId);
    }

    if (planning.projectId !== projectId) {
      throw new ValidationError(`Planning ${planningId} does not belong to project ${projectId}`);
    }

    log.info('Found planning', { planningId, projectId: planning.projectId });

    // 2. メッセージ履歴を構築
    const messages: ChatMessage[] = [...conversationHistory];

    // 初回の場合は企画書の内容を追加
    if (messages.length === 0) {
      messages.push({
        role: 'user',
        content: `以下の企画書を元に、ショート動画の台本を作成してください。\n\n## 企画書\n\n${planning.content}`,
      });
    } else if (userMessage) {
      // 継続の場合はユーザーメッセージを追加
      messages.push({
        role: 'user',
        content: userMessage,
      });
    }

    // 3. AIストリーミングを開始
    const streamResult = await this.agenticAiGateway.chatStream({
      messages,
      tools: [SAVE_SCRIPT_TOOL],
      systemPrompt: this.buildSystemPrompt(),
      temperature: 0.7,
    });

    if (!streamResult.success) {
      const error = streamResult.error;
      const errorMessage = getErrorMessage(error);
      log.error('AI stream failed', new Error(errorMessage), {
        errorType: error.type,
      });
      throw new AiGenerationError(`AI generation failed: ${error.type}`);
    }

    // 4. ストリームをラップしてtool_callを処理
    let savedScriptId: string | null = null;

    const wrappedStream = this.wrapStreamWithToolHandling(
      streamResult.value,
      projectId,
      planningId,
      (scriptId) => {
        savedScriptId = scriptId;
      }
    );

    return {
      stream: wrappedStream,
      get scriptId() {
        return savedScriptId;
      },
    };
  }

  /**
   * 台本生成を実行（非ストリーミング）
   */
  async execute(input: GenerateScriptInput): Promise<{
    scriptId: string;
    scenes: ShortsScene[];
    aiResponse: string;
  }> {
    const { projectId, planningId, userMessage, conversationHistory = [] } = input;

    log.info('Starting script generation (non-streaming)', { projectId, planningId });

    // 1. 企画書を取得
    const planning = await this.planningRepository.findById(planningId);
    if (!planning) {
      throw new NotFoundError('Planning', planningId);
    }

    if (planning.projectId !== projectId) {
      throw new ValidationError(`Planning ${planningId} does not belong to project ${projectId}`);
    }

    // 2. メッセージ履歴を構築
    const messages: ChatMessage[] = [...conversationHistory];

    if (messages.length === 0) {
      messages.push({
        role: 'user',
        content: `以下の企画書を元に、ショート動画の台本を作成してください。\n\n## 企画書\n\n${planning.content}`,
      });
    } else if (userMessage) {
      messages.push({
        role: 'user',
        content: userMessage,
      });
    }

    // 3. AI呼び出し
    const result = await this.agenticAiGateway.chat({
      messages,
      tools: [SAVE_SCRIPT_TOOL],
      systemPrompt: this.buildSystemPrompt(),
      temperature: 0.7,
    });

    if (!result.success) {
      throw new AiGenerationError(`AI generation failed: ${result.error.type}`);
    }

    const { content, toolCalls } = result.value;

    // 4. tool_callを処理
    let scriptId: string | null = null;
    let scenes: ShortsScene[] = [];

    for (const toolCall of toolCalls) {
      if (toolCall.name === 'save_script') {
        const saveResult = await this.handleSaveScript(toolCall, projectId, planningId);
        scriptId = saveResult.scriptId;
        scenes = saveResult.scenes;
      }
    }

    if (!scriptId) {
      throw new AiGenerationError('AI did not call save_script tool');
    }

    return {
      scriptId,
      scenes,
      aiResponse: content,
    };
  }

  /**
   * ストリームをラップしてtool_callを処理する
   */
  private async *wrapStreamWithToolHandling(
    stream: AsyncIterable<StreamChunk>,
    projectId: string,
    planningId: string,
    onScriptSaved: (scriptId: string) => void
  ): AsyncIterable<ScriptStreamChunk> {
    for await (const chunk of stream) {
      yield chunk;

      // tool_callチャンクを処理
      if (chunk.type === 'tool_call' && chunk.toolCall) {
        if (chunk.toolCall.name === 'save_script') {
          try {
            const result = await this.handleSaveScript(chunk.toolCall, projectId, planningId);
            onScriptSaved(result.scriptId);

            // 保存結果をUIに送信（企画書と同様のパターン）
            const savedScriptChunk: ScriptStreamChunk = {
              type: 'tool_call',
              toolCall: {
                ...chunk.toolCall,
                arguments: { ...chunk.toolCall.arguments, result: 'saved' },
              },
              savedScript: {
                script: {
                  id: result.scriptId,
                  projectId,
                  planningId,
                  version: 1,
                },
                scenes: result.scenes.map((scene) => ({
                  id: scene.id,
                  scriptId: scene.scriptId,
                  order: scene.order,
                  summary: scene.summary,
                  visualType: scene.visualType,
                  voiceText: scene.voiceText,
                  subtitles: scene.subtitles,
                  silenceDurationMs: scene.silenceDurationMs,
                  stockVideoKey: scene.stockVideoKey,
                  solidColor: scene.solidColor,
                  imagePrompt: scene.imagePrompt,
                  imageStyleHint: scene.imageStyleHint,
                  createdAt: scene.createdAt.toISOString(),
                  updatedAt: scene.updatedAt.toISOString(),
                })),
              },
            };
            yield savedScriptChunk;

            // ツール結果のテキストも返す
            yield {
              type: 'text_delta',
              textDelta: `\n\n[台本を保存しました。${result.scenes.length}シーンを作成しました。]`,
            };
          } catch (error) {
            log.error('Failed to save script', error as Error);
            yield {
              type: 'error',
              error: `台本の保存に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
          }
        }
      }
    }
  }

  /**
   * save_script ツールの処理
   */
  private async handleSaveScript(
    toolCall: ToolCall,
    projectId: string,
    planningId: string
  ): Promise<{ scriptId: string; scenes: ShortsScene[] }> {
    const args = toolCall.arguments as unknown as SaveScriptToolArguments;

    if (!args.scenes || !Array.isArray(args.scenes)) {
      throw new ValidationError('Invalid scenes data from AI');
    }

    log.info('Saving script', { projectId, planningId, sceneCount: args.scenes.length });

    // 1. 既存の台本を削除（再生成の場合）
    const existingScript = await this.scriptRepository.findByProjectId(projectId);
    if (existingScript) {
      await this.sceneRepository.deleteByScriptId(existingScript.id);
      await this.scriptRepository.delete(existingScript.id);
      log.info('Deleted existing script', { scriptId: existingScript.id });
    }

    // 2. 新しい台本を作成
    const scriptResult = ShortsScript.create({ projectId, planningId }, this.generateId);

    if (!scriptResult.success) {
      throw new ValidationError(`Failed to create script: ${scriptResult.error.message}`);
    }

    const script = scriptResult.value;
    await this.scriptRepository.save(script);
    log.info('Script created', { scriptId: script.id });

    // 3. シーンを作成
    const scenes: ShortsScene[] = [];

    for (let i = 0; i < args.scenes.length; i++) {
      const sceneInput = args.scenes[i];
      if (!sceneInput) {
        throw new ValidationError(`Scene at index ${i} is undefined`);
      }

      // AIの出力を正規化: 0やnullは未設定として扱う
      const silenceDurationMs =
        sceneInput.silenceDurationMs && sceneInput.silenceDurationMs > 0
          ? sceneInput.silenceDurationMs
          : null;

      const sceneResult = ShortsScene.create(
        {
          scriptId: script.id,
          order: i,
          summary: sceneInput.summary,
          visualType: sceneInput.visualType,
          voiceText: sceneInput.voiceText ?? null,
          subtitles: sceneInput.subtitles ?? [],
          silenceDurationMs,
          stockVideoKey: sceneInput.stockVideoKey ?? null,
          solidColor: sceneInput.solidColor ?? null,
          imageStyleHint: sceneInput.imageStyleHint ?? null,
        },
        this.generateId
      );

      if (!sceneResult.success) {
        log.warn('Failed to create scene', {
          order: i,
          error: sceneResult.error,
        });
        throw new ValidationError(`Failed to create scene ${i}: ${sceneResult.error.message}`);
      }

      scenes.push(sceneResult.value);
    }

    // 4. シーンを一括保存
    await this.sceneRepository.saveMany(scenes);
    log.info('Scenes created', { count: scenes.length });

    return { scriptId: script.id, scenes };
  }
}
