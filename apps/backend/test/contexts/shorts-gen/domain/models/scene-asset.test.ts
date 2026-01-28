import { ShortsSceneAsset } from '@shorts-gen/domain/models/scene-asset.js';
import { describe, expect, it } from 'vitest';

describe('ShortsSceneAsset', () => {
  const generateId = () => 'asset-id-123';

  describe('create', () => {
    it('should create a voice asset with duration', () => {
      const result = ShortsSceneAsset.create(
        {
          sceneId: 'scene-123',
          assetType: 'voice',
          fileUrl: 'https://storage.example.com/voice.mp3',
          durationMs: 3500,
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('asset-id-123');
        expect(result.value.sceneId).toBe('scene-123');
        expect(result.value.assetType).toBe('voice');
        expect(result.value.fileUrl).toBe('https://storage.example.com/voice.mp3');
        expect(result.value.durationMs).toBe(3500);
      }
    });

    it('should create a subtitle_image asset', () => {
      const result = ShortsSceneAsset.create(
        {
          sceneId: 'scene-123',
          assetType: 'subtitle_image',
          fileUrl: 'https://storage.example.com/subtitle.png',
          metadata: { subtitleIndex: 0 },
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.assetType).toBe('subtitle_image');
        expect(result.value.durationMs).toBe(null);
        expect(result.value.metadata).toEqual({ subtitleIndex: 0 });
      }
    });

    it('should create a background_image asset', () => {
      const result = ShortsSceneAsset.create(
        {
          sceneId: 'scene-123',
          assetType: 'background_image',
          fileUrl: 'https://storage.example.com/bg.png',
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.assetType).toBe('background_image');
      }
    });

    it('should return error for empty sceneId', () => {
      const result = ShortsSceneAsset.create(
        {
          sceneId: '',
          assetType: 'voice',
          fileUrl: 'https://storage.example.com/voice.mp3',
          durationMs: 3500,
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_SCENE_ID');
      }
    });

    it('should return error for invalid asset type', () => {
      const result = ShortsSceneAsset.create(
        {
          sceneId: 'scene-123',
          assetType: 'invalid_type' as never,
          fileUrl: 'https://storage.example.com/file.mp3',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_ASSET_TYPE');
      }
    });

    it('should return error for invalid file URL', () => {
      const result = ShortsSceneAsset.create(
        {
          sceneId: 'scene-123',
          assetType: 'background_image',
          fileUrl: 'not-a-valid-url',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_FILE_URL');
      }
    });

    it('should return error for empty file URL', () => {
      const result = ShortsSceneAsset.create(
        {
          sceneId: 'scene-123',
          assetType: 'background_image',
          fileUrl: '',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_FILE_URL');
      }
    });

    it('should return error for voice asset without duration', () => {
      const result = ShortsSceneAsset.create(
        {
          sceneId: 'scene-123',
          assetType: 'voice',
          fileUrl: 'https://storage.example.com/voice.mp3',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_DURATION');
      }
    });

    it('should return error for voice asset with non-positive duration', () => {
      const result = ShortsSceneAsset.create(
        {
          sceneId: 'scene-123',
          assetType: 'voice',
          fileUrl: 'https://storage.example.com/voice.mp3',
          durationMs: 0,
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_DURATION');
      }
    });

    it('should return error for voice asset with negative duration', () => {
      const result = ShortsSceneAsset.create(
        {
          sceneId: 'scene-123',
          assetType: 'voice',
          fileUrl: 'https://storage.example.com/voice.mp3',
          durationMs: -100,
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_DURATION');
      }
    });
  });

  describe('fromProps', () => {
    it('should reconstruct a ShortsSceneAsset from props', () => {
      const now = new Date();
      const asset = ShortsSceneAsset.fromProps({
        id: 'existing-id',
        sceneId: 'scene-123',
        assetType: 'voice',
        fileUrl: 'https://storage.example.com/voice.mp3',
        durationMs: 5000,
        metadata: null,
        createdAt: now,
      });

      expect(asset.id).toBe('existing-id');
      expect(asset.sceneId).toBe('scene-123');
      expect(asset.durationMs).toBe(5000);
    });
  });

  describe('isVoice', () => {
    it('should return true for voice asset', () => {
      const result = ShortsSceneAsset.create(
        {
          sceneId: 'scene-123',
          assetType: 'voice',
          fileUrl: 'https://storage.example.com/voice.mp3',
          durationMs: 3500,
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.isVoice()).toBe(true);
        expect(result.value.isSubtitleImage()).toBe(false);
        expect(result.value.isBackgroundImage()).toBe(false);
      }
    });
  });

  describe('isSubtitleImage', () => {
    it('should return true for subtitle_image asset', () => {
      const result = ShortsSceneAsset.create(
        {
          sceneId: 'scene-123',
          assetType: 'subtitle_image',
          fileUrl: 'https://storage.example.com/subtitle.png',
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.isVoice()).toBe(false);
        expect(result.value.isSubtitleImage()).toBe(true);
        expect(result.value.isBackgroundImage()).toBe(false);
      }
    });
  });

  describe('isBackgroundImage', () => {
    it('should return true for background_image asset', () => {
      const result = ShortsSceneAsset.create(
        {
          sceneId: 'scene-123',
          assetType: 'background_image',
          fileUrl: 'https://storage.example.com/bg.png',
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.isVoice()).toBe(false);
        expect(result.value.isSubtitleImage()).toBe(false);
        expect(result.value.isBackgroundImage()).toBe(true);
      }
    });
  });

  describe('toProps', () => {
    it('should convert to plain object', () => {
      const result = ShortsSceneAsset.create(
        {
          sceneId: 'scene-123',
          assetType: 'voice',
          fileUrl: 'https://storage.example.com/voice.mp3',
          durationMs: 3500,
          metadata: { custom: 'data' },
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (!result.success) return;

      const props = result.value.toProps();
      expect(props.id).toBe('asset-id-123');
      expect(props.sceneId).toBe('scene-123');
      expect(props.assetType).toBe('voice');
      expect(props.fileUrl).toBe('https://storage.example.com/voice.mp3');
      expect(props.durationMs).toBe(3500);
      expect(props.metadata).toEqual({ custom: 'data' });
      expect(props.createdAt).toBeInstanceOf(Date);
    });
  });
});
