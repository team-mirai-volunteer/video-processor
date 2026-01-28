import type { AssetStorageGateway } from '../../domain/gateways/asset-storage.gateway.js';
import type { ShortsProjectRepositoryGateway } from '../../domain/gateways/project-repository.gateway.js';
import type { ShortsSceneAssetRepositoryGateway } from '../../domain/gateways/scene-asset-repository.gateway.js';
import type { ShortsSceneRepositoryGateway } from '../../domain/gateways/scene-repository.gateway.js';
import type { ShortsScriptRepositoryGateway } from '../../domain/gateways/script-repository.gateway.js';
import type {
  SubtitleGeneratorGateway,
  SubtitleStyle,
} from '../../domain/gateways/subtitle-generator.gateway.js';
import type { ShortsSceneAsset } from '../../domain/models/scene-asset.js';
import { ShortsSceneAsset as ShortsSceneAssetModel } from '../../domain/models/scene-asset.js';
import type { ShortsScene } from '../../domain/models/scene.js';
import {
  GENERATE_SUBTITLES_ERROR_CODES,
  GenerateSubtitlesError,
} from '../errors/generate-subtitles.errors.js';

/**
 * 字幕生成の入力パラメータ
 */
export interface GenerateSubtitlesInput {
  /** 台本ID */
  scriptId: string;
  /** 字幕のスタイル設定（オプション） */
  subtitleStyle?: SubtitleStyle;
  /** 字幕の垂直位置（0-1、オプション） */
  verticalPosition?: number;
  /** 特定のシーンIDのみ処理する（オプション、指定しない場合は全シーン） */
  sceneIds?: string[];
}

/**
 * シーンごとの字幕生成結果
 */
export interface SceneSubtitleResult {
  /** シーンID */
  sceneId: string;
  /** シーンの順番 */
  order: number;
  /** 生成された字幕画像アセット */
  assets: ShortsSceneAsset[];
}

/**
 * 字幕生成の出力
 */
export interface GenerateSubtitlesOutput {
  /** 台本ID */
  scriptId: string;
  /** プロジェクトID */
  projectId: string;
  /** シーンごとの結果 */
  sceneResults: SceneSubtitleResult[];
  /** 処理されたシーン数 */
  totalScenesProcessed: number;
  /** 生成されたアセット総数 */
  totalAssetsGenerated: number;
}

/**
 * GenerateSubtitlesUseCase の依存関係
 */
export interface GenerateSubtitlesUseCaseDeps {
  scriptRepository: ShortsScriptRepositoryGateway;
  projectRepository: ShortsProjectRepositoryGateway;
  sceneRepository: ShortsSceneRepositoryGateway;
  sceneAssetRepository: ShortsSceneAssetRepositoryGateway;
  subtitleGenerator: SubtitleGeneratorGateway;
  assetStorage: AssetStorageGateway;
  generateId: () => string;
}

/**
 * GenerateSubtitlesUseCase
 *
 * 台本のシーンから字幕画像を生成するユースケース
 *
 * 処理フロー:
 * 1. scriptIdから台本を取得
 * 2. プロジェクト情報から解像度を取得
 * 3. 台本に紐づくシーン一覧を取得
 * 4. 各シーンのsubtitles配列から字幕画像を生成
 * 5. 生成した画像をGCSにアップロード
 * 6. ShortsSceneAssetとして保存
 */
export class GenerateSubtitlesUseCase {
  private readonly scriptRepository: ShortsScriptRepositoryGateway;
  private readonly projectRepository: ShortsProjectRepositoryGateway;
  private readonly sceneRepository: ShortsSceneRepositoryGateway;
  private readonly sceneAssetRepository: ShortsSceneAssetRepositoryGateway;
  private readonly subtitleGenerator: SubtitleGeneratorGateway;
  private readonly assetStorage: AssetStorageGateway;
  private readonly generateId: () => string;

  constructor(deps: GenerateSubtitlesUseCaseDeps) {
    this.scriptRepository = deps.scriptRepository;
    this.projectRepository = deps.projectRepository;
    this.sceneRepository = deps.sceneRepository;
    this.sceneAssetRepository = deps.sceneAssetRepository;
    this.subtitleGenerator = deps.subtitleGenerator;
    this.assetStorage = deps.assetStorage;
    this.generateId = deps.generateId;
  }

  async execute(input: GenerateSubtitlesInput): Promise<GenerateSubtitlesOutput> {
    const { scriptId, subtitleStyle, verticalPosition, sceneIds } = input;

    // 1. 台本を取得
    const script = await this.scriptRepository.findById(scriptId);
    if (!script) {
      throw new GenerateSubtitlesError(
        GENERATE_SUBTITLES_ERROR_CODES.SCRIPT_NOT_FOUND,
        `Script not found: ${scriptId}`
      );
    }

    // 2. プロジェクト情報を取得（解像度のため）
    const project = await this.projectRepository.findById(script.projectId);
    if (!project) {
      throw new GenerateSubtitlesError(
        GENERATE_SUBTITLES_ERROR_CODES.PROJECT_NOT_FOUND,
        `Project not found: ${script.projectId}`
      );
    }

    // 3. シーン一覧を取得
    let scenes = await this.sceneRepository.findByScriptId(scriptId);

    // 特定のシーンIDが指定されている場合はフィルタリング
    if (sceneIds && sceneIds.length > 0) {
      const sceneIdSet = new Set(sceneIds);
      scenes = scenes.filter((scene) => sceneIdSet.has(scene.id));
    }

    if (scenes.length === 0) {
      throw new GenerateSubtitlesError(
        GENERATE_SUBTITLES_ERROR_CODES.NO_SCENES,
        `No scenes found for script: ${scriptId}`
      );
    }

    // 4. 字幕があるシーンをフィルタリング
    const scenesWithSubtitles = scenes.filter(
      (scene) => scene.subtitles && scene.subtitles.length > 0
    );

    if (scenesWithSubtitles.length === 0) {
      throw new GenerateSubtitlesError(
        GENERATE_SUBTITLES_ERROR_CODES.NO_SUBTITLES,
        `No scenes with subtitles found for script: ${scriptId}`
      );
    }

    // 5. 各シーンの字幕画像を生成
    const sceneResults: SceneSubtitleResult[] = [];
    let totalAssetsGenerated = 0;

    for (const scene of scenesWithSubtitles) {
      // 既存の字幕アセットを削除（再生成の場合）
      await this.sceneAssetRepository.deleteBySceneIdAndType(scene.id, 'subtitle_image');

      const assets = await this.generateSubtitlesForScene(
        scene,
        project.resolutionWidth,
        project.resolutionHeight,
        project.id,
        subtitleStyle,
        verticalPosition
      );

      // アセットを保存
      if (assets.length > 0) {
        await this.sceneAssetRepository.saveMany(assets);
      }

      sceneResults.push({
        sceneId: scene.id,
        order: scene.order,
        assets,
      });

      totalAssetsGenerated += assets.length;
    }

    return {
      scriptId,
      projectId: project.id,
      sceneResults,
      totalScenesProcessed: scenesWithSubtitles.length,
      totalAssetsGenerated,
    };
  }

  /**
   * 単一シーンの字幕画像を生成
   */
  private async generateSubtitlesForScene(
    scene: ShortsScene,
    width: number,
    height: number,
    projectId: string,
    style?: SubtitleStyle,
    verticalPosition?: number
  ): Promise<ShortsSceneAsset[]> {
    const assets: ShortsSceneAsset[] = [];

    for (let i = 0; i < scene.subtitles.length; i++) {
      const subtitleText = scene.subtitles[i];
      if (!subtitleText) {
        continue; // Skip empty subtitles
      }

      // 字幕画像を生成
      const result = await this.subtitleGenerator.generate({
        text: subtitleText,
        width,
        height,
        verticalPosition,
        style,
      });

      if (!result.success) {
        const errorMessage =
          'message' in result.error ? result.error.message : `Error type: ${result.error.type}`;
        throw new GenerateSubtitlesError(
          GENERATE_SUBTITLES_ERROR_CODES.GENERATION_FAILED,
          `Failed to generate subtitle for scene ${scene.id}, index ${i}: ${errorMessage}`,
          result.error
        );
      }

      // GCSにアップロード
      const storagePath = `shorts-gen/${projectId}/subtitles/${scene.id}/${i}.png`;
      let uploadResult: { url: string };
      try {
        uploadResult = await this.assetStorage.upload({
          path: storagePath,
          content: result.value.imageBuffer,
          contentType: 'image/png',
        });
      } catch (error) {
        throw new GenerateSubtitlesError(
          GENERATE_SUBTITLES_ERROR_CODES.UPLOAD_FAILED,
          `Failed to upload subtitle image for scene ${scene.id}, index ${i}`,
          error
        );
      }

      // ShortsSceneAssetを作成
      const assetResult = ShortsSceneAssetModel.create(
        {
          sceneId: scene.id,
          assetType: 'subtitle_image',
          fileUrl: uploadResult.url,
          metadata: {
            subtitleIndex: i,
            subtitleText,
            width: result.value.width,
            height: result.value.height,
          },
        },
        this.generateId
      );

      if (!assetResult.success) {
        throw new GenerateSubtitlesError(
          GENERATE_SUBTITLES_ERROR_CODES.ASSET_SAVE_FAILED,
          `Failed to create asset for scene ${scene.id}, index ${i}: ${assetResult.error.message}`,
          assetResult.error
        );
      }

      assets.push(assetResult.value);
    }

    return assets;
  }
}
