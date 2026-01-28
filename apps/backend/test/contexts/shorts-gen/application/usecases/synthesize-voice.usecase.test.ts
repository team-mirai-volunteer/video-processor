import { Readable } from 'node:stream';
import type { TempStorageGateway } from '@shared/domain/gateways/temp-storage.gateway.js';
import {
  SynthesizeVoiceError,
  SynthesizeVoiceUseCase,
  type SynthesizeVoiceUseCaseDeps,
} from '@shorts-gen/application/usecases/synthesize-voice.usecase.js';
import type { ShortsSceneAssetRepositoryGateway } from '@shorts-gen/domain/gateways/scene-asset-repository.gateway.js';
import type { ShortsSceneRepositoryGateway } from '@shorts-gen/domain/gateways/scene-repository.gateway.js';
import type {
  TtsGateway,
  TtsGatewayError,
  TtsSynthesizeResult,
} from '@shorts-gen/domain/gateways/tts.gateway.js';
import { ShortsScene, type ShortsSceneProps } from '@shorts-gen/domain/models/scene.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('SynthesizeVoiceUseCase', () => {
  // Mock dependencies
  const mockTtsGateway: TtsGateway = {
    synthesize: vi.fn(),
    listVoiceModels: vi.fn(),
    isVoiceModelAvailable: vi.fn(),
  };

  const mockSceneRepository: ShortsSceneRepositoryGateway = {
    save: vi.fn(),
    saveMany: vi.fn(),
    findById: vi.fn(),
    findByScriptId: vi.fn(),
    findByScriptIdAndOrder: vi.fn(),
    delete: vi.fn(),
    deleteByScriptId: vi.fn(),
    countByScriptId: vi.fn(),
  };

  const mockSceneAssetRepository: ShortsSceneAssetRepositoryGateway = {
    save: vi.fn(),
    saveMany: vi.fn(),
    findById: vi.fn(),
    findBySceneId: vi.fn(),
    findBySceneIdAndType: vi.fn(),
    findBySceneIds: vi.fn(),
    delete: vi.fn(),
    deleteBySceneId: vi.fn(),
    deleteBySceneIdAndType: vi.fn(),
  };

  const mockStorageGateway: TempStorageGateway = {
    upload: vi.fn(),
    uploadFromStream: vi.fn(),
    uploadFromStreamWithProgress: vi.fn(),
    download: vi.fn(),
    downloadAsStream: vi.fn(),
    exists: vi.fn(),
  };

  let useCase: SynthesizeVoiceUseCase;
  let idCounter: number;

  const createMockScene = (overrides: Partial<ShortsSceneProps> = {}): ShortsScene => {
    const defaultProps: ShortsSceneProps = {
      id: 'scene-1',
      scriptId: 'script-1',
      order: 0,
      summary: 'Test scene',
      visualType: 'image_gen',
      voiceText: 'Hello, this is a test.',
      subtitles: ['Hello', 'this is a test.'],
      silenceDurationMs: null,
      stockVideoKey: null,
      solidColor: null,
      imagePrompt: null,
      imageStyleHint: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return ShortsScene.fromProps({ ...defaultProps, ...overrides });
  };

  const createMockTtsResult = (): TtsSynthesizeResult => ({
    audioBuffer: Buffer.from('mock-audio-data'),
    durationMs: 2500,
    format: 'mp3',
    sampleRate: 44100,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    idCounter = 0;

    const deps: SynthesizeVoiceUseCaseDeps = {
      ttsGateway: mockTtsGateway,
      sceneRepository: mockSceneRepository,
      sceneAssetRepository: mockSceneAssetRepository,
      storageGateway: mockStorageGateway,
      generateId: () => `generated-id-${++idCounter}`,
    };

    useCase = new SynthesizeVoiceUseCase(deps);
  });

  describe('execute', () => {
    it('should throw error if script ID is empty', async () => {
      await expect(
        useCase.execute({
          scriptId: '',
        })
      ).rejects.toThrow(SynthesizeVoiceError);

      await expect(
        useCase.execute({
          scriptId: '   ',
        })
      ).rejects.toThrow('Script ID is required');
    });

    it('should throw error if no scenes found for script', async () => {
      vi.mocked(mockSceneRepository.findByScriptId).mockResolvedValue([]);

      await expect(
        useCase.execute({
          scriptId: 'script-1',
        })
      ).rejects.toThrow('No scenes found for script script-1');
    });

    it('should throw error if specific scene not found', async () => {
      vi.mocked(mockSceneRepository.findById).mockResolvedValue(null);

      await expect(
        useCase.execute({
          scriptId: 'script-1',
          sceneIds: ['non-existent-scene'],
        })
      ).rejects.toThrow('Scene not found: non-existent-scene');
    });

    it('should throw error if scene does not belong to specified script', async () => {
      const scene = createMockScene({
        id: 'scene-1',
        scriptId: 'different-script',
      });
      vi.mocked(mockSceneRepository.findById).mockResolvedValue(scene);

      await expect(
        useCase.execute({
          scriptId: 'script-1',
          sceneIds: ['scene-1'],
        })
      ).rejects.toThrow('Scene scene-1 does not belong to script script-1');
    });

    it('should successfully synthesize voice for scenes with voiceText', async () => {
      const scene1 = createMockScene({
        id: 'scene-1',
        scriptId: 'script-1',
        order: 0,
        voiceText: 'Hello, this is scene 1.',
      });
      const scene2 = createMockScene({
        id: 'scene-2',
        scriptId: 'script-1',
        order: 1,
        voiceText: 'This is scene 2.',
      });

      vi.mocked(mockSceneRepository.findByScriptId).mockResolvedValue([scene1, scene2]);
      vi.mocked(mockTtsGateway.synthesize).mockResolvedValue({
        success: true,
        value: createMockTtsResult(),
      });
      vi.mocked(mockStorageGateway.uploadFromStream).mockResolvedValue({
        gcsUri: 'gs://bucket/shorts-voice/script-1/scene-0-voice.mp3',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const result = await useCase.execute({
        scriptId: 'script-1',
      });

      expect(result.scriptId).toBe('script-1');
      expect(result.totalScenes).toBe(2);
      expect(result.scenesWithVoice).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      // Verify TTS was called for both scenes
      expect(mockTtsGateway.synthesize).toHaveBeenCalledTimes(2);
      expect(mockTtsGateway.synthesize).toHaveBeenCalledWith({
        text: 'Hello, this is scene 1.',
        voiceModelId: undefined,
      });
      expect(mockTtsGateway.synthesize).toHaveBeenCalledWith({
        text: 'This is scene 2.',
        voiceModelId: undefined,
      });

      // Verify assets were saved
      expect(mockSceneAssetRepository.save).toHaveBeenCalledTimes(2);

      // Verify existing voice assets were deleted before regeneration
      expect(mockSceneAssetRepository.deleteBySceneIdAndType).toHaveBeenCalledWith(
        'scene-1',
        'voice'
      );
      expect(mockSceneAssetRepository.deleteBySceneIdAndType).toHaveBeenCalledWith(
        'scene-2',
        'voice'
      );
    });

    it('should skip scenes without voiceText (silence scenes)', async () => {
      const sceneWithVoice = createMockScene({
        id: 'scene-1',
        scriptId: 'script-1',
        order: 0,
        voiceText: 'Hello',
      });
      const silenceScene = createMockScene({
        id: 'scene-2',
        scriptId: 'script-1',
        order: 1,
        voiceText: null,
        silenceDurationMs: 2000,
      });

      vi.mocked(mockSceneRepository.findByScriptId).mockResolvedValue([
        sceneWithVoice,
        silenceScene,
      ]);
      vi.mocked(mockTtsGateway.synthesize).mockResolvedValue({
        success: true,
        value: createMockTtsResult(),
      });
      vi.mocked(mockStorageGateway.uploadFromStream).mockResolvedValue({
        gcsUri: 'gs://bucket/shorts-voice/script-1/scene-0-voice.mp3',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const result = await useCase.execute({
        scriptId: 'script-1',
      });

      expect(result.totalScenes).toBe(2);
      expect(result.scenesWithVoice).toBe(1);
      expect(result.successCount).toBe(1);
      expect(result.skippedCount).toBe(1);
      expect(result.failedCount).toBe(0);

      // Verify TTS was only called once
      expect(mockTtsGateway.synthesize).toHaveBeenCalledTimes(1);

      // Check skipped result
      const skippedResult = result.results.find((r) => r.sceneId === 'scene-2');
      expect(skippedResult?.skipped).toBe(true);
      expect(skippedResult?.durationMs).toBe(2000);
    });

    it('should handle TTS synthesis failures gracefully', async () => {
      const scene1 = createMockScene({
        id: 'scene-1',
        scriptId: 'script-1',
        order: 0,
        voiceText: 'Success scene',
      });
      const scene2 = createMockScene({
        id: 'scene-2',
        scriptId: 'script-1',
        order: 1,
        voiceText: 'Failure scene',
      });

      vi.mocked(mockSceneRepository.findByScriptId).mockResolvedValue([scene1, scene2]);
      vi.mocked(mockTtsGateway.synthesize)
        .mockResolvedValueOnce({
          success: true,
          value: createMockTtsResult(),
        })
        .mockResolvedValueOnce({
          success: false,
          error: {
            type: 'SYNTHESIS_FAILED',
            message: 'TTS service unavailable',
          } as TtsGatewayError,
        });
      vi.mocked(mockStorageGateway.uploadFromStream).mockResolvedValue({
        gcsUri: 'gs://bucket/shorts-voice/script-1/scene-0-voice.mp3',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const result = await useCase.execute({
        scriptId: 'script-1',
      });

      expect(result.totalScenes).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      const firstError = result.errors[0];
      expect(firstError).toBeDefined();
      expect(firstError?.sceneId).toBe('scene-2');
      expect(firstError?.errorType).toBe('SYNTHESIS_FAILED');
    });

    it('should handle storage upload failures gracefully', async () => {
      const scene = createMockScene({
        id: 'scene-1',
        scriptId: 'script-1',
        order: 0,
        voiceText: 'Test',
      });

      vi.mocked(mockSceneRepository.findByScriptId).mockResolvedValue([scene]);
      vi.mocked(mockTtsGateway.synthesize).mockResolvedValue({
        success: true,
        value: createMockTtsResult(),
      });
      vi.mocked(mockStorageGateway.uploadFromStream).mockRejectedValue(
        new Error('Storage unavailable')
      );

      const result = await useCase.execute({
        scriptId: 'script-1',
      });

      expect(result.failedCount).toBe(1);
      const firstError = result.errors[0];
      expect(firstError).toBeDefined();
      expect(firstError?.errorType).toBe('STORAGE_UPLOAD_FAILED');
      expect(firstError?.message).toBe('Storage unavailable');
    });

    it('should use provided voiceModelId', async () => {
      const scene = createMockScene({
        id: 'scene-1',
        scriptId: 'script-1',
        order: 0,
        voiceText: 'Hello',
      });

      vi.mocked(mockSceneRepository.findByScriptId).mockResolvedValue([scene]);
      vi.mocked(mockTtsGateway.synthesize).mockResolvedValue({
        success: true,
        value: createMockTtsResult(),
      });
      vi.mocked(mockStorageGateway.uploadFromStream).mockResolvedValue({
        gcsUri: 'gs://bucket/test.mp3',
        expiresAt: new Date(),
      });

      await useCase.execute({
        scriptId: 'script-1',
        voiceModelId: 'custom-voice-model',
      });

      expect(mockTtsGateway.synthesize).toHaveBeenCalledWith({
        text: 'Hello',
        voiceModelId: 'custom-voice-model',
      });
    });

    it('should process only specified sceneIds when provided', async () => {
      // scene1 is not used but defined to show it's not retrieved
      createMockScene({
        id: 'scene-1',
        scriptId: 'script-1',
        order: 0,
        voiceText: 'Scene 1',
      });
      const scene2 = createMockScene({
        id: 'scene-2',
        scriptId: 'script-1',
        order: 1,
        voiceText: 'Scene 2',
      });

      vi.mocked(mockSceneRepository.findById)
        .mockResolvedValueOnce(scene2)
        .mockResolvedValueOnce(null);
      vi.mocked(mockTtsGateway.synthesize).mockResolvedValue({
        success: true,
        value: createMockTtsResult(),
      });
      vi.mocked(mockStorageGateway.uploadFromStream).mockResolvedValue({
        gcsUri: 'gs://bucket/test.mp3',
        expiresAt: new Date(),
      });

      const result = await useCase.execute({
        scriptId: 'script-1',
        sceneIds: ['scene-2'],
      });

      expect(result.totalScenes).toBe(1);
      const firstResult = result.results[0];
      expect(firstResult).toBeDefined();
      expect(firstResult?.sceneId).toBe('scene-2');
      expect(mockSceneRepository.findByScriptId).not.toHaveBeenCalled();
    });

    it('should handle rate limit errors', async () => {
      const scene = createMockScene({
        id: 'scene-1',
        scriptId: 'script-1',
        order: 0,
        voiceText: 'Hello',
      });

      vi.mocked(mockSceneRepository.findByScriptId).mockResolvedValue([scene]);
      vi.mocked(mockTtsGateway.synthesize).mockResolvedValue({
        success: false,
        error: {
          type: 'RATE_LIMIT_EXCEEDED',
          retryAfterMs: 60000,
        } as TtsGatewayError,
      });

      const result = await useCase.execute({
        scriptId: 'script-1',
      });

      expect(result.failedCount).toBe(1);
      const firstError = result.errors[0];
      expect(firstError).toBeDefined();
      expect(firstError?.errorType).toBe('RATE_LIMIT_EXCEEDED');
      expect(firstError?.message).toContain('Rate limit exceeded');
    });

    it('should handle voice model not found errors', async () => {
      const scene = createMockScene({
        id: 'scene-1',
        scriptId: 'script-1',
        order: 0,
        voiceText: 'Hello',
      });

      vi.mocked(mockSceneRepository.findByScriptId).mockResolvedValue([scene]);
      vi.mocked(mockTtsGateway.synthesize).mockResolvedValue({
        success: false,
        error: {
          type: 'VOICE_MODEL_NOT_FOUND',
          modelId: 'invalid-model',
        } as TtsGatewayError,
      });

      const result = await useCase.execute({
        scriptId: 'script-1',
        voiceModelId: 'invalid-model',
      });

      expect(result.failedCount).toBe(1);
      const firstError = result.errors[0];
      expect(firstError).toBeDefined();
      expect(firstError?.errorType).toBe('VOICE_MODEL_NOT_FOUND');
      expect(firstError?.message).toContain('invalid-model');
    });

    it('should generate correct file paths and content types', async () => {
      const scene = createMockScene({
        id: 'scene-1',
        scriptId: 'script-1',
        order: 2,
        voiceText: 'Hello',
      });

      vi.mocked(mockSceneRepository.findByScriptId).mockResolvedValue([scene]);
      vi.mocked(mockTtsGateway.synthesize).mockResolvedValue({
        success: true,
        value: createMockTtsResult(),
      });
      vi.mocked(mockStorageGateway.uploadFromStream).mockResolvedValue({
        gcsUri: 'gs://bucket/shorts-voice/script-1/scene-2-voice.mp3',
        expiresAt: new Date(),
      });

      await useCase.execute({
        scriptId: 'script-1',
      });

      expect(mockStorageGateway.uploadFromStream).toHaveBeenCalledWith(
        expect.objectContaining({
          videoId: 'shorts-voice/script-1',
          contentType: 'audio/mpeg',
          path: 'scene-2-voice.mp3',
        }),
        expect.any(Readable)
      );
    });

    it('should create valid scene assets', async () => {
      const scene = createMockScene({
        id: 'scene-1',
        scriptId: 'script-1',
        order: 0,
        voiceText: 'Hello',
      });

      vi.mocked(mockSceneRepository.findByScriptId).mockResolvedValue([scene]);
      vi.mocked(mockTtsGateway.synthesize).mockResolvedValue({
        success: true,
        value: createMockTtsResult(),
      });
      vi.mocked(mockStorageGateway.uploadFromStream).mockResolvedValue({
        gcsUri: 'gs://bucket/test.mp3',
        expiresAt: new Date(),
      });

      const result = await useCase.execute({
        scriptId: 'script-1',
      });

      expect(mockSceneAssetRepository.save).toHaveBeenCalledTimes(1);

      // Verify the saved asset has correct properties
      const saveCall = vi.mocked(mockSceneAssetRepository.save).mock.calls[0];
      expect(saveCall).toBeDefined();
      const savedAsset = saveCall?.[0];
      expect(savedAsset.sceneId).toBe('scene-1');
      expect(savedAsset.assetType).toBe('voice');
      expect(savedAsset.fileUrl).toBe('gs://bucket/test.mp3');
      expect(savedAsset.durationMs).toBe(2500);
      expect(savedAsset.id).toBe('generated-id-1');

      // Verify result contains correct asset info
      const firstResult = result.results[0];
      expect(firstResult).toBeDefined();
      expect(firstResult?.assetId).toBe('generated-id-1');
      expect(firstResult?.durationMs).toBe(2500);
    });
  });
});
