import { ShortsScene } from '@shorts-gen/domain/models/scene.js';
import { describe, expect, it } from 'vitest';

describe('ShortsScene', () => {
  const generateId = () => 'scene-id-123';

  describe('create', () => {
    it('should create a ShortsScene with voice text (image_gen visual type)', () => {
      const result = ShortsScene.create(
        {
          scriptId: 'script-123',
          order: 0,
          summary: 'Opening scene with AI explanation',
          visualType: 'image_gen',
          voiceText: 'AIとは人工知能のことです',
          subtitles: ['AIとは', '人工知能のことです'],
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('scene-id-123');
        expect(result.value.scriptId).toBe('script-123');
        expect(result.value.order).toBe(0);
        expect(result.value.summary).toBe('Opening scene with AI explanation');
        expect(result.value.visualType).toBe('image_gen');
        expect(result.value.voiceText).toBe('AIとは人工知能のことです');
        expect(result.value.subtitles).toEqual(['AIとは', '人工知能のことです']);
        expect(result.value.silenceDurationMs).toBe(null);
      }
    });

    it('should create a ShortsScene with silence duration (solid_color visual type)', () => {
      const result = ShortsScene.create(
        {
          scriptId: 'script-123',
          order: 1,
          summary: 'Transition scene',
          visualType: 'solid_color',
          silenceDurationMs: 1000,
          solidColor: '#000000',
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.voiceText).toBe(null);
        expect(result.value.silenceDurationMs).toBe(1000);
        expect(result.value.solidColor).toBe('#000000');
      }
    });

    it('should create a ShortsScene with stock_video visual type', () => {
      const result = ShortsScene.create(
        {
          scriptId: 'script-123',
          order: 2,
          summary: 'Party leader speech',
          visualType: 'stock_video',
          voiceText: 'Sample voice',
          stockVideoKey: 'leader-speech-001',
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.visualType).toBe('stock_video');
        expect(result.value.stockVideoKey).toBe('leader-speech-001');
      }
    });

    it('should return error for empty scriptId', () => {
      const result = ShortsScene.create(
        {
          scriptId: '',
          order: 0,
          summary: 'Test',
          visualType: 'image_gen',
          voiceText: 'Test voice',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_SCRIPT_ID');
      }
    });

    it('should return error for negative order', () => {
      const result = ShortsScene.create(
        {
          scriptId: 'script-123',
          order: -1,
          summary: 'Test',
          visualType: 'image_gen',
          voiceText: 'Test voice',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_ORDER');
      }
    });

    it('should return error for empty summary', () => {
      const result = ShortsScene.create(
        {
          scriptId: 'script-123',
          order: 0,
          summary: '',
          visualType: 'image_gen',
          voiceText: 'Test voice',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_SUMMARY');
      }
    });

    it('should return error for invalid visual type', () => {
      const result = ShortsScene.create(
        {
          scriptId: 'script-123',
          order: 0,
          summary: 'Test',
          visualType: 'invalid_type' as never,
          voiceText: 'Test voice',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_VISUAL_TYPE');
      }
    });

    it('should return error for stock_video without stockVideoKey', () => {
      const result = ShortsScene.create(
        {
          scriptId: 'script-123',
          order: 0,
          summary: 'Test',
          visualType: 'stock_video',
          voiceText: 'Test voice',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('MISSING_STOCK_VIDEO_KEY');
      }
    });

    it('should return error for solid_color without solidColor', () => {
      const result = ShortsScene.create(
        {
          scriptId: 'script-123',
          order: 0,
          summary: 'Test',
          visualType: 'solid_color',
          silenceDurationMs: 1000,
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('MISSING_SOLID_COLOR');
      }
    });

    it('should return error for invalid hex color', () => {
      const result = ShortsScene.create(
        {
          scriptId: 'script-123',
          order: 0,
          summary: 'Test',
          visualType: 'solid_color',
          silenceDurationMs: 1000,
          solidColor: 'red',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('MISSING_SOLID_COLOR');
      }
    });

    it('should return error when neither voiceText nor silenceDurationMs provided', () => {
      const result = ShortsScene.create(
        {
          scriptId: 'script-123',
          order: 0,
          summary: 'Test',
          visualType: 'image_gen',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('MISSING_VOICE_OR_SILENCE');
      }
    });

    it('should return error for non-positive silence duration', () => {
      const result = ShortsScene.create(
        {
          scriptId: 'script-123',
          order: 0,
          summary: 'Test',
          visualType: 'solid_color',
          silenceDurationMs: 0,
          solidColor: '#000000',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_SILENCE_DURATION');
      }
    });
  });

  describe('fromProps', () => {
    it('should reconstruct a ShortsScene from props', () => {
      const now = new Date();
      const scene = ShortsScene.fromProps({
        id: 'existing-id',
        scriptId: 'script-123',
        order: 2,
        summary: 'Existing scene',
        visualType: 'image_gen',
        voiceText: 'Voice text',
        subtitles: ['Subtitle 1'],
        silenceDurationMs: null,
        stockVideoKey: null,
        solidColor: null,
        imagePrompt: 'A cat explaining AI',
        imageStyleHint: 'anime style',
        createdAt: now,
        updatedAt: now,
      });

      expect(scene.id).toBe('existing-id');
      expect(scene.order).toBe(2);
      expect(scene.imagePrompt).toBe('A cat explaining AI');
    });
  });

  describe('withSummary', () => {
    it('should update summary', () => {
      const sceneResult = ShortsScene.create(
        {
          scriptId: 'script-123',
          order: 0,
          summary: 'Original summary',
          visualType: 'image_gen',
          voiceText: 'Voice text',
        },
        generateId
      );
      expect(sceneResult.success).toBe(true);
      if (!sceneResult.success) return;

      const updatedResult = sceneResult.value.withSummary('Updated summary');
      expect(updatedResult.success).toBe(true);
      if (updatedResult.success) {
        expect(updatedResult.value.summary).toBe('Updated summary');
      }
    });

    it('should return error for empty summary', () => {
      const sceneResult = ShortsScene.create(
        {
          scriptId: 'script-123',
          order: 0,
          summary: 'Original summary',
          visualType: 'image_gen',
          voiceText: 'Voice text',
        },
        generateId
      );
      expect(sceneResult.success).toBe(true);
      if (!sceneResult.success) return;

      const updatedResult = sceneResult.value.withSummary('');
      expect(updatedResult.success).toBe(false);
    });
  });

  describe('withVoiceText', () => {
    it('should update voice text', () => {
      const sceneResult = ShortsScene.create(
        {
          scriptId: 'script-123',
          order: 0,
          summary: 'Summary',
          visualType: 'image_gen',
          voiceText: 'Original voice',
        },
        generateId
      );
      expect(sceneResult.success).toBe(true);
      if (!sceneResult.success) return;

      const updatedResult = sceneResult.value.withVoiceText('Updated voice');
      expect(updatedResult.success).toBe(true);
      if (updatedResult.success) {
        expect(updatedResult.value.voiceText).toBe('Updated voice');
      }
    });
  });

  describe('withSubtitles', () => {
    it('should update subtitles', () => {
      const sceneResult = ShortsScene.create(
        {
          scriptId: 'script-123',
          order: 0,
          summary: 'Summary',
          visualType: 'image_gen',
          voiceText: 'Voice text',
          subtitles: ['Original'],
        },
        generateId
      );
      expect(sceneResult.success).toBe(true);
      if (!sceneResult.success) return;

      const updated = sceneResult.value.withSubtitles(['New', 'Subtitles']);
      expect(updated.subtitles).toEqual(['New', 'Subtitles']);
    });
  });

  describe('withImagePrompt', () => {
    it('should update image prompt', () => {
      const sceneResult = ShortsScene.create(
        {
          scriptId: 'script-123',
          order: 0,
          summary: 'Summary',
          visualType: 'image_gen',
          voiceText: 'Voice text',
        },
        generateId
      );
      expect(sceneResult.success).toBe(true);
      if (!sceneResult.success) return;

      const updated = sceneResult.value.withImagePrompt('A cat in a lab coat');
      expect(updated.imagePrompt).toBe('A cat in a lab coat');
    });

    it('should allow null image prompt', () => {
      const sceneResult = ShortsScene.create(
        {
          scriptId: 'script-123',
          order: 0,
          summary: 'Summary',
          visualType: 'image_gen',
          voiceText: 'Voice text',
        },
        generateId
      );
      expect(sceneResult.success).toBe(true);
      if (!sceneResult.success) return;

      const updated = sceneResult.value.withImagePrompt('Test').withImagePrompt(null);
      expect(updated.imagePrompt).toBe(null);
    });
  });

  describe('withOrder', () => {
    it('should update order', () => {
      const sceneResult = ShortsScene.create(
        {
          scriptId: 'script-123',
          order: 0,
          summary: 'Summary',
          visualType: 'image_gen',
          voiceText: 'Voice text',
        },
        generateId
      );
      expect(sceneResult.success).toBe(true);
      if (!sceneResult.success) return;

      const updatedResult = sceneResult.value.withOrder(5);
      expect(updatedResult.success).toBe(true);
      if (updatedResult.success) {
        expect(updatedResult.value.order).toBe(5);
      }
    });

    it('should return error for negative order', () => {
      const sceneResult = ShortsScene.create(
        {
          scriptId: 'script-123',
          order: 0,
          summary: 'Summary',
          visualType: 'image_gen',
          voiceText: 'Voice text',
        },
        generateId
      );
      expect(sceneResult.success).toBe(true);
      if (!sceneResult.success) return;

      const updatedResult = sceneResult.value.withOrder(-1);
      expect(updatedResult.success).toBe(false);
    });
  });

  describe('toProps', () => {
    it('should convert to plain object', () => {
      const sceneResult = ShortsScene.create(
        {
          scriptId: 'script-123',
          order: 0,
          summary: 'Summary',
          visualType: 'image_gen',
          voiceText: 'Voice text',
          subtitles: ['Sub1', 'Sub2'],
        },
        generateId
      );
      expect(sceneResult.success).toBe(true);
      if (!sceneResult.success) return;

      const props = sceneResult.value.toProps();
      expect(props.id).toBe('scene-id-123');
      expect(props.scriptId).toBe('script-123');
      expect(props.order).toBe(0);
      expect(props.summary).toBe('Summary');
      expect(props.visualType).toBe('image_gen');
      expect(props.voiceText).toBe('Voice text');
      expect(props.subtitles).toEqual(['Sub1', 'Sub2']);
      expect(props.createdAt).toBeInstanceOf(Date);
      expect(props.updatedAt).toBeInstanceOf(Date);
    });
  });
});
