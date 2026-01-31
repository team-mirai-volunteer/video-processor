import { createLogger } from '@shared/infrastructure/logging/logger.js';
import type { ShortsPlanningRepositoryGateway } from '@shorts-gen/domain/gateways/planning-repository.gateway.js';
import type { ShortsSceneRepositoryGateway } from '@shorts-gen/domain/gateways/scene-repository.gateway.js';
import type { ShortsScriptRepositoryGateway } from '@shorts-gen/domain/gateways/script-repository.gateway.js';
import { ShortsScript } from '@shorts-gen/domain/models/script.js';
import { NotFoundError, ValidationError } from '../errors/errors.js';

const log = createLogger('CreateManualScriptUseCase');

/**
 * CreateManualScriptUseCase 入力パラメータ
 */
export interface CreateManualScriptInput {
  projectId: string;
  planningId: string;
}

/**
 * CreateManualScriptUseCase 出力
 */
export interface CreateManualScriptOutput {
  scriptId: string;
  projectId: string;
  planningId: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CreateManualScriptUseCase 依存関係
 */
export interface CreateManualScriptUseCaseDeps {
  planningRepository: ShortsPlanningRepositoryGateway;
  scriptRepository: ShortsScriptRepositoryGateway;
  sceneRepository: ShortsSceneRepositoryGateway;
  generateId: () => string;
}

/**
 * 手動台本作成UseCase
 * 空のシーン配列を持つ台本を作成する
 */
export class CreateManualScriptUseCase {
  private readonly planningRepository: ShortsPlanningRepositoryGateway;
  private readonly scriptRepository: ShortsScriptRepositoryGateway;
  private readonly sceneRepository: ShortsSceneRepositoryGateway;
  private readonly generateId: () => string;

  constructor(deps: CreateManualScriptUseCaseDeps) {
    this.planningRepository = deps.planningRepository;
    this.scriptRepository = deps.scriptRepository;
    this.sceneRepository = deps.sceneRepository;
    this.generateId = deps.generateId;
  }

  /**
   * 空の台本を作成
   */
  async execute(input: CreateManualScriptInput): Promise<CreateManualScriptOutput> {
    const { projectId, planningId } = input;

    log.info('Creating manual script', { projectId, planningId });

    // 1. 企画書の存在確認
    const planning = await this.planningRepository.findById(planningId);
    if (!planning) {
      throw new NotFoundError('Planning', planningId);
    }

    if (planning.projectId !== projectId) {
      throw new ValidationError(`Planning ${planningId} does not belong to project ${projectId}`);
    }

    // 2. 既存の台本を削除（再作成の場合）
    const existingScript = await this.scriptRepository.findByProjectId(projectId);
    if (existingScript) {
      await this.sceneRepository.deleteByScriptId(existingScript.id);
      await this.scriptRepository.delete(existingScript.id);
      log.info('Deleted existing script', { scriptId: existingScript.id });
    }

    // 3. 新しい台本を作成
    const scriptResult = ShortsScript.create({ projectId, planningId }, this.generateId);

    if (!scriptResult.success) {
      throw new ValidationError(`Failed to create script: ${scriptResult.error.message}`);
    }

    const script = scriptResult.value;
    await this.scriptRepository.save(script);

    log.info('Manual script created', { scriptId: script.id, projectId, planningId });

    return {
      scriptId: script.id,
      projectId: script.projectId,
      planningId: script.planningId,
      version: script.version,
      createdAt: script.createdAt,
      updatedAt: script.updatedAt,
    };
  }
}
