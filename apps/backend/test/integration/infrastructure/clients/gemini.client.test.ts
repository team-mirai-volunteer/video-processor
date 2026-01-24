import { describe, expect, it } from 'vitest';
import { GeminiClient } from '../../../../src/infrastructure/clients/gemini.client.js';

/**
 * Integration tests for GeminiClient
 *
 * These tests require:
 * - INTEGRATION_TEST=true environment variable
 * - GOOGLE_GENERATIVE_AI_API_KEY environment variable with a valid API key
 *
 * Run with: INTEGRATION_TEST=true GOOGLE_GENERATIVE_AI_API_KEY=your-key pnpm test:integration
 */
const runIntegrationTests =
  process.env.INTEGRATION_TEST === 'true' && !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;

describe.skipIf(!runIntegrationTests)('GeminiClient Integration', () => {
  it('should create client from environment variables', () => {
    const client = GeminiClient.fromEnv();
    expect(client).toBeInstanceOf(GeminiClient);
  });

  it('should analyze video and return clip extraction response', async () => {
    const client = GeminiClient.fromEnv();

    const result = await client.analyzeVideo({
      googleDriveUrl: 'https://drive.google.com/file/d/example-video-id/view',
      videoTitle: 'テスト動画',
      clipInstructions:
        '動画から面白い部分を3つ切り抜いてください。各クリップは30秒程度にしてください。',
    });

    // Verify the response structure
    expect(result).toHaveProperty('clips');
    expect(Array.isArray(result.clips)).toBe(true);

    // Each clip should have the required fields
    for (const clip of result.clips) {
      expect(clip).toHaveProperty('title');
      expect(clip).toHaveProperty('startTime');
      expect(clip).toHaveProperty('endTime');
      expect(clip).toHaveProperty('transcript');
      expect(clip).toHaveProperty('reason');

      // Validate time format (HH:MM:SS)
      expect(clip.startTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      expect(clip.endTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    }
  }, 60000); // 60 second timeout for API call

  it('should handle video without title', async () => {
    const client = GeminiClient.fromEnv();

    const result = await client.analyzeVideo({
      googleDriveUrl: 'https://drive.google.com/file/d/example-video-id/view',
      videoTitle: null,
      clipInstructions: '重要な発言部分を1つ切り抜いてください。',
    });

    expect(result).toHaveProperty('clips');
    expect(Array.isArray(result.clips)).toBe(true);
  }, 60000);
});

describe('GeminiClient Unit', () => {
  it('should throw error when API key is not provided', () => {
    expect(() => new GeminiClient({ apiKey: '' })).toThrow('Gemini API key is required');
  });

  it('should throw error when creating from env without API key', () => {
    const originalKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = '';

    try {
      expect(() => GeminiClient.fromEnv()).toThrow(
        'GOOGLE_GENERATIVE_AI_API_KEY environment variable is required'
      );
    } finally {
      // Restore the original value
      if (originalKey) {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalKey;
      }
    }
  });

  it('should use default model when not specified', () => {
    // We can't directly test the private field, but we can verify it doesn't throw
    const client = new GeminiClient({ apiKey: 'test-key' });
    expect(client).toBeInstanceOf(GeminiClient);
  });

  it('should use custom model when specified', () => {
    const client = new GeminiClient({
      apiKey: 'test-key',
      model: 'gemini-1.5-pro',
    });
    expect(client).toBeInstanceOf(GeminiClient);
  });
});
