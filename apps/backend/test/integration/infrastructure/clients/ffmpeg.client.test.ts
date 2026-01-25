import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { FFmpegClient } from '../../../../src/infrastructure/clients/ffmpeg.client.js';

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

// Skip integration tests if INTEGRATION_TEST is not set or ffmpeg is not available
const runIntegrationTests = process.env.INTEGRATION_TEST === 'true' && isFFmpegAvailable();

// Path to the test fixture video
const SAMPLE_VIDEO_PATH = path.join(__dirname, '../../../fixtures/sample.mp4');
const SAMPLE_VIDEO_DURATION = 12.8; // approximate duration in seconds
const OUTPUT_DIR = path.join(__dirname, '../../../fixtures/output');

/**
 * Save buffer to output directory for inspection
 */
async function saveOutput(filename: string, buffer: Buffer): Promise<void> {
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.promises.writeFile(path.join(OUTPUT_DIR, filename), buffer);
}

describe.skipIf(!runIntegrationTests)('FFmpegClient Integration', () => {
  let client: FFmpegClient;
  let testVideoBuffer: Buffer;

  beforeAll(async () => {
    client = new FFmpegClient();
    testVideoBuffer = await fs.promises.readFile(SAMPLE_VIDEO_PATH);
  });

  describe('getVideoDuration', () => {
    it('should return the correct duration for a video', async () => {
      const duration = await client.getVideoDuration(testVideoBuffer);

      // Allow some tolerance for encoding differences
      expect(duration).toBeGreaterThanOrEqual(SAMPLE_VIDEO_DURATION - 0.5);
      expect(duration).toBeLessThanOrEqual(SAMPLE_VIDEO_DURATION + 0.5);
    });

    it('should throw an error for invalid video data', async () => {
      const invalidBuffer = Buffer.from('not a video');

      await expect(client.getVideoDuration(invalidBuffer)).rejects.toThrow();
    });
  });

  describe('extractClip', () => {
    it('should extract a clip from a video', async () => {
      const startTime = 1;
      const endTime = 3;

      const clipBuffer = await client.extractClip(testVideoBuffer, startTime, endTime);

      // Verify the clip was created
      expect(clipBuffer).toBeInstanceOf(Buffer);
      expect(clipBuffer.length).toBeGreaterThan(0);

      // Save output for inspection
      await saveOutput('clip_1s_3s.mp4', clipBuffer);

      // Verify the clip duration
      const clipDuration = await client.getVideoDuration(clipBuffer);
      const expectedDuration = endTime - startTime;

      // Allow larger tolerance for stream copy (keyframe-based cutting)
      // Stream copy doesn't re-encode, so cuts happen at keyframe boundaries
      expect(clipDuration).toBeGreaterThanOrEqual(expectedDuration - 1.5);
      expect(clipDuration).toBeLessThanOrEqual(expectedDuration + 1.5);
    });

    it('should handle extracting from the start of the video', async () => {
      const startTime = 0;
      const endTime = 2;

      const clipBuffer = await client.extractClip(testVideoBuffer, startTime, endTime);

      expect(clipBuffer).toBeInstanceOf(Buffer);
      expect(clipBuffer.length).toBeGreaterThan(0);
    });

    it('should handle extracting near the end of the video', async () => {
      const startTime = 3;
      const endTime = 5;

      const clipBuffer = await client.extractClip(testVideoBuffer, startTime, endTime);

      expect(clipBuffer).toBeInstanceOf(Buffer);
      expect(clipBuffer.length).toBeGreaterThan(0);
    });

    it('should handle time range beyond video duration', async () => {
      const startTime = 15; // Beyond video duration (~12.8s)
      const endTime = 20;

      // FFmpeg with stream copy may produce a small/empty output
      // or throw an error depending on the input format
      // We just verify it doesn't hang and produces some output
      const clipBuffer = await client.extractClip(testVideoBuffer, startTime, endTime);
      expect(clipBuffer).toBeInstanceOf(Buffer);
    });

    it('should throw an error for invalid video data', async () => {
      const invalidBuffer = Buffer.from('not a video');

      await expect(client.extractClip(invalidBuffer, 0, 1)).rejects.toThrow();
    });
  });

  describe('extractAudio', () => {
    it('should extract WAV audio from video', async () => {
      const audioBuffer = await client.extractAudio(testVideoBuffer, 'wav');

      expect(audioBuffer).toBeInstanceOf(Buffer);
      expect(audioBuffer.length).toBeGreaterThan(0);

      // Save output for inspection
      await saveOutput('audio.wav', audioBuffer);

      // WAV files start with 'RIFF' magic bytes
      const magic = audioBuffer.slice(0, 4).toString('ascii');
      expect(magic).toBe('RIFF');
    });

    it('should extract FLAC audio from video', async () => {
      const audioBuffer = await client.extractAudio(testVideoBuffer, 'flac');

      expect(audioBuffer).toBeInstanceOf(Buffer);
      expect(audioBuffer.length).toBeGreaterThan(0);

      // Save output for inspection
      await saveOutput('audio.flac', audioBuffer);

      // FLAC files start with 'fLaC' magic bytes
      const magic = audioBuffer.slice(0, 4).toString('ascii');
      expect(magic).toBe('fLaC');
    });

    it('should produce 16kHz mono audio for WAV', async () => {
      const audioBuffer = await client.extractAudio(testVideoBuffer, 'wav');

      // Parse WAV header to verify sample rate and channels
      // WAV header: bytes 22-23 = num channels, bytes 24-27 = sample rate
      const numChannels = audioBuffer.readUInt16LE(22);
      const sampleRate = audioBuffer.readUInt32LE(24);

      expect(numChannels).toBe(1); // mono
      expect(sampleRate).toBe(16000); // 16kHz
    });

    it('should throw an error for invalid video data', async () => {
      const invalidBuffer = Buffer.from('not a video');

      await expect(client.extractAudio(invalidBuffer, 'wav')).rejects.toThrow();
    });
  });
});
