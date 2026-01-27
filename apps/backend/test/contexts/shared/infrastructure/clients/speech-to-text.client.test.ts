import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SpeechToTextClient } from '@shared/infrastructure/clients/speech-to-text.client.js';
import { beforeAll, describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../../../../fixtures');

/**
 * Check if Google Cloud credentials are configured
 * Uses GOOGLE_APPLICATION_CREDENTIALS or falls back to Application Default Credentials
 */
function isGoogleCloudConfigured(): boolean {
  return !!process.env.GOOGLE_CLOUD_PROJECT;
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

  describe('transcribeLongAudio (Batch API)', () => {
    it('should transcribe audio using GCS and Batch API', async () => {
      // Use sample.wav for testing (even though it's short, it tests the flow)
      const result = await client.transcribeLongAudio({
        audioBuffer: testAudioBuffer,
        mimeType: 'audio/wav',
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

    it('should return timestamps in segments from Batch API', async () => {
      const result = await client.transcribeLongAudio({
        audioBuffer: testAudioBuffer,
        mimeType: 'audio/wav',
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

    it('should handle FLAC format', async () => {
      // FLAC形式のテストは、fixtureが存在すれば実行
      const flacPath = path.join(FIXTURES_DIR, 'sample.flac');
      if (!fs.existsSync(flacPath)) {
        console.log('Skipping FLAC test - sample.flac not found');
        return;
      }

      const flacBuffer = await fs.promises.readFile(flacPath);
      const result = await client.transcribeLongAudio({
        audioBuffer: flacBuffer,
        mimeType: 'audio/flac',
      });

      expect(result).toHaveProperty('fullText');
      expect(result.fullText.length).toBeGreaterThan(0);
    });
  });
});
