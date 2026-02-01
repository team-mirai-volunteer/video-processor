import { createLogger } from '@shared/infrastructure/logging/logger.js';
import type { AgenticAiGateway } from '@shorts-gen/domain/gateways/agentic-ai.gateway.js';
import type { ShortsSceneRepositoryGateway } from '@shorts-gen/domain/gateways/scene-repository.gateway.js';
import type { ShortsScriptRepositoryGateway } from '@shorts-gen/domain/gateways/script-repository.gateway.js';
import type { ShortsScene } from '@shorts-gen/domain/models/scene.js';
import { AiGenerationError, NotFoundError, ValidationError } from '../errors/errors.js';

const log = createLogger('GenerateImagePromptsUseCase');

/**
 * 画像プロンプト生成UseCase入力
 */
export interface GenerateImagePromptsInput {
  /** 台本ID */
  scriptId: string;
  /** スタイル指定文章（オプション） */
  styleHint?: string;
  /** 特定のシーンIDのみ処理する場合（オプション、再生成用） */
  sceneIds?: string[];
}

/**
 * 画像プロンプト生成UseCase出力（1シーン分）
 */
interface GeneratedImagePrompt {
  /** シーンID */
  sceneId: string;
  /** シーン順序 */
  order: number;
  /** 生成された画像プロンプト */
  imagePrompt: string;
  /** 適用されたスタイルヒント */
  styleHint: string | null;
}

/**
 * 画像プロンプト生成UseCase出力
 */
export interface GenerateImagePromptsOutput {
  /** 台本ID */
  scriptId: string;
  /** 生成された画像プロンプト一覧 */
  generatedPrompts: GeneratedImagePrompt[];
  /** 処理されたシーン数 */
  totalProcessed: number;
  /** スキップされたシーン数（visualTypeがimage_gen以外） */
  totalSkipped: number;
}

/**
 * 画像プロンプト生成UseCase依存関係
 */
export interface GenerateImagePromptsUseCaseDeps {
  /** シーンリポジトリ */
  sceneRepository: ShortsSceneRepositoryGateway;
  /** 台本リポジトリ */
  scriptRepository: ShortsScriptRepositoryGateway;
  /** AgenticAIゲートウェイ */
  agenticAiGateway: AgenticAiGateway;
}

/**
 * AIからのレスポンス形式
 */
interface ImagePromptResponse {
  sceneId: string;
  imagePrompt: string;
}

/**
 * 画像プロンプト生成UseCase
 *
 * 台本のシーン配列から、visualType === 'image_gen' のシーンに対して
 * AIを使用して画像生成用のプロンプトを作成する。
 *
 * @example
 * ```typescript
 * const usecase = new GenerateImagePromptsUseCase({
 *   sceneRepository,
 *   scriptRepository,
 *   agenticAiGateway,
 * });
 *
 * const result = await usecase.execute({
 *   scriptId: 'script-123',
 *   styleHint: 'アニメ風の猫キャラクターを使用',
 * });
 * ```
 */
export class GenerateImagePromptsUseCase {
  private readonly sceneRepository: ShortsSceneRepositoryGateway;
  private readonly scriptRepository: ShortsScriptRepositoryGateway;
  private readonly agenticAiGateway: AgenticAiGateway;

  constructor(deps: GenerateImagePromptsUseCaseDeps) {
    this.sceneRepository = deps.sceneRepository;
    this.scriptRepository = deps.scriptRepository;
    this.agenticAiGateway = deps.agenticAiGateway;
  }

  /**
   * 画像プロンプトを生成する
   */
  async execute(input: GenerateImagePromptsInput): Promise<GenerateImagePromptsOutput> {
    const { scriptId, styleHint, sceneIds } = input;

    log.info('Starting image prompt generation', {
      scriptId,
      hasStyleHint: !!styleHint,
      specificSceneIds: sceneIds?.length ?? 0,
    });

    // 1. 台本の存在確認
    const script = await this.scriptRepository.findById(scriptId);
    if (!script) {
      throw new NotFoundError('Script', scriptId);
    }

    // 2. シーン一覧を取得
    let scenes = await this.sceneRepository.findByScriptId(scriptId);
    if (scenes.length === 0) {
      throw new ValidationError(`No scenes found for script ${scriptId}`);
    }

    // 3. 特定のシーンIDが指定されている場合はフィルタリング
    if (sceneIds && sceneIds.length > 0) {
      const sceneIdSet = new Set(sceneIds);
      scenes = scenes.filter((scene) => sceneIdSet.has(scene.id));

      if (scenes.length === 0) {
        throw new ValidationError('No matching scenes found for the specified scene IDs');
      }
    }

    // 4. visualType === 'image_gen' のシーンのみをフィルタリング
    const imageGenScenes = scenes.filter((scene) => scene.visualType === 'image_gen');
    const skippedCount = scenes.length - imageGenScenes.length;

    log.info('Filtered scenes for image generation', {
      totalScenes: scenes.length,
      imageGenScenes: imageGenScenes.length,
      skippedScenes: skippedCount,
    });

    if (imageGenScenes.length === 0) {
      log.info('No image_gen scenes to process');
      return {
        scriptId,
        generatedPrompts: [],
        totalProcessed: 0,
        totalSkipped: skippedCount,
      };
    }

    // 5. AIを使用して画像プロンプトを生成
    const generatedPrompts = await this.generatePromptsWithAi(imageGenScenes, styleHint);

    // 6. シーンを更新して保存
    const updatedScenes = await this.updateAndSaveScenes(
      imageGenScenes,
      generatedPrompts,
      styleHint
    );

    log.info('Image prompt generation completed', {
      scriptId,
      generatedCount: updatedScenes.length,
      skippedCount,
    });

    return {
      scriptId,
      generatedPrompts: updatedScenes.map((scene) => ({
        sceneId: scene.id,
        order: scene.order,
        imagePrompt: scene.imagePrompt ?? '',
        styleHint: scene.imageStyleHint,
      })),
      totalProcessed: updatedScenes.length,
      totalSkipped: skippedCount,
    };
  }

  /**
   * AIを使用して画像プロンプトを生成する
   */
  private async generatePromptsWithAi(
    scenes: ShortsScene[],
    styleHint?: string
  ): Promise<Map<string, string>> {
    const systemPrompt = this.buildSystemPrompt(styleHint);
    const userPrompt = this.buildUserPrompt(scenes);

    log.debug('Calling AI for image prompt generation', {
      sceneCount: scenes.length,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
    });

    const result = await this.agenticAiGateway.chat({
      messages: [{ role: 'user', content: userPrompt }],
      systemPrompt,
      temperature: 0.7,
      maxTokens: 4000,
    });

    if (!result.success) {
      const errorMessage = this.formatAiError(result.error);
      log.error('AI generation failed', new Error(errorMessage));
      throw new AiGenerationError('Failed to generate image prompts', errorMessage);
    }

    // AIレスポンスをパース
    const prompts = this.parseAiResponse(result.value.content, scenes);

    log.info('AI response parsed successfully', {
      promptCount: prompts.size,
    });

    return prompts;
  }

  /**
   * システムプロンプトを構築する
   */
  private buildSystemPrompt(styleHint?: string): string {
    let prompt = `あなたは動画制作のための画像生成プロンプトを作成する専門家です。

## 役割
ショート動画の各シーンに対して、画像生成AI（Stable Diffusion、DALL-E等）で使用する高品質なプロンプトを作成します。

## 最重要ルール：視覚的一貫性
**動画全体で視覚的な一貫性を保つことが最も重要です。**

1. **キャラクター設定の統一**: 最初のシーン（シーン1）で、メインキャラクターの外見を詳細に定義してください。
   - 例: "a cute orange tabby cat with big green eyes, wearing a small red bow tie"
   - この**完全に同一のキャラクター描写**を、以降の全シーンのプロンプトに必ず含めてください

2. **アートスタイルの統一**: 全シーンで同じアートスタイルを使用してください。
   - 例: "2D anime style, soft pastel colors, clean line art"
   - このスタイル指定を全プロンプトの末尾に必ず追加してください

3. **背景・世界観の統一**: 背景や環境も一貫した世界観を維持してください。
   - 同じ場所が複数シーンに登場する場合、同じ描写を使用してください

4. **感情・状態の変化はポーズと表情で表現**: キャラクターの感情変化（困った→幸せ など）は、
   - キャラクターの基本デザインは変えずに
   - 表情（sad expression → happy smile）やポーズ（slumped shoulders → jumping with joy）で表現してください

## その他のルール
1. 各シーンの概要（summary）と字幕内容を理解し、視覚的に適切な画像を生成できるプロンプトを作成してください
2. プロンプトは英語で作成してください（画像生成AIは英語の方が精度が高いため）
3. 具体的で詳細な描写を含めてください（構図、色彩、雰囲気、照明など）
4. 縦長動画（9:16）に適した構図を意識してください
5. テキストや文字は含めないでください（字幕は別途オーバーレイします）

## プロンプト構造の推奨フォーマット
各プロンプトは以下の構造で作成すると一貫性が保ちやすくなります：
\`[キャラクター描写], [ポーズ・表情・アクション], [背景・環境], [構図・カメラアングル], [アートスタイル・品質タグ]\`

## 出力形式
以下のJSON形式で出力してください。必ず有効なJSONとして出力し、それ以外のテキストは含めないでください。

\`\`\`json
[
  {
    "sceneId": "シーンID",
    "imagePrompt": "生成した画像プロンプト（英語）"
  }
]
\`\`\``;

    if (styleHint) {
      prompt += `

## スタイル指定
以下のスタイル指定を全てのプロンプトに反映してください。キャラクター設定が含まれている場合は、その設定を全シーンで厳密に維持してください：
${styleHint}`;
    }

    return prompt;
  }

  /**
   * ユーザープロンプトを構築する
   */
  private buildUserPrompt(scenes: ShortsScene[]): string {
    const sceneDescriptions = scenes
      .map((scene) => {
        const subtitlesText =
          scene.subtitles.length > 0 ? `字幕: ${scene.subtitles.join(' / ')}` : '字幕: なし';

        return `- シーンID: ${scene.id}
  順序: ${scene.order + 1}
  概要: ${scene.summary}
  ${subtitlesText}
  音声テキスト: ${scene.voiceText ?? 'なし'}`;
      })
      .join('\n\n');

    return `以下のシーンに対して画像生成プロンプトを作成してください：

${sceneDescriptions}`;
  }

  /**
   * AIレスポンスをパースする
   */
  private parseAiResponse(content: string, scenes: ShortsScene[]): Map<string, string> {
    const result = new Map<string, string>();
    const validSceneIds = new Set(scenes.map((s) => s.id));

    try {
      // JSONブロックを抽出（```json...```形式に対応）
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch?.[1]) {
        jsonContent = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonContent) as ImagePromptResponse[];

      if (!Array.isArray(parsed)) {
        throw new Error('AI response is not an array');
      }

      for (const item of parsed) {
        if (
          typeof item.sceneId === 'string' &&
          typeof item.imagePrompt === 'string' &&
          validSceneIds.has(item.sceneId)
        ) {
          result.set(item.sceneId, item.imagePrompt.trim());
        }
      }
    } catch (parseError) {
      log.warn('Failed to parse AI response as JSON, attempting fallback parsing', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });

      // フォールバック: シンプルなパターンマッチング
      for (const scene of scenes) {
        const pattern = new RegExp(
          `["']?sceneId["']?\\s*:\\s*["']${scene.id}["'][\\s\\S]*?["']?imagePrompt["']?\\s*:\\s*["']([^"']+)["']`,
          'i'
        );
        const match = content.match(pattern);
        if (match?.[1]) {
          result.set(scene.id, match[1].trim());
        }
      }
    }

    // 一部のシーンでプロンプトが生成されなかった場合は警告
    const missingScenes = scenes.filter((s) => !result.has(s.id));
    if (missingScenes.length > 0) {
      log.warn('Some scenes did not receive image prompts', {
        missingSceneIds: missingScenes.map((s) => s.id),
      });
    }

    return result;
  }

  /**
   * シーンを更新して保存する
   */
  private async updateAndSaveScenes(
    scenes: ShortsScene[],
    prompts: Map<string, string>,
    styleHint?: string
  ): Promise<ShortsScene[]> {
    const updatedScenes: ShortsScene[] = [];

    for (const scene of scenes) {
      const imagePrompt = prompts.get(scene.id);
      if (imagePrompt) {
        let updatedScene = scene.withImagePrompt(imagePrompt);
        if (styleHint) {
          updatedScene = updatedScene.withImageStyleHint(styleHint);
        }
        updatedScenes.push(updatedScene);
      }
    }

    if (updatedScenes.length > 0) {
      await this.sceneRepository.saveMany(updatedScenes);
      log.info('Scenes updated with image prompts', {
        updatedCount: updatedScenes.length,
      });
    }

    return updatedScenes;
  }

  /**
   * AIエラーをフォーマットする
   */
  private formatAiError(error: { type: string; message?: string }): string {
    switch (error.type) {
      case 'RATE_LIMIT_EXCEEDED':
        return 'AI rate limit exceeded. Please try again later.';
      case 'CONTEXT_LENGTH_EXCEEDED':
        return 'Input too long for AI model. Try reducing the number of scenes.';
      case 'CONTENT_POLICY_VIOLATION':
        return 'Content was flagged by AI content policy.';
      case 'API_ERROR':
        return `AI API error: ${error.message ?? 'Unknown error'}`;
      default:
        return error.message ?? 'AI generation failed';
    }
  }
}
