import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { SpeechToTextClient } from '../../../../src/infrastructure/clients/speech-to-text.client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../../../fixtures');

/**
 * Check if Google Cloud credentials are configured
 */
function isGoogleCloudConfigured(): boolean {
  return !!(process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GOOGLE_CLOUD_PROJECT);
}

// Skip integration tests if INTEGRATION_TEST is not set or dependencies are not available
const runIntegrationTests = process.env.INTEGRATION_TEST === 'true' && isGoogleCloudConfigured();

describe.skipIf(!runIntegrationTests)('SpeechToTextClient Integration', () => {
  let client: SpeechToTextClient;
  let testAudioBuffer: Buffer;

  beforeAll(async () => {
    client = new SpeechToTextClient();
    testAudioBuffer = await fs.promises.readFile(path.join(FIXTURES_DIR, 'sample.wav'));
  });

  describe('transcribe', () => {
    it('should transcribe WAV audio with Japanese speech', async () => {
      const result = await client.transcribe({
        audioBuffer: testAudioBuffer,
        mimeType: 'audio/wav',
        sampleRateHertz: 16000,
      });

      // Verify result structure
      expect(result).toHaveProperty('fullText');
      expect(result).toHaveProperty('segments');
      expect(result).toHaveProperty('languageCode');
      expect(result).toHaveProperty('durationSeconds');
      expect(Array.isArray(result.segments)).toBe(true);
      // Real audio should have transcription
      expect(result.fullText.length).toBeGreaterThan(0);
      // Verify specific word from sample audio: "2026"
      expect(result.fullText).toContain('2026');
    });

    it('should return timestamps in segments', async () => {
      const result = await client.transcribe({
        audioBuffer: testAudioBuffer,
        mimeType: 'audio/wav',
        sampleRateHertz: 16000,
      });

      // Real audio should have segments with timestamps
      expect(result.segments.length).toBeGreaterThan(0);
      for (const segment of result.segments) {
        expect(segment).toHaveProperty('text');
        expect(segment).toHaveProperty('startTimeSeconds');
        expect(segment).toHaveProperty('endTimeSeconds');
        expect(segment).toHaveProperty('confidence');
        expect(typeof segment.startTimeSeconds).toBe('number');
        expect(typeof segment.endTimeSeconds).toBe('number');
        expect(segment.startTimeSeconds).toBeLessThanOrEqual(segment.endTimeSeconds);
      }
    });

    it('should handle language code hint', async () => {
      const result = await client.transcribe({
        audioBuffer: testAudioBuffer,
        mimeType: 'audio/wav',
        sampleRateHertz: 16000,
        languageCode: 'ja-JP',
      });

      expect(result).toHaveProperty('fullText');
      expect(result).toHaveProperty('languageCode');
      expect(result.fullText.length).toBeGreaterThan(0);
    });

    it('should throw error for invalid audio data', async () => {
      const invalidBuffer = Buffer.from('not audio data');

      await expect(
        client.transcribe({
          audioBuffer: invalidBuffer,
          mimeType: 'audio/wav',
          sampleRateHertz: 16000,
        })
      ).rejects.toThrow();
    });
  });
});
