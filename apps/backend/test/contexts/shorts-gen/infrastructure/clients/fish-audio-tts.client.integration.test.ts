import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FishAudioTtsClient } from '../../../../../src/contexts/shorts-gen/infrastructure/clients/fish-audio-tts.client.js';

/**
 * Fish Audio TTS Client Integration Tests
 *
 * These tests make real API calls to Fish Audio.
 * They are skipped unless FISH_AUDIO_API_KEY is set.
 *
 * To run these tests:
 * 1. Set FISH_AUDIO_API_KEY environment variable
 * 2. Run: pnpm --filter backend test:integration
 */
describe('FishAudioTtsClient Integration Tests', () => {
  const apiKey = process.env.FISH_AUDIO_API_KEY;
  const shouldSkip = !apiKey;

  let client: FishAudioTtsClient;

  beforeAll(() => {
    if (!shouldSkip) {
      client = new FishAudioTtsClient();
    }
  });

  afterAll(() => {
    // Cleanup if needed
  });

  describe.skipIf(shouldSkip)('synthesize', () => {
    it('should synthesize speech from simple Japanese text', async () => {
      const result = await client.synthesize({
        text: 'こんにちは、テストです。',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.audioBuffer).toBeInstanceOf(Buffer);
        expect(result.value.audioBuffer.length).toBeGreaterThan(0);
        expect(result.value.durationMs).toBeGreaterThan(0);
        expect(result.value.format).toBe('mp3');
      }
    }, 30000); // 30 second timeout for API call

    it('should synthesize speech from English text', async () => {
      const result = await client.synthesize({
        text: 'Hello, this is a test.',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.audioBuffer).toBeInstanceOf(Buffer);
        expect(result.value.audioBuffer.length).toBeGreaterThan(0);
        expect(result.value.durationMs).toBeGreaterThan(0);
      }
    }, 30000);

    it('should synthesize speech from longer text', async () => {
      const result = await client.synthesize({
        text: 'これは少し長めのテキストです。音声合成のテストを行っています。複数の文章が含まれる場合でも正しく合成できることを確認します。',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.audioBuffer).toBeInstanceOf(Buffer);
        expect(result.value.audioBuffer.length).toBeGreaterThan(0);
        // Longer text should produce longer audio
        expect(result.value.durationMs).toBeGreaterThan(1000);
      }
    }, 60000); // 60 second timeout for longer text

    it('should return INVALID_TEXT error for empty text', async () => {
      const result = await client.synthesize({
        text: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_TEXT');
      }
    });

    it('should return INVALID_TEXT error for whitespace-only text', async () => {
      const result = await client.synthesize({
        text: '   ',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_TEXT');
      }
    });

    it('should return VOICE_MODEL_NOT_FOUND for invalid voice model', async () => {
      const result = await client.synthesize({
        text: 'Test text',
        voiceModelId: 'invalid-model-id-12345',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        // Fish Audio may return 404 for invalid model or include it in API_ERROR
        expect(['VOICE_MODEL_NOT_FOUND', 'API_ERROR']).toContain(result.error.type);
      }
    }, 30000);
  });

  describe.skipIf(shouldSkip)('listVoiceModels', () => {
    it('should return an array of voice models', async () => {
      const models = await client.listVoiceModels();

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe.skipIf(shouldSkip)('isVoiceModelAvailable', () => {
    it('should return true for default voice model', async () => {
      const models = await client.listVoiceModels();
      expect(models.length).toBeGreaterThan(0);
      const defaultModel = models[0] as string;

      const isAvailable = await client.isVoiceModelAvailable(defaultModel);

      expect(isAvailable).toBe(true);
    });

    it('should return true for any model ID (validation happens during synthesis)', async () => {
      const isAvailable = await client.isVoiceModelAvailable('some-random-id');

      expect(isAvailable).toBe(true);
    });
  });

  describe('constructor', () => {
    it('should throw error when API key is not provided and not in environment', () => {
      const originalApiKey = process.env.FISH_AUDIO_API_KEY;
      process.env.FISH_AUDIO_API_KEY = '';

      try {
        expect(() => new FishAudioTtsClient()).toThrow(
          'FISH_AUDIO_API_KEY environment variable is required'
        );
      } finally {
        // Restore
        if (originalApiKey) {
          process.env.FISH_AUDIO_API_KEY = originalApiKey;
        }
      }
    });

    it('should use provided API key from config', () => {
      const customClient = new FishAudioTtsClient({
        apiKey: 'test-api-key',
      });

      expect(customClient).toBeDefined();
    });

    it('should use custom API URL from config', () => {
      const customClient = new FishAudioTtsClient({
        apiKey: 'test-api-key',
        apiUrl: 'https://custom.fish.audio',
      });

      expect(customClient).toBeDefined();
    });

    it('should use custom voice model from config', () => {
      const customClient = new FishAudioTtsClient({
        apiKey: 'test-api-key',
        defaultVoiceModelId: 'custom-model-id',
      });

      expect(customClient).toBeDefined();
    });
  });
});

describe('FishAudioTtsClient Unit Tests (no API calls)', () => {
  describe('constructor with config', () => {
    it('should accept known voice models in config', () => {
      const client = new FishAudioTtsClient({
        apiKey: 'test-key',
        knownVoiceModels: ['model1', 'model2', 'model3'],
      });

      expect(client).toBeDefined();
    });
  });

  describe('listVoiceModels with config', () => {
    it('should return known voice models including default', async () => {
      const client = new FishAudioTtsClient({
        apiKey: 'test-key',
        defaultVoiceModelId: 'default-model',
        knownVoiceModels: ['model1', 'model2'],
      });

      const models = await client.listVoiceModels();

      expect(models).toContain('default-model');
      expect(models).toContain('model1');
      expect(models).toContain('model2');
    });

    it('should deduplicate models when default is in known list', async () => {
      const client = new FishAudioTtsClient({
        apiKey: 'test-key',
        defaultVoiceModelId: 'model1',
        knownVoiceModels: ['model1', 'model2'],
      });

      const models = await client.listVoiceModels();

      expect(models.filter((m) => m === 'model1').length).toBe(1);
    });
  });

  describe('isVoiceModelAvailable', () => {
    it('should return true for default model', async () => {
      const client = new FishAudioTtsClient({
        apiKey: 'test-key',
        defaultVoiceModelId: 'default-model',
      });

      const isAvailable = await client.isVoiceModelAvailable('default-model');

      expect(isAvailable).toBe(true);
    });

    it('should return true for known models', async () => {
      const client = new FishAudioTtsClient({
        apiKey: 'test-key',
        knownVoiceModels: ['model1', 'model2'],
      });

      expect(await client.isVoiceModelAvailable('model1')).toBe(true);
      expect(await client.isVoiceModelAvailable('model2')).toBe(true);
    });

    it('should return true for unknown models (validation at synthesis time)', async () => {
      const client = new FishAudioTtsClient({
        apiKey: 'test-key',
      });

      const isAvailable = await client.isVoiceModelAvailable('unknown-model');

      expect(isAvailable).toBe(true);
    });
  });
});
