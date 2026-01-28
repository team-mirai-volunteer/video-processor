import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  ComposeSceneInput,
  VideoComposeParams,
} from '../../../../../src/contexts/shorts-gen/domain/gateways/video-compose.gateway.js';
import { FFmpegComposeClient } from '../../../../../src/contexts/shorts-gen/infrastructure/clients/ffmpeg-compose.client.js';

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

const TEST_FIXTURES_DIR = path.join(__dirname, '../../../../fixtures');
const OUTPUT_DIR = path.join(TEST_FIXTURES_DIR, 'output');

describe.skipIf(!runIntegrationTests)('FFmpegComposeClient Integration', () => {
  let client: FFmpegComposeClient;
  let tempDir: string;

  beforeAll(async () => {
    client = new FFmpegComposeClient();
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ffmpeg-compose-test-'));
    await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  });

  afterAll(async () => {
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('isAvailable', () => {
    it('should return true when ffmpeg is installed', async () => {
      const available = await client.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('getSupportedCodecs', () => {
    it('should return a list of video codecs', async () => {
      const codecs = await client.getSupportedCodecs();
      expect(Array.isArray(codecs)).toBe(true);
      expect(codecs.length).toBeGreaterThan(0);
      // libx264 is commonly available
      expect(codecs).toContain('libx264');
    });
  });

  describe('compose', () => {
    it('should compose a single scene with solid color background', async () => {
      const outputPath = path.join(tempDir, 'solid_color_output.mp4');

      const params: VideoComposeParams = {
        outputPath,
        width: 1080,
        height: 1920,
        frameRate: 30,
        scenes: [
          {
            sceneId: 'scene-1',
            order: 0,
            durationMs: 2000,
            visual: {
              type: 'solid_color',
              color: '#FF5733',
            },
            audioPath: null,
            subtitles: [],
          },
        ],
      };

      const result = await client.compose(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.outputPath).toBe(outputPath);
        expect(result.value.durationSeconds).toBeCloseTo(2, 0);
        expect(result.value.fileSizeBytes).toBeGreaterThan(0);
        expect(fs.existsSync(outputPath)).toBe(true);
      }
    });

    it('should compose multiple scenes with solid color backgrounds', async () => {
      const outputPath = path.join(tempDir, 'multi_scene_output.mp4');

      const scenes: ComposeSceneInput[] = [
        {
          sceneId: 'scene-1',
          order: 0,
          durationMs: 1000,
          visual: { type: 'solid_color', color: '#FF0000' },
          audioPath: null,
          subtitles: [],
        },
        {
          sceneId: 'scene-2',
          order: 1,
          durationMs: 1500,
          visual: { type: 'solid_color', color: '#00FF00' },
          audioPath: null,
          subtitles: [],
        },
        {
          sceneId: 'scene-3',
          order: 2,
          durationMs: 1000,
          visual: { type: 'solid_color', color: '#0000FF' },
          audioPath: null,
          subtitles: [],
        },
      ];

      const params: VideoComposeParams = {
        outputPath,
        width: 720,
        height: 1280,
        frameRate: 30,
        scenes,
      };

      const result = await client.compose(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.outputPath).toBe(outputPath);
        // Total duration should be approximately 3.5 seconds
        expect(result.value.durationSeconds).toBeGreaterThanOrEqual(3);
        expect(result.value.durationSeconds).toBeLessThanOrEqual(4);
        expect(fs.existsSync(outputPath)).toBe(true);
      }
    });

    it('should compose a scene with image background', async () => {
      // Create a test image using ffmpeg
      const testImagePath = path.join(tempDir, 'test_image.png');
      createTestImage(testImagePath, 1080, 1920, '#3498db');

      const outputPath = path.join(tempDir, 'image_bg_output.mp4');

      const params: VideoComposeParams = {
        outputPath,
        width: 1080,
        height: 1920,
        frameRate: 30,
        scenes: [
          {
            sceneId: 'scene-1',
            order: 0,
            durationMs: 2000,
            visual: {
              type: 'image',
              filePath: testImagePath,
            },
            audioPath: null,
            subtitles: [],
          },
        ],
      };

      const result = await client.compose(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.outputPath).toBe(outputPath);
        expect(result.value.durationSeconds).toBeCloseTo(2, 0);
        expect(fs.existsSync(outputPath)).toBe(true);
      }
    });

    it('should compose with subtitle overlays', async () => {
      // Create a test subtitle image (transparent PNG with text)
      const subtitleImagePath = path.join(tempDir, 'subtitle.png');
      createSubtitleImage(subtitleImagePath, 1080, 200, 'テスト字幕');

      const outputPath = path.join(tempDir, 'subtitle_output.mp4');

      const params: VideoComposeParams = {
        outputPath,
        width: 1080,
        height: 1920,
        frameRate: 30,
        scenes: [
          {
            sceneId: 'scene-1',
            order: 0,
            durationMs: 3000,
            visual: {
              type: 'solid_color',
              color: '#1a1a2e',
            },
            audioPath: null,
            subtitles: [
              {
                imagePath: subtitleImagePath,
                startMs: 500,
                endMs: 2500,
              },
            ],
          },
        ],
      };

      const result = await client.compose(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.outputPath).toBe(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
      }
    });

    it('should compose with audio', async () => {
      const audioPath = path.join(TEST_FIXTURES_DIR, 'sample.wav');

      // Skip if sample.wav doesn't exist
      if (!fs.existsSync(audioPath)) {
        console.log('Skipping audio test: sample.wav not found');
        return;
      }

      const outputPath = path.join(tempDir, 'audio_output.mp4');

      const params: VideoComposeParams = {
        outputPath,
        width: 1080,
        height: 1920,
        frameRate: 30,
        scenes: [
          {
            sceneId: 'scene-1',
            order: 0,
            durationMs: 3000,
            visual: {
              type: 'solid_color',
              color: '#2c3e50',
            },
            audioPath,
            subtitles: [],
          },
        ],
      };

      const result = await client.compose(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.outputPath).toBe(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
      }
    });

    it('should compose with BGM', async () => {
      // Create a test BGM file
      const bgmPath = path.join(tempDir, 'test_bgm.mp3');
      createTestAudio(bgmPath, 5);

      const outputPath = path.join(tempDir, 'bgm_output.mp4');

      const params: VideoComposeParams = {
        outputPath,
        width: 1080,
        height: 1920,
        frameRate: 30,
        bgmPath,
        bgmVolume: 0.2,
        voiceVolume: 1.0,
        scenes: [
          {
            sceneId: 'scene-1',
            order: 0,
            durationMs: 2000,
            visual: {
              type: 'solid_color',
              color: '#8e44ad',
            },
            audioPath: null,
            subtitles: [],
          },
          {
            sceneId: 'scene-2',
            order: 1,
            durationMs: 2000,
            visual: {
              type: 'solid_color',
              color: '#27ae60',
            },
            audioPath: null,
            subtitles: [],
          },
        ],
      };

      const result = await client.compose(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.outputPath).toBe(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
      }
    });

    it('should return error for empty scenes', async () => {
      const outputPath = path.join(tempDir, 'empty_scenes.mp4');

      const params: VideoComposeParams = {
        outputPath,
        width: 1080,
        height: 1920,
        scenes: [],
      };

      const result = await client.compose(params);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_SCENES');
      }
    });

    it('should return error for invalid dimensions', async () => {
      const outputPath = path.join(tempDir, 'invalid_dims.mp4');

      const params: VideoComposeParams = {
        outputPath,
        width: -100,
        height: 1920,
        scenes: [
          {
            sceneId: 'scene-1',
            order: 0,
            durationMs: 1000,
            visual: { type: 'solid_color', color: '#000000' },
            audioPath: null,
            subtitles: [],
          },
        ],
      };

      const result = await client.compose(params);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_DIMENSIONS');
      }
    });

    it('should return error for invalid scene duration', async () => {
      const outputPath = path.join(tempDir, 'invalid_duration.mp4');

      const params: VideoComposeParams = {
        outputPath,
        width: 1080,
        height: 1920,
        scenes: [
          {
            sceneId: 'scene-1',
            order: 0,
            durationMs: 0,
            visual: { type: 'solid_color', color: '#000000' },
            audioPath: null,
            subtitles: [],
          },
        ],
      };

      const result = await client.compose(params);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_SCENES');
      }
    });

    it('should return error for invalid solid color format', async () => {
      const outputPath = path.join(tempDir, 'invalid_color.mp4');

      const params: VideoComposeParams = {
        outputPath,
        width: 1080,
        height: 1920,
        scenes: [
          {
            sceneId: 'scene-1',
            order: 0,
            durationMs: 1000,
            visual: { type: 'solid_color', color: 'invalid' },
            audioPath: null,
            subtitles: [],
          },
        ],
      };

      const result = await client.compose(params);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_SCENES');
      }
    });

    it('should return error for missing file', async () => {
      const outputPath = path.join(tempDir, 'missing_file.mp4');

      const params: VideoComposeParams = {
        outputPath,
        width: 1080,
        height: 1920,
        scenes: [
          {
            sceneId: 'scene-1',
            order: 0,
            durationMs: 1000,
            visual: { type: 'image', filePath: '/non/existent/path.png' },
            audioPath: null,
            subtitles: [],
          },
        ],
      };

      const result = await client.compose(params);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('FILE_NOT_FOUND');
      }
    });

    it('should compose video from sample.mp4', async () => {
      const videoPath = path.join(TEST_FIXTURES_DIR, 'sample.mp4');

      // Skip if sample.mp4 doesn't exist
      if (!fs.existsSync(videoPath)) {
        console.log('Skipping video test: sample.mp4 not found');
        return;
      }

      const outputPath = path.join(tempDir, 'video_bg_output.mp4');

      const params: VideoComposeParams = {
        outputPath,
        width: 1080,
        height: 1920,
        frameRate: 30,
        scenes: [
          {
            sceneId: 'scene-1',
            order: 0,
            durationMs: 3000,
            visual: {
              type: 'video',
              filePath: videoPath,
            },
            audioPath: null,
            subtitles: [],
          },
        ],
      };

      const result = await client.compose(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.outputPath).toBe(outputPath);
        expect(fs.existsSync(outputPath)).toBe(true);
      }
    });
  });
});

/**
 * Create a test image using ffmpeg
 */
function createTestImage(outputPath: string, width: number, height: number, color: string): void {
  const colorHex = color.replace('#', '');
  execSync(
    `ffmpeg -y -f lavfi -i "color=c=0x${colorHex}:s=${width}x${height}:d=1" -vframes 1 "${outputPath}"`,
    { stdio: 'ignore' }
  );
}

/**
 * Create a subtitle image with transparent background
 */
function createSubtitleImage(
  outputPath: string,
  width: number,
  height: number,
  _text: string
): void {
  // Create a semi-transparent black rectangle as subtitle background
  execSync(
    `ffmpeg -y -f lavfi -i "color=c=0x00000080:s=${width}x${height}:d=1" -vframes 1 "${outputPath}"`,
    { stdio: 'ignore' }
  );
}

/**
 * Create a test audio file using ffmpeg
 */
function createTestAudio(outputPath: string, durationSeconds: number): void {
  execSync(
    `ffmpeg -y -f lavfi -i "sine=frequency=440:duration=${durationSeconds}" -acodec libmp3lame "${outputPath}"`,
    { stdio: 'ignore' }
  );
}
