import { createLogger } from '@shared/infrastructure/logging/logger.js';
import type { AgenticAiGateway } from '@shorts-gen/domain/gateways/agentic-ai.gateway.js';
import type { ShortsPlanningRepositoryGateway } from '@shorts-gen/domain/gateways/planning-repository.gateway.js';
import type { ShortsPublishTextRepositoryGateway } from '@shorts-gen/domain/gateways/publish-text-repository.gateway.js';
import type { ShortsSceneRepositoryGateway } from '@shorts-gen/domain/gateways/scene-repository.gateway.js';
import type { ShortsScriptRepositoryGateway } from '@shorts-gen/domain/gateways/script-repository.gateway.js';
import { ShortsPublishText } from '@shorts-gen/domain/models/publish-text.js';
import { AiGenerationError, NotFoundError, ValidationError } from '../errors/errors.js';

const log = createLogger('GeneratePublishTextUseCase');

export interface GeneratePublishTextUseCaseDeps {
  agenticAiGateway: AgenticAiGateway;
  planningRepository: ShortsPlanningRepositoryGateway;
  scriptRepository: ShortsScriptRepositoryGateway;
  sceneRepository: ShortsSceneRepositoryGateway;
  publishTextRepository: ShortsPublishTextRepositoryGateway;
  generateId: () => string;
}

export interface GeneratePublishTextInput {
  projectId: string;
}

export interface GeneratePublishTextResult {
  publishTextId: string;
  title: string;
  description: string;
}

const SYSTEM_PROMPT = `あなたはショート動画のタイトルとディスクリプションを作成する専門家です。
与えられた企画書と台本の内容を元に、視聴者の興味を引く魅力的なタイトルとディスクリプションを作成してください。

以下のルールに従ってください:
- タイトルは30文字以内で、動画の内容を端的に表現する
- タイトルには視聴者の興味を引くキャッチーなフレーズを含める
- ディスクリプションは200文字以内で、動画の概要と見どころを説明する
- ディスクリプションにはハッシュタグを3-5個含める
- 言語は日本語で出力する

出力形式:
必ず以下のJSON形式で出力してください。他の形式は受け付けません。
{"title": "タイトル", "description": "ディスクリプション"}`;

/**
 * GeneratePublishTextUseCase
 * 企画書と台本の内容を元に、公開用のタイトルとディスクリプションを生成するUseCase
 */
export class GeneratePublishTextUseCase {
  private readonly agenticAiGateway: AgenticAiGateway;
  private readonly planningRepository: ShortsPlanningRepositoryGateway;
  private readonly scriptRepository: ShortsScriptRepositoryGateway;
  private readonly sceneRepository: ShortsSceneRepositoryGateway;
  private readonly publishTextRepository: ShortsPublishTextRepositoryGateway;
  private readonly generateId: () => string;

  constructor(deps: GeneratePublishTextUseCaseDeps) {
    this.agenticAiGateway = deps.agenticAiGateway;
    this.planningRepository = deps.planningRepository;
    this.scriptRepository = deps.scriptRepository;
    this.sceneRepository = deps.sceneRepository;
    this.publishTextRepository = deps.publishTextRepository;
    this.generateId = deps.generateId;
  }

  async execute(input: GeneratePublishTextInput): Promise<GeneratePublishTextResult> {
    log.info('Starting execution', { projectId: input.projectId });

    // Get planning
    const planning = await this.planningRepository.findByProjectId(input.projectId);
    if (!planning) {
      throw new NotFoundError('Planning', input.projectId);
    }
    log.info('Found planning', { planningId: planning.id });

    // Get script
    const script = await this.scriptRepository.findByProjectId(input.projectId);
    if (!script) {
      throw new NotFoundError('Script', input.projectId);
    }
    log.info('Found script', { scriptId: script.id });

    // Get scenes
    const scenes = await this.sceneRepository.findByScriptId(script.id);
    if (scenes.length === 0) {
      throw new ValidationError('Script has no scenes');
    }
    log.info('Found scenes', { sceneCount: scenes.length });

    // Build context for AI
    const sceneSummaries = scenes
      .sort((a, b) => a.order - b.order)
      .map((scene, idx) => `シーン${idx + 1}: ${scene.summary}`)
      .join('\n');

    const userPrompt = `以下の企画書と台本を元に、ショート動画のタイトルとディスクリプションを生成してください。

## 企画書
${planning.content}

## 台本（シーン構成）
${sceneSummaries}

上記の内容を踏まえて、視聴者の興味を引く魅力的なタイトルとディスクリプションをJSON形式で出力してください。`;

    // Generate publish text using AI
    log.info('Generating publish text with AI');
    const chatResult = await this.agenticAiGateway.chat({
      systemPrompt: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.7,
      maxTokens: 1000,
    });

    if (!chatResult.success) {
      const error = chatResult.error;
      const errorMessage = 'message' in error ? error.message : error.type;
      log.error('AI generation failed', new Error(errorMessage), {
        errorType: error.type,
      });
      throw new AiGenerationError(`Failed to generate publish text: ${error.type}`, error);
    }

    // Parse AI response
    const aiContent = chatResult.value.content;
    log.debug('AI response received', { content: aiContent });

    let parsedResponse: { title: string; description: string };
    try {
      // Extract JSON from response (AI might include extra text)
      const jsonMatch = aiContent.match(/\{[\s\S]*"title"[\s\S]*"description"[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in AI response');
      }
      parsedResponse = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      log.error('Failed to parse AI response', parseError as Error, { content: aiContent });
      throw new AiGenerationError('Failed to parse AI response as JSON', parseError);
    }

    if (!parsedResponse.title || !parsedResponse.description) {
      throw new AiGenerationError('AI response missing title or description');
    }

    // Create PublishText
    const createResult = ShortsPublishText.create(
      {
        projectId: input.projectId,
        title: parsedResponse.title,
        description: parsedResponse.description,
      },
      this.generateId
    );

    if (!createResult.success) {
      const error = createResult.error;
      log.error('Failed to create PublishText', new Error(error.message), {
        errorType: error.type,
      });
      throw new ValidationError(error.message);
    }

    const publishText = createResult.value;

    // Save to repository
    await this.publishTextRepository.save(publishText);
    log.info('PublishText saved', { publishTextId: publishText.id });

    return {
      publishTextId: publishText.id,
      title: publishText.title,
      description: publishText.description,
    };
  }
}
