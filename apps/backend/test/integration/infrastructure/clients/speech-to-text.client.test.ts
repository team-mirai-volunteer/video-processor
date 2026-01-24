import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SpeechToTextClient } from '../../../../src/infrastructure/clients/speech-to-text.client.js';

/**
 * Check if ffmpeg is available on the system
 */
function isFFmpegAvailable(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Google Cloud credentials are configured
 */
function isGoogleCloudConfigured(): boolean {
  return !!(process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GOOGLE_CLOUD_PROJECT);
}

// Skip integration tests if INTEGRATION_TEST is not set or dependencies are not available
const runIntegrationTests =
  process.env.INTEGRATION_TEST === 'true' && isFFmpegAvailable() && isGoogleCloudConfigured();

/**
 * Generate a test audio file with Japanese speech using ffmpeg
 * Creates a short audio with synthesized speech pattern
 */
async function generateTestAudio(
  outputPath: string,
  durationSeconds: number,
  format: 'wav' | 'flac'
): Promise<void> {
  // Generate a simple tone as test audio
  // In real tests, you might use a pre-recorded audio file
  const codec = format === 'wav' ? 'pcm_s16le' : 'flac';

  const command = [
    'ffmpeg',
    '-f lavfi',
    `-i sine=frequency=440:duration=${durationSeconds}`,
    `-acodec ${codec}`,
    '-ar 16000',
    '-ac 1',
    '-y',
    `"${outputPath}"`,
  ].join(' ');

  execSync(command, { stdio: 'ignore' });
}

describe.skipIf(!runIntegrationTests)('SpeechToTextClient Integration', () => {
  let client: SpeechToTextClient;
  let tempDir: string;
  let testAudioBuffer: Buffer;

  beforeAll(async () => {
    client = new SpeechToTextClient();
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stt-test-'));

    // Generate test audio (short tone for basic testing)
    const testAudioPath = path.join(tempDir, 'test.wav');
    await generateTestAudio(testAudioPath, 3, 'wav');
    testAudioBuffer = await fs.promises.readFile(testAudioPath);
  });

  afterAll(async () => {
    // Cleanup temp directory
    if (tempDir) {
      try {
        const files = await fs.promises.readdir(tempDir);
        await Promise.all(files.map((file) => fs.promises.unlink(path.join(tempDir, file))));
        await fs.promises.rmdir(tempDir);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('transcribe', () => {
    it('should transcribe short WAV audio', async () => {
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
    });

    it('should return timestamps in segments', async () => {
      const result = await client.transcribe({
        audioBuffer: testAudioBuffer,
        mimeType: 'audio/wav',
        sampleRateHertz: 16000,
      });

      // If there are segments, verify they have timestamps
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

    it('should transcribe FLAC audio', async () => {
      // Generate FLAC test audio
      const flacPath = path.join(tempDir, 'test.flac');
      await generateTestAudio(flacPath, 3, 'flac');
      const flacBuffer = await fs.promises.readFile(flacPath);

      const result = await client.transcribe({
        audioBuffer: flacBuffer,
        mimeType: 'audio/flac',
        sampleRateHertz: 16000,
      });

      expect(result).toHaveProperty('fullText');
      expect(result).toHaveProperty('segments');
      expect(Array.isArray(result.segments)).toBe(true);
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

describe.skipIf(!runIntegrationTests)('SpeechToTextClient Long Running Integration', () => {
  let client: SpeechToTextClient;
  let tempDir: string;

  beforeAll(async () => {
    client = new SpeechToTextClient();
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stt-long-test-'));
  });

  afterAll(async () => {
    if (tempDir) {
      try {
        const files = await fs.promises.readdir(tempDir);
        await Promise.all(files.map((file) => fs.promises.unlink(path.join(tempDir, file))));
        await fs.promises.rmdir(tempDir);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it(
    'should handle long audio with LongRunningRecognize',
    async () => {
      // Generate 70-second audio to trigger LongRunningRecognize
      const longAudioPath = path.join(tempDir, 'long.wav');
      await generateTestAudio(longAudioPath, 70, 'wav');
      const longAudioBuffer = await fs.promises.readFile(longAudioPath);

      const result = await client.transcribe({
        audioBuffer: longAudioBuffer,
        mimeType: 'audio/wav',
        sampleRateHertz: 16000,
      });

      expect(result).toHaveProperty('fullText');
      expect(result).toHaveProperty('segments');
      expect(Array.isArray(result.segments)).toBe(true);
    },
    { timeout: 120000 }
  ); // 2 minute timeout for long running operation
});
