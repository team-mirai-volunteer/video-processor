import type { LocalFileGateway } from '@shared/domain/gateways/local-file.gateway.js';
import type { TempStorageGateway } from '@shared/domain/gateways/temp-storage.gateway.js';
import { ok } from '@shared/domain/types/result.js';
import {
  ComposeVideoUseCase,
  type ComposeVideoUseCaseDeps,
} from '@shorts-gen/application/usecases/compose-video.usecase.js';
import type {
  AssetRegistryGateway,
  BgmAssetInfo,
  VideoAssetInfo,
} from '@shorts-gen/domain/gateways/asset-registry.gateway.js';
import type { ShortsComposedVideoRepositoryGateway } from '@shorts-gen/domain/gateways/composed-video-repository.gateway.js';
import type { ShortsProjectRepositoryGateway } from '@shorts-gen/domain/gateways/project-repository.gateway.js';
import type { ShortsSceneAssetRepositoryGateway } from '@shorts-gen/domain/gateways/scene-asset-repository.gateway.js';
import type { ShortsSceneRepositoryGateway } from '@shorts-gen/domain/gateways/scene-repository.gateway.js';
import type { VideoComposeGateway } from '@shorts-gen/domain/gateways/video-compose.gateway.js';
import { ShortsComposedVideo } from '@shorts-gen/domain/models/composed-video.js';
import { ShortsProject } from '@shorts-gen/domain/models/project.js';
import { ShortsSceneAsset } from '@shorts-gen/domain/models/scene-asset.js';
import { ShortsScene } from '@shorts-gen/domain/models/scene.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ComposeVideoUseCase', () => {
  let useCase: ComposeVideoUseCase;
  let projectRepository: ShortsProjectRepositoryGateway;
  let sceneRepository: ShortsSceneRepositoryGateway;
  let sceneAssetRepository: ShortsSceneAssetRepositoryGateway;
  let composedVideoRepository: ShortsComposedVideoRepositoryGateway;
  let videoComposeGateway: VideoComposeGateway;
  let assetRegistryGateway: AssetRegistryGateway;
  let tempStorageGateway: TempStorageGateway;
  let localFileGateway: LocalFileGateway;
  let idCounter: number;

  // Test data
  const testProjectId = 'project-1';
  const testScriptId = 'script-1';
  const testProject = ShortsProject.fromProps({
    id: testProjectId,
    title: 'Test Project',
    aspectRatio: '9:16',
    resolutionWidth: 1080,
    resolutionHeight: 1920,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const createTestScene = (
    order: number,
    visualType: 'image_gen' | 'stock_video' | 'solid_color'
  ) =>
    ShortsScene.fromProps({
      id: `scene-${order}`,
      scriptId: testScriptId,
      order,
      summary: `Scene ${order} summary`,
      visualType,
      voiceText: `Voice text for scene ${order}`,
      subtitles: [`Subtitle 1 for scene ${order}`, `Subtitle 2 for scene ${order}`],
      silenceDurationMs: null,
      stockVideoKey: visualType === 'stock_video' ? 'intro-video' : null,
      solidColor: visualType === 'solid_color' ? '#FF0000' : null,
      imagePrompt: visualType === 'image_gen' ? 'A beautiful scene' : null,
      imageStyleHint: null,
      voiceKey: null,
      voiceSpeed: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

  const createVoiceAsset = (sceneId: string) =>
    ShortsSceneAsset.fromProps({
      id: `voice-${sceneId}`,
      sceneId,
      assetType: 'voice',
      fileUrl: `file:///tmp/voice-${sceneId}.mp3`,
      durationMs: 3000,
      metadata: null,
      createdAt: new Date(),
    });

  const createSubtitleAsset = (sceneId: string, index: number) =>
    ShortsSceneAsset.fromProps({
      id: `subtitle-${sceneId}-${index}`,
      sceneId,
      assetType: 'subtitle_image',
      fileUrl: `file:///tmp/subtitle-${sceneId}-${index}.png`,
      durationMs: null,
      metadata: { subtitleIndex: index },
      createdAt: new Date(),
    });

  const createBackgroundImageAsset = (sceneId: string) =>
    ShortsSceneAsset.fromProps({
      id: `bg-${sceneId}`,
      sceneId,
      assetType: 'background_image',
      fileUrl: `file:///tmp/bg-${sceneId}.png`,
      durationMs: null,
      metadata: null,
      createdAt: new Date(),
    });

  beforeEach(() => {
    idCounter = 0;

    projectRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(testProject),
      findMany: vi.fn().mockResolvedValue({ projects: [], total: 0 }),
      delete: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(true),
    };

    sceneRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      saveMany: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByScriptId: vi
        .fn()
        .mockResolvedValue([createTestScene(0, 'image_gen'), createTestScene(1, 'solid_color')]),
      findByScriptIdAndOrder: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByScriptId: vi.fn().mockResolvedValue(undefined),
      countByScriptId: vi.fn().mockResolvedValue(2),
    };

    sceneAssetRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      saveMany: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findBySceneId: vi.fn().mockResolvedValue([]),
      findBySceneIdAndType: vi.fn().mockResolvedValue([]),
      findBySceneIds: vi.fn().mockImplementation((sceneIds: string[]) => {
        const assets: ShortsSceneAsset[] = [];
        for (const sceneId of sceneIds) {
          assets.push(createVoiceAsset(sceneId));
          assets.push(createSubtitleAsset(sceneId, 0));
          assets.push(createSubtitleAsset(sceneId, 1));
          if (sceneId === 'scene-0') {
            assets.push(createBackgroundImageAsset(sceneId));
          }
        }
        return Promise.resolve(assets);
      }),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteBySceneId: vi.fn().mockResolvedValue(undefined),
      deleteBySceneIdAndType: vi.fn().mockResolvedValue(undefined),
    };

    composedVideoRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      updateProgress: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByProjectId: vi.fn().mockResolvedValue(null),
      findByScriptId: vi.fn().mockResolvedValue(null),
      findByStatus: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByProjectId: vi.fn().mockResolvedValue(undefined),
    };

    videoComposeGateway = {
      compose: vi.fn().mockResolvedValue(
        ok({
          outputPath: '/tmp/output.mp4',
          durationSeconds: 6,
          fileSizeBytes: 1024000,
        })
      ),
      isAvailable: vi.fn().mockResolvedValue(true),
      getSupportedCodecs: vi.fn().mockResolvedValue(['h264', 'aac']),
    };

    assetRegistryGateway = {
      getVideoAsset: vi.fn().mockReturnValue(
        ok({
          key: 'intro-video',
          absolutePath: '/assets/videos/intro.mp4',
          description: 'Intro video',
          durationMs: 5000,
        } as VideoAssetInfo)
      ),
      getBgmAsset: vi.fn().mockReturnValue(
        ok({
          key: 'background-music',
          absolutePath: '/assets/bgm/background.mp3',
          description: 'Background music',
        } as BgmAssetInfo)
      ),
      getVoiceAsset: vi.fn().mockReturnValue(
        ok({
          key: 'default',
          modelId: 'test-voice-model-id',
          name: 'デフォルト',
          description: '標準的な声',
        })
      ),
      listVideoAssetKeys: vi.fn().mockReturnValue(['intro-video']),
      listBgmAssetKeys: vi.fn().mockReturnValue(['background-music']),
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

    tempStorageGateway = {
      upload: vi.fn().mockResolvedValue({
        gcsUri: 'gs://bucket/composed-video.mp4',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
      uploadFromStream: vi.fn().mockResolvedValue({
        gcsUri: 'gs://bucket/composed-video.mp4',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
      uploadFromStreamWithProgress: vi.fn().mockResolvedValue({
        gcsUri: 'gs://bucket/composed-video.mp4',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
      download: vi.fn().mockResolvedValue(Buffer.from('video')),
      downloadAsStream: vi.fn().mockReturnValue(null as unknown as NodeJS.ReadableStream),
      getFileSize: vi.fn().mockResolvedValue(0),
      exists: vi.fn().mockResolvedValue(true),
      getSignedUrl: vi.fn().mockResolvedValue('https://storage.googleapis.com/signed-url'),
    };

    localFileGateway = {
      createTempDir: vi.fn().mockResolvedValue('/tmp/compose-video-mock'),
      readFile: vi.fn().mockResolvedValue(Buffer.from('mock video content')),
      writeFile: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockResolvedValue(undefined),
      join: vi.fn().mockImplementation((...paths: string[]) => paths.join('/')),
      extname: vi.fn().mockImplementation((filePath: string) => {
        const match = filePath.match(/\.[^.]+$/);
        return match ? match[0] : '';
      }),
    };

    const deps: ComposeVideoUseCaseDeps = {
      projectRepository,
      sceneRepository,
      sceneAssetRepository,
      composedVideoRepository,
      videoComposeGateway,
      assetRegistryGateway,
      tempStorageGateway,
      localFileGateway,
      generateId: () => `id-${++idCounter}`,
    };

    useCase = new ComposeVideoUseCase(deps);
  });

  describe('execute', () => {
    it('should compose video successfully with new composed video record', async () => {
      const input = {
        projectId: testProjectId,
        scriptId: testScriptId,
      };

      const result = await useCase.execute(input);

      expect(result.composedVideoId).toBe('id-1');
      expect(result.fileUrl).toBe('gs://bucket/composed-video.mp4');
      expect(result.durationSeconds).toBe(6);

      // Verify composed video was created and saved
      expect(composedVideoRepository.save).toHaveBeenCalled();

      // Verify compose gateway was called with correct params
      expect(videoComposeGateway.compose).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 1080,
          height: 1920,
          scenes: expect.arrayContaining([
            expect.objectContaining({
              sceneId: 'scene-0',
              order: 0,
              durationMs: 3000,
            }),
            expect.objectContaining({
              sceneId: 'scene-1',
              order: 1,
              durationMs: 3000,
            }),
          ]),
        })
      );

      // Verify upload was called
      expect(tempStorageGateway.upload).toHaveBeenCalled();
    });

    it('should reuse existing composed video record in pending state', async () => {
      const existingComposedVideo = ShortsComposedVideo.fromProps({
        id: 'existing-composed-video',
        projectId: testProjectId,
        scriptId: testScriptId,
        fileUrl: null,
        durationSeconds: null,
        status: 'pending',
        progressPhase: null,
        progressPercent: null,
        errorMessage: null,
        bgmKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(composedVideoRepository.findByScriptId).mockResolvedValue(existingComposedVideo);

      const input = {
        projectId: testProjectId,
        scriptId: testScriptId,
      };

      const result = await useCase.execute(input);

      expect(result.composedVideoId).toBe('existing-composed-video');
    });

    it('should handle BGM key correctly', async () => {
      const input = {
        projectId: testProjectId,
        scriptId: testScriptId,
        bgmKey: 'background-music',
      };

      await useCase.execute(input);

      // Verify BGM was resolved
      expect(assetRegistryGateway.getBgmAsset).toHaveBeenCalledWith('background-music');

      // Verify compose was called with BGM path
      expect(videoComposeGateway.compose).toHaveBeenCalledWith(
        expect.objectContaining({
          bgmPath: '/assets/bgm/background.mp3',
        })
      );
    });

    it('should throw error when project not found', async () => {
      vi.mocked(projectRepository.findById).mockResolvedValue(null);

      const input = {
        projectId: 'non-existent-project',
        scriptId: testScriptId,
      };

      await expect(useCase.execute(input)).rejects.toThrow('Project not found');
    });

    it('should throw error when no scenes found', async () => {
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue([]);

      const input = {
        projectId: testProjectId,
        scriptId: testScriptId,
      };

      await expect(useCase.execute(input)).rejects.toThrow('No scenes found');
    });

    it('should throw error when BGM asset not found', async () => {
      vi.mocked(assetRegistryGateway.getBgmAsset).mockReturnValue({
        success: false,
        error: { type: 'ASSET_NOT_FOUND', key: 'invalid-bgm', assetType: 'bgm' as const },
      });

      const input = {
        projectId: testProjectId,
        scriptId: testScriptId,
        bgmKey: 'invalid-bgm',
      };

      await expect(useCase.execute(input)).rejects.toThrow('Asset not found');
    });

    it('should mark composed video as failed when compose fails', async () => {
      vi.mocked(videoComposeGateway.compose).mockResolvedValue({
        success: false,
        error: { type: 'FFMPEG_ERROR', message: 'FFmpeg crashed' },
      });

      const input = {
        projectId: testProjectId,
        scriptId: testScriptId,
      };

      await expect(useCase.execute(input)).rejects.toThrow('Video composition failed');

      // Verify composed video was marked as failed
      const saveCalls = vi.mocked(composedVideoRepository.save).mock.calls;
      expect(saveCalls.length).toBeGreaterThan(0);
      const lastCall = saveCalls[saveCalls.length - 1];
      if (!lastCall) {
        throw new Error('Expected save to be called');
      }
      const lastSavedVideo = lastCall[0];
      expect(lastSavedVideo.status).toBe('failed');
    });

    it('should handle scene with silence duration instead of voice', async () => {
      const silentScene = ShortsScene.fromProps({
        id: 'scene-silent',
        scriptId: testScriptId,
        order: 0,
        summary: 'Silent scene',
        visualType: 'solid_color',
        voiceText: null,
        subtitles: [],
        silenceDurationMs: 2000,
        stockVideoKey: null,
        solidColor: '#000000',
        imagePrompt: null,
        imageStyleHint: null,
        voiceKey: null,
        voiceSpeed: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue([silentScene]);
      vi.mocked(sceneAssetRepository.findBySceneIds).mockResolvedValue([]);

      const input = {
        projectId: testProjectId,
        scriptId: testScriptId,
      };

      const result = await useCase.execute(input);

      expect(result.durationSeconds).toBe(6);

      // Verify compose was called with correct duration
      expect(videoComposeGateway.compose).toHaveBeenCalledWith(
        expect.objectContaining({
          scenes: expect.arrayContaining([
            expect.objectContaining({
              durationMs: 2000,
              audioPath: null,
            }),
          ]),
        })
      );
    });

    it('should handle stock video visual type', async () => {
      const stockVideoScene = createTestScene(0, 'stock_video');
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue([stockVideoScene]);
      vi.mocked(sceneAssetRepository.findBySceneIds).mockResolvedValue([
        createVoiceAsset('scene-0'),
      ]);

      const input = {
        projectId: testProjectId,
        scriptId: testScriptId,
      };

      await useCase.execute(input);

      // Verify asset registry was called for stock video
      expect(assetRegistryGateway.getVideoAsset).toHaveBeenCalledWith('intro-video');

      // Verify compose was called with video visual type
      expect(videoComposeGateway.compose).toHaveBeenCalledWith(
        expect.objectContaining({
          scenes: expect.arrayContaining([
            expect.objectContaining({
              visual: expect.objectContaining({
                type: 'video',
                filePath: '/assets/videos/intro.mp4',
              }),
            }),
          ]),
        })
      );
    });

    it('should distribute subtitle overlays evenly across scene duration', async () => {
      const input = {
        projectId: testProjectId,
        scriptId: testScriptId,
      };

      await useCase.execute(input);

      // Verify compose was called with subtitle overlays
      const composeCalls = vi.mocked(videoComposeGateway.compose).mock.calls;
      expect(composeCalls.length).toBeGreaterThan(0);
      const firstCall = composeCalls[0];
      if (!firstCall) {
        throw new Error('Expected compose to be called');
      }
      const composeCall = firstCall[0];
      const scene0 = composeCall.scenes.find((s) => s.sceneId === 'scene-0');

      expect(scene0?.subtitles).toHaveLength(2);
      // With 3000ms duration and 2 subtitles, each should be 1500ms
      expect(scene0?.subtitles[0]).toEqual(
        expect.objectContaining({
          startMs: 0,
          endMs: 1500,
        })
      );
      expect(scene0?.subtitles[1]).toEqual(
        expect.objectContaining({
          startMs: 1500,
          endMs: 3000,
        })
      );
    });

    it('should handle image_gen scene without background image by using fallback color', async () => {
      const imageGenScene = createTestScene(0, 'image_gen');
      vi.mocked(sceneRepository.findByScriptId).mockResolvedValue([imageGenScene]);
      // Return voice asset but no background image
      vi.mocked(sceneAssetRepository.findBySceneIds).mockResolvedValue([
        createVoiceAsset('scene-0'),
      ]);

      const input = {
        projectId: testProjectId,
        scriptId: testScriptId,
      };

      await useCase.execute(input);

      // Verify compose was called with solid_color fallback
      expect(videoComposeGateway.compose).toHaveBeenCalledWith(
        expect.objectContaining({
          scenes: expect.arrayContaining([
            expect.objectContaining({
              visual: expect.objectContaining({
                type: 'solid_color',
                color: '#000000',
              }),
            }),
          ]),
        })
      );
    });
  });
});
