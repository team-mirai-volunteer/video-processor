import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

/**
 * Generate a test video using ffmpeg
 * Creates a 5-second video with color bars and silent audio
 */
async function generateTestVideo(outputPath: string, durationSeconds: number): Promise<void> {
  const command = [
    'ffmpeg',
    '-f lavfi',
    `-i color=c=blue:size=320x240:duration=${durationSeconds}`,
    '-f lavfi',
    `-i anullsrc=r=44100:cl=stereo:d=${durationSeconds}`,
    '-c:v libx264',
    '-preset ultrafast',
    '-c:a aac',
    '-shortest',
    '-y',
    `"${outputPath}"`,
  ].join(' ');

  execSync(command, { stdio: 'ignore' });
}

describe.skipIf(!runIntegrationTests)('FFmpegClient Integration', () => {
  let client: FFmpegClient;
  let testVideoBuffer: Buffer;
  let tempDir: string;
  const testVideoDuration = 5; // seconds

  beforeAll(async () => {
    client = new FFmpegClient();
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ffmpeg-test-'));
    const testVideoPath = path.join(tempDir, 'test.mp4');

    // Generate test video
    await generateTestVideo(testVideoPath, testVideoDuration);
    testVideoBuffer = await fs.promises.readFile(testVideoPath);
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

  describe('getVideoDuration', () => {
    it('should return the correct duration for a video', async () => {
      const duration = await client.getVideoDuration(testVideoBuffer);

      // Allow some tolerance for encoding differences
      expect(duration).toBeGreaterThanOrEqual(testVideoDuration - 0.5);
      expect(duration).toBeLessThanOrEqual(testVideoDuration + 0.5);
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
      const startTime = 10; // Beyond video duration
      const endTime = 15;

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

      // WAV files start with 'RIFF' magic bytes
      const magic = audioBuffer.slice(0, 4).toString('ascii');
      expect(magic).toBe('RIFF');
    });

    it('should extract FLAC audio from video', async () => {
      const audioBuffer = await client.extractAudio(testVideoBuffer, 'flac');

      expect(audioBuffer).toBeInstanceOf(Buffer);
      expect(audioBuffer.length).toBeGreaterThan(0);

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
