import { createLogger } from '@shared/infrastructure/logging/logger.js';
import type { ShortsSceneRepositoryGateway } from '@shorts-gen/domain/gateways/scene-repository.gateway.js';
import type { ShortsScriptRepositoryGateway } from '@shorts-gen/domain/gateways/script-repository.gateway.js';
import { ShortsScene, type VisualType } from '@shorts-gen/domain/models/scene.js';
import { NotFoundError, ValidationError } from '../errors/errors.js';

const log = createLogger('AddSceneUseCase');

/**
 * AddSceneUseCase 入力パラメータ
 */
export interface AddSceneInput {
  scriptId: string;
  summary: string;
  visualType: VisualType;
  voiceText?: string | null;
  subtitles?: string[];
  silenceDurationMs?: number | null;
  stockVideoKey?: string | null;
  solidColor?: string | null;
  imageStyleHint?: string | null;
  order?: number;
}

/**
 * AddSceneUseCase 出力
 */
export interface AddSceneOutput {
  scene: ShortsScene;
}

/**
 * AddSceneUseCase 依存関係
 */
export interface AddSceneUseCaseDeps {
  scriptRepository: ShortsScriptRepositoryGateway;
  sceneRepository: ShortsSceneRepositoryGateway;
  generateId: () => string;
}

/**
 * シーン追加UseCase
 * 台本に新しいシーンを追加する
 */
export class AddSceneUseCase {
  private readonly scriptRepository: ShortsScriptRepositoryGateway;
  private readonly sceneRepository: ShortsSceneRepositoryGateway;
  private readonly generateId: () => string;

  constructor(deps: AddSceneUseCaseDeps) {
    this.scriptRepository = deps.scriptRepository;
    this.sceneRepository = deps.sceneRepository;
    this.generateId = deps.generateId;
  }

  /**
   * シーンを追加
   */
  async execute(input: AddSceneInput): Promise<AddSceneOutput> {
    const { scriptId, order, ...sceneData } = input;

    log.info('Adding scene to script', { scriptId, summary: sceneData.summary });

    // 1. 台本の存在確認
    const script = await this.scriptRepository.findById(scriptId);
    if (!script) {
      throw new NotFoundError('Script', scriptId);
    }

    // 2. orderを決定（指定がなければ既存シーン数をorderとする）
    let sceneOrder = order;
    if (sceneOrder === undefined) {
      const sceneCount = await this.sceneRepository.countByScriptId(scriptId);
      sceneOrder = sceneCount;
    }

    // 3. シーンを作成
    const sceneResult = ShortsScene.create(
      {
        scriptId,
        order: sceneOrder,
        summary: sceneData.summary,
        visualType: sceneData.visualType,
        voiceText: sceneData.voiceText ?? null,
        subtitles: sceneData.subtitles ?? [],
        silenceDurationMs: sceneData.silenceDurationMs ?? null,
        stockVideoKey: sceneData.stockVideoKey ?? null,
        solidColor: sceneData.solidColor ?? null,
        imageStyleHint: sceneData.imageStyleHint ?? null,
      },
      this.generateId
    );

    if (!sceneResult.success) {
      throw new ValidationError(`Failed to create scene: ${sceneResult.error.message}`);
    }

    const scene = sceneResult.value;

    // 4. シーンを保存
    await this.sceneRepository.save(scene);

    log.info('Scene added', { sceneId: scene.id, scriptId, order: sceneOrder });

    return { scene };
  }
}
