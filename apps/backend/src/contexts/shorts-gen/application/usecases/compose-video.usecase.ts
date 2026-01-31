import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { TempStorageGateway } from '@shared/domain/gateways/temp-storage.gateway.js';
import { createLogger } from '@shared/infrastructure/logging/logger.js';
import type { AssetRegistryGateway } from '@shorts-gen/domain/gateways/asset-registry.gateway.js';
import type { ShortsComposedVideoRepositoryGateway } from '@shorts-gen/domain/gateways/composed-video-repository.gateway.js';
import type { ShortsProjectRepositoryGateway } from '@shorts-gen/domain/gateways/project-repository.gateway.js';
import type { ShortsSceneAssetRepositoryGateway } from '@shorts-gen/domain/gateways/scene-asset-repository.gateway.js';
import type { ShortsSceneRepositoryGateway } from '@shorts-gen/domain/gateways/scene-repository.gateway.js';
import type {
  ComposeSceneInput,
  SceneVisual,
  SubtitleOverlay,
  VideoComposeGateway,
  VideoComposeGatewayError,
} from '@shorts-gen/domain/gateways/video-compose.gateway.js';
import { ShortsComposedVideo } from '@shorts-gen/domain/models/composed-video.js';
import type { ShortsSceneAsset } from '@shorts-gen/domain/models/scene-asset.js';
import type { ShortsScene } from '@shorts-gen/domain/models/scene.js';

const log = createLogger('ComposeVideoUseCase');

/**
 * Input for ComposeVideoUseCase
 */
export interface ComposeVideoInput {
  /** Project ID */
  projectId: string;
  /** Script ID */
  scriptId: string;
  /** Optional BGM key (from asset registry) */
  bgmKey?: string | null;
}

/**
 * Output for ComposeVideoUseCase
 */
export interface ComposeVideoOutput {
  /** Composed video ID */
  composedVideoId: string;
  /** File URL (GCS URI) */
  fileUrl: string;
  /** Duration in seconds */
  durationSeconds: number;
}

/**
 * Error types for ComposeVideoUseCase
 */
export type ComposeVideoError =
  | { type: 'PROJECT_NOT_FOUND'; projectId: string }
  | { type: 'SCENES_NOT_FOUND'; scriptId: string }
  | { type: 'SCENE_MISSING_VOICE'; sceneId: string; order: number }
  | { type: 'ASSET_NOT_FOUND'; assetType: string; key: string }
  | { type: 'COMPOSE_FAILED'; message: string }
  | { type: 'UPLOAD_FAILED'; message: string }
  | { type: 'INVALID_STATE'; message: string };

/**
 * Dependencies for ComposeVideoUseCase
 */
export interface ComposeVideoUseCaseDeps {
  projectRepository: ShortsProjectRepositoryGateway;
  sceneRepository: ShortsSceneRepositoryGateway;
  sceneAssetRepository: ShortsSceneAssetRepositoryGateway;
  composedVideoRepository: ShortsComposedVideoRepositoryGateway;
  videoComposeGateway: VideoComposeGateway;
  assetRegistryGateway: AssetRegistryGateway;
  tempStorageGateway: TempStorageGateway;
  generateId: () => string;
}

/**
 * Scene data with assets for composition
 */
interface SceneWithAssets {
  scene: ShortsScene;
  voiceAsset: ShortsSceneAsset | null;
  subtitleAssets: ShortsSceneAsset[];
  backgroundImageAsset: ShortsSceneAsset | null;
}

/**
 * ComposeVideoUseCase
 *
 * Composes a final video from scenes, audio, subtitles, and images.
 * - Fetches project for resolution settings
 * - Fetches scenes and their assets (voice, subtitle images, background images)
 * - Handles different visual types: image_gen, stock_video, solid_color
 * - Calls FFmpeg compose gateway to create the video
 * - Uploads result to temporary storage (GCS)
 * - Updates composed video record with result
 */
export class ComposeVideoUseCase {
  private readonly projectRepository: ShortsProjectRepositoryGateway;
  private readonly sceneRepository: ShortsSceneRepositoryGateway;
  private readonly sceneAssetRepository: ShortsSceneAssetRepositoryGateway;
  private readonly composedVideoRepository: ShortsComposedVideoRepositoryGateway;
  private readonly videoComposeGateway: VideoComposeGateway;
  private readonly assetRegistryGateway: AssetRegistryGateway;
  private readonly tempStorageGateway: TempStorageGateway;
  private readonly generateId: () => string;

  constructor(deps: ComposeVideoUseCaseDeps) {
    this.projectRepository = deps.projectRepository;
    this.sceneRepository = deps.sceneRepository;
    this.sceneAssetRepository = deps.sceneAssetRepository;
    this.composedVideoRepository = deps.composedVideoRepository;
    this.videoComposeGateway = deps.videoComposeGateway;
    this.assetRegistryGateway = deps.assetRegistryGateway;
    this.tempStorageGateway = deps.tempStorageGateway;
    this.generateId = deps.generateId;
  }

  /**
   * Execute the compose video use case
   */
  async execute(input: ComposeVideoInput): Promise<ComposeVideoOutput> {
    const { projectId, scriptId, bgmKey } = input;
    log.info('Starting video composition', { projectId, scriptId, bgmKey });

    // 1. Get or create composed video record
    let composedVideo = await this.composedVideoRepository.findByScriptId(scriptId);

    if (!composedVideo) {
      const createResult = ShortsComposedVideo.create(
        { projectId, scriptId, bgmKey },
        this.generateId
      );
      if (!createResult.success) {
        throw this.createError({
          type: 'INVALID_STATE',
          message: `Failed to create composed video: ${createResult.error.message}`,
        });
      }
      composedVideo = createResult.value;
      await this.composedVideoRepository.save(composedVideo);
      log.info('Created new composed video record', { composedVideoId: composedVideo.id });
    } else if (bgmKey !== undefined) {
      // Update BGM key if provided
      composedVideo = composedVideo.withBgmKey(bgmKey);
    }

    // 2. Mark as processing
    const processingResult = composedVideo.startProcessing();
    if (!processingResult.success) {
      throw this.createError({
        type: 'INVALID_STATE',
        message: `Cannot start processing: ${processingResult.error.message}`,
      });
    }
    composedVideo = processingResult.value;
    await this.composedVideoRepository.save(composedVideo);
    log.info('Marked composed video as processing', { composedVideoId: composedVideo.id });

    let tempDir: string | null = null;

    try {
      // 3. Create temp directory for downloads and output
      tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'compose-video-'));

      // 4. Fetch project for dimensions
      const project = await this.projectRepository.findById(projectId);
      if (!project) {
        throw this.createError({ type: 'PROJECT_NOT_FOUND', projectId });
      }
      log.info('Found project', {
        projectId: project.id,
        resolution: `${project.resolutionWidth}x${project.resolutionHeight}`,
      });

      // 4. Fetch scenes by scriptId (ordered)
      const scenes = await this.sceneRepository.findByScriptId(scriptId);
      if (scenes.length === 0) {
        throw this.createError({ type: 'SCENES_NOT_FOUND', scriptId });
      }
      log.info('Found scenes', { count: scenes.length });

      // 5. Fetch assets for all scenes
      const sceneIds = scenes.map((s) => s.id);
      const allAssets = await this.sceneAssetRepository.findBySceneIds(sceneIds);
      log.info('Found assets', { count: allAssets.length });

      // Group assets by scene
      const scenesWithAssets = this.groupAssetsWithScenes(scenes, allAssets);

      // 7. Build ComposeSceneInput for each scene (downloads GCS files to tempDir)
      const composeScenes: ComposeSceneInput[] = [];
      for (const { scene, voiceAsset, subtitleAssets, backgroundImageAsset } of scenesWithAssets) {
        const sceneInput = await this.buildComposeSceneInput(
          scene,
          voiceAsset,
          subtitleAssets,
          backgroundImageAsset,
          tempDir
        );
        composeScenes.push(sceneInput);
      }
      log.info('Built compose scene inputs', { count: composeScenes.length });

      // 8. Resolve BGM path if provided
      let bgmPath: string | null = null;
      const effectiveBgmKey = composedVideo.bgmKey;
      if (effectiveBgmKey) {
        const bgmResult = this.assetRegistryGateway.getBgmAsset(effectiveBgmKey);
        if (!bgmResult.success) {
          throw this.createError({
            type: 'ASSET_NOT_FOUND',
            assetType: 'bgm',
            key: effectiveBgmKey,
          });
        }
        bgmPath = bgmResult.value.absolutePath;
        log.info('Resolved BGM path', { bgmKey: effectiveBgmKey, bgmPath });
      }

      const outputPath = path.join(tempDir, `composed_${composedVideo.id}.mp4`);

      // 9. Call VideoComposeGateway
      log.info('Starting FFmpeg composition...', { outputPath });
      const composeResult = await this.videoComposeGateway.compose({
        outputPath,
        scenes: composeScenes,
        width: project.resolutionWidth,
        height: project.resolutionHeight,
        bgmPath,
      });

      if (!composeResult.success) {
        throw this.createComposeError(composeResult.error);
      }

      const { durationSeconds, fileSizeBytes } = composeResult.value;
      log.info('FFmpeg composition completed', { durationSeconds, fileSizeBytes });

      // 10. Upload to temp storage (GCS)
      log.info('Uploading composed video to storage...');
      const videoBuffer = await fs.promises.readFile(outputPath);
      const uploadResult = await this.tempStorageGateway.upload({
        videoId: `composed-${composedVideo.id}`,
        content: videoBuffer,
      });
      const fileUrl = uploadResult.gcsUri;
      log.info('Uploaded to storage', { fileUrl, expiresAt: uploadResult.expiresAt });

      // 11. Update composed video to completed
      const completeResult = composedVideo.complete(fileUrl, durationSeconds);
      if (!completeResult.success) {
        throw this.createError({
          type: 'INVALID_STATE',
          message: `Failed to complete composed video: ${completeResult.error.message}`,
        });
      }
      composedVideo = completeResult.value;
      await this.composedVideoRepository.save(composedVideo);
      log.info('Composed video marked as completed', { composedVideoId: composedVideo.id });

      return {
        composedVideoId: composedVideo.id,
        fileUrl,
        durationSeconds,
      };
    } catch (error) {
      // Mark as failed
      log.error('Composition failed', error as Error, { projectId, scriptId });

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const failResult = composedVideo.fail(errorMessage);
      if (failResult.success) {
        composedVideo = failResult.value;
        await this.composedVideoRepository.save(composedVideo);
      }

      throw error;
    } finally {
      // Cleanup temp directory
      if (tempDir) {
        await this.cleanupTempDir(tempDir);
      }
    }
  }

  /**
   * Group assets with their corresponding scenes
   */
  private groupAssetsWithScenes(
    scenes: ShortsScene[],
    assets: ShortsSceneAsset[]
  ): SceneWithAssets[] {
    const assetsBySceneId = new Map<string, ShortsSceneAsset[]>();
    for (const asset of assets) {
      const existing = assetsBySceneId.get(asset.sceneId) || [];
      existing.push(asset);
      assetsBySceneId.set(asset.sceneId, existing);
    }

    return scenes.map((scene) => {
      const sceneAssets = assetsBySceneId.get(scene.id) || [];
      return {
        scene,
        voiceAsset: sceneAssets.find((a) => a.isVoice()) || null,
        subtitleAssets: sceneAssets
          .filter((a) => a.isSubtitleImage())
          .sort((a, b) => {
            // Sort by subtitleIndex in metadata
            const indexA = a.metadata?.subtitleIndex ?? 0;
            const indexB = b.metadata?.subtitleIndex ?? 0;
            return indexA - indexB;
          }),
        backgroundImageAsset: sceneAssets.find((a) => a.isBackgroundImage()) || null,
      };
    });
  }

  /**
   * Build ComposeSceneInput from scene and assets
   */
  private async buildComposeSceneInput(
    scene: ShortsScene,
    voiceAsset: ShortsSceneAsset | null,
    subtitleAssets: ShortsSceneAsset[],
    backgroundImageAsset: ShortsSceneAsset | null,
    tempDir: string
  ): Promise<ComposeSceneInput> {
    // Determine scene duration
    let durationMs: number;
    if (voiceAsset?.durationMs) {
      durationMs = voiceAsset.durationMs;
    } else if (scene.silenceDurationMs) {
      durationMs = scene.silenceDurationMs;
    } else {
      // Fallback: use voice asset duration or default
      throw this.createError({
        type: 'SCENE_MISSING_VOICE',
        sceneId: scene.id,
        order: scene.order,
      });
    }

    // Build visual (downloads GCS files if needed)
    const visual = await this.buildSceneVisual(scene, backgroundImageAsset, tempDir);

    // Build subtitle overlays (downloads GCS files if needed)
    const subtitles = await this.buildSubtitleOverlays(subtitleAssets, durationMs, tempDir);

    // Get audio path (download from GCS if needed)
    const audioPath = voiceAsset
      ? await this.resolveAssetPath(voiceAsset.fileUrl, `voice_${scene.id}`, tempDir)
      : null;

    return {
      sceneId: scene.id,
      order: scene.order,
      durationMs,
      visual,
      audioPath,
      subtitles,
    };
  }

  /**
   * Build SceneVisual from scene data
   */
  private async buildSceneVisual(
    scene: ShortsScene,
    backgroundImageAsset: ShortsSceneAsset | null,
    tempDir: string
  ): Promise<SceneVisual> {
    switch (scene.visualType) {
      case 'image_gen': {
        if (!backgroundImageAsset) {
          // Return placeholder solid color if image not generated
          return { type: 'solid_color', color: '#000000' };
        }
        const imagePath = await this.resolveAssetPath(
          backgroundImageAsset.fileUrl,
          `bg_${scene.id}`,
          tempDir
        );
        return {
          type: 'image',
          filePath: imagePath,
        };
      }

      case 'stock_video': {
        if (!scene.stockVideoKey) {
          throw this.createError({
            type: 'ASSET_NOT_FOUND',
            assetType: 'video',
            key: 'missing stock video key',
          });
        }
        const videoResult = this.assetRegistryGateway.getVideoAsset(scene.stockVideoKey);
        if (!videoResult.success) {
          throw this.createError({
            type: 'ASSET_NOT_FOUND',
            assetType: 'video',
            key: scene.stockVideoKey,
          });
        }
        return {
          type: 'video',
          filePath: videoResult.value.absolutePath,
        };
      }

      case 'solid_color': {
        return {
          type: 'solid_color',
          color: scene.solidColor || '#000000',
        };
      }

      default:
        return { type: 'solid_color', color: '#000000' };
    }
  }

  /**
   * Build subtitle overlays with timing
   * Subtitles are distributed evenly across the scene duration
   */
  private async buildSubtitleOverlays(
    subtitleAssets: ShortsSceneAsset[],
    durationMs: number,
    tempDir: string
  ): Promise<SubtitleOverlay[]> {
    if (subtitleAssets.length === 0) {
      return [];
    }

    const subtitleDuration = durationMs / subtitleAssets.length;
    const overlays: SubtitleOverlay[] = [];

    for (let index = 0; index < subtitleAssets.length; index++) {
      const asset = subtitleAssets[index];
      if (!asset) continue;
      const imagePath = await this.resolveAssetPath(
        asset.fileUrl,
        `subtitle_${asset.sceneId}_${index}`,
        tempDir
      );
      overlays.push({
        imagePath,
        startMs: Math.floor(subtitleDuration * index),
        endMs: Math.floor(subtitleDuration * (index + 1)),
      });
    }

    return overlays;
  }

  /**
   * Resolve asset URL to local file path
   * Downloads from GCS if needed, returns local path for local files
   */
  private async resolveAssetPath(url: string, filename: string, tempDir: string): Promise<string> {
    // If it's already a local path, return as-is
    if (url.startsWith('/')) {
      return url;
    }

    // Handle file:// URLs
    if (url.startsWith('file://')) {
      return url.substring(7);
    }

    // Handle local:// URLs (local temp storage)
    if (url.startsWith('local://')) {
      return url.substring(8);
    }

    // For GCS URIs, download to temp directory
    if (url.startsWith('gs://')) {
      const extension = path.extname(url) || this.guessExtension(url);
      const localPath = path.join(tempDir, `${filename}${extension}`);
      log.debug('Downloading asset from GCS', { url, localPath });

      const buffer = await this.tempStorageGateway.download(url);
      await fs.promises.writeFile(localPath, buffer);

      return localPath;
    }

    // For other URLs, return as-is (may fail later)
    return url;
  }

  /**
   * Guess file extension from URL
   */
  private guessExtension(url: string): string {
    if (url.includes('.png')) return '.png';
    if (url.includes('.jpg') || url.includes('.jpeg')) return '.jpg';
    if (url.includes('.mp3')) return '.mp3';
    if (url.includes('.wav')) return '.wav';
    if (url.includes('.mp4')) return '.mp4';
    return '';
  }

  /**
   * Create an error and throw it
   */
  private createError(error: ComposeVideoError): Error {
    const message = this.formatErrorMessage(error);
    const err = new Error(message);
    (err as unknown as { code: string }).code = error.type;
    return err;
  }

  /**
   * Format error message
   */
  private formatErrorMessage(error: ComposeVideoError): string {
    switch (error.type) {
      case 'PROJECT_NOT_FOUND':
        return `Project not found: ${error.projectId}`;
      case 'SCENES_NOT_FOUND':
        return `No scenes found for script: ${error.scriptId}`;
      case 'SCENE_MISSING_VOICE':
        return `Scene ${error.order} (${error.sceneId}) is missing voice asset and has no silence duration`;
      case 'ASSET_NOT_FOUND':
        return `Asset not found: ${error.assetType}/${error.key}`;
      case 'COMPOSE_FAILED':
        return `Video composition failed: ${error.message}`;
      case 'UPLOAD_FAILED':
        return `Failed to upload composed video: ${error.message}`;
      case 'INVALID_STATE':
        return error.message;
    }
  }

  /**
   * Create error from VideoComposeGatewayError
   */
  private createComposeError(gatewayError: VideoComposeGatewayError): Error {
    let message: string;
    switch (gatewayError.type) {
      case 'INVALID_SCENES':
      case 'INVALID_DIMENSIONS':
        message = gatewayError.message;
        break;
      case 'FILE_NOT_FOUND':
        message = `File not found: ${gatewayError.path}`;
        break;
      case 'FFMPEG_ERROR':
        message = gatewayError.stderr
          ? `FFmpeg error: ${gatewayError.message}\n${gatewayError.stderr}`
          : `FFmpeg error: ${gatewayError.message}`;
        break;
      case 'OUTPUT_WRITE_ERROR':
        message = `Failed to write output: ${gatewayError.path} - ${gatewayError.message}`;
        break;
      case 'COMPOSE_FAILED':
        message = gatewayError.message;
        break;
    }
    return this.createError({ type: 'COMPOSE_FAILED', message });
  }

  /**
   * Cleanup temp directory
   */
  private async cleanupTempDir(dirPath: string): Promise<void> {
    try {
      const files = await fs.promises.readdir(dirPath);
      await Promise.all(files.map((file) => fs.promises.unlink(path.join(dirPath, file))));
      await fs.promises.rmdir(dirPath);
      log.debug('Temp directory cleaned up', { dirPath });
    } catch {
      log.debug('Failed to cleanup temp directory (non-critical)', { dirPath });
    }
  }
}
