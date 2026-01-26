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

  // extractAudio method was removed - use extractAudioFromFile instead

  describe('extractAudioFromFile', () => {
    it('should extract WAV audio from file to file', async () => {
      const tempDir = await fs.promises.mkdtemp(path.join(OUTPUT_DIR, 'ffmpeg-test-'));
      const inputPath = path.join(tempDir, 'input.mp4');
      const outputPath = path.join(tempDir, 'output.wav');

      try {
        // Create output dir if not exists
        await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });

        // Copy test video to temp input
        await fs.promises.copyFile(SAMPLE_VIDEO_PATH, inputPath);

        // Execute
        await client.extractAudioFromFile(inputPath, outputPath, 'wav');

        // Verify output exists and is valid WAV
        const audioBuffer = await fs.promises.readFile(outputPath);
        expect(audioBuffer.length).toBeGreaterThan(0);

        // WAV files start with 'RIFF' magic bytes
        const magic = audioBuffer.slice(0, 4).toString('ascii');
        expect(magic).toBe('RIFF');

        // Verify 16kHz mono
        const numChannels = audioBuffer.readUInt16LE(22);
        const sampleRate = audioBuffer.readUInt32LE(24);
        expect(numChannels).toBe(1);
        expect(sampleRate).toBe(16000);
      } finally {
        // Cleanup
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should extract FLAC audio from file to file', async () => {
      const tempDir = await fs.promises.mkdtemp(path.join(OUTPUT_DIR, 'ffmpeg-test-'));
      const inputPath = path.join(tempDir, 'input.mp4');
      const outputPath = path.join(tempDir, 'output.flac');

      try {
        // Create output dir if not exists
        await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });

        // Copy test video to temp input
        await fs.promises.copyFile(SAMPLE_VIDEO_PATH, inputPath);

        // Execute
        await client.extractAudioFromFile(inputPath, outputPath, 'flac');

        // Verify output exists and is valid FLAC
        const audioBuffer = await fs.promises.readFile(outputPath);
        expect(audioBuffer.length).toBeGreaterThan(0);

        // FLAC files start with 'fLaC' magic bytes
        const magic = audioBuffer.slice(0, 4).toString('ascii');
        expect(magic).toBe('fLaC');
      } finally {
        // Cleanup
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('should throw an error for non-existent input file', async () => {
      const tempDir = await fs.promises.mkdtemp(path.join(OUTPUT_DIR, 'ffmpeg-test-'));
      const inputPath = path.join(tempDir, 'non-existent.mp4');
      const outputPath = path.join(tempDir, 'output.wav');

      try {
        // Create output dir if not exists
        await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });

        await expect(client.extractAudioFromFile(inputPath, outputPath, 'wav')).rejects.toThrow();
      } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
