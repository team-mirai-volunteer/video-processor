import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { FFmpegSubtitleGeneratorClient } from '../../../../../src/contexts/shorts-gen/infrastructure/clients/ffmpeg-subtitle-generator.client.js';

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

const OUTPUT_DIR = path.join(__dirname, '../../../../fixtures/output/subtitle-generator');

/**
 * Save buffer to output directory for inspection
 */
async function saveOutput(filename: string, buffer: Buffer): Promise<void> {
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.promises.writeFile(path.join(OUTPUT_DIR, filename), buffer);
}

/**
 * Check if buffer is a valid PNG
 */
function isPNG(buffer: Buffer): boolean {
  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return buffer.subarray(0, 8).equals(pngMagic);
}

describe.skipIf(!runIntegrationTests)('FFmpegSubtitleGeneratorClient Integration', () => {
  let client: FFmpegSubtitleGeneratorClient;

  beforeAll(async () => {
    client = new FFmpegSubtitleGeneratorClient();
    // Create output directory for inspection
    await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  });

  describe('generate', () => {
    it('should generate a PNG image with subtitle text', async () => {
      const result = await client.generate({
        text: 'こんにちは世界',
        width: 1080,
        height: 1920,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.format).toBe('png');
        expect(result.value.width).toBe(1080);
        expect(result.value.height).toBe(1920);
        expect(result.value.imageBuffer.length).toBeGreaterThan(0);
        expect(isPNG(result.value.imageBuffer)).toBe(true);

        // Save for visual inspection
        await saveOutput('subtitle_basic.png', result.value.imageBuffer);
      }
    });

    it('should generate a PNG with custom vertical position', async () => {
      const result = await client.generate({
        text: 'Top positioned subtitle',
        width: 1080,
        height: 1920,
        verticalPosition: 0.2, // Near top
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(isPNG(result.value.imageBuffer)).toBe(true);
        await saveOutput('subtitle_top.png', result.value.imageBuffer);
      }
    });

    it('should generate a PNG with custom style', async () => {
      const result = await client.generate({
        text: 'Styled subtitle',
        width: 1080,
        height: 1920,
        style: {
          fontSize: 80,
          fontColor: '#FFFF00',
          outlineColor: '#FF0000',
          outlineWidth: 5,
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(isPNG(result.value.imageBuffer)).toBe(true);
        await saveOutput('subtitle_styled.png', result.value.imageBuffer);
      }
    });

    it('should generate a PNG with left alignment', async () => {
      const result = await client.generate({
        text: 'Left aligned',
        width: 1080,
        height: 1920,
        style: {
          alignment: 'left',
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(isPNG(result.value.imageBuffer)).toBe(true);
        await saveOutput('subtitle_left.png', result.value.imageBuffer);
      }
    });

    it('should generate a PNG with right alignment', async () => {
      const result = await client.generate({
        text: 'Right aligned',
        width: 1080,
        height: 1920,
        style: {
          alignment: 'right',
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(isPNG(result.value.imageBuffer)).toBe(true);
        await saveOutput('subtitle_right.png', result.value.imageBuffer);
      }
    });

    it('should handle special characters in text', async () => {
      const result = await client.generate({
        text: "Hello: World's 100% Test!",
        width: 1080,
        height: 1920,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(isPNG(result.value.imageBuffer)).toBe(true);
        await saveOutput('subtitle_special_chars.png', result.value.imageBuffer);
      }
    });

    it('should handle Japanese text with kanji', async () => {
      const result = await client.generate({
        text: '日本語の字幕テスト',
        width: 1080,
        height: 1920,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(isPNG(result.value.imageBuffer)).toBe(true);
        await saveOutput('subtitle_japanese.png', result.value.imageBuffer);
      }
    });

    it('should handle multiline text (with newline character)', async () => {
      const result = await client.generate({
        text: '一行目\n二行目',
        width: 1080,
        height: 1920,
      });

      // This may or may not work depending on FFmpeg version and filter support
      // We just verify it doesn't crash
      expect(result.success).toBe(true);
      if (result.success) {
        expect(isPNG(result.value.imageBuffer)).toBe(true);
        await saveOutput('subtitle_multiline.png', result.value.imageBuffer);
      }
    });

    it('should return INVALID_TEXT error for empty text', async () => {
      const result = await client.generate({
        text: '',
        width: 1080,
        height: 1920,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_TEXT');
      }
    });

    it('should return INVALID_TEXT error for whitespace-only text', async () => {
      const result = await client.generate({
        text: '   ',
        width: 1080,
        height: 1920,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_TEXT');
      }
    });

    it('should return INVALID_DIMENSIONS error for zero width', async () => {
      const result = await client.generate({
        text: 'Test',
        width: 0,
        height: 1920,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_DIMENSIONS');
      }
    });

    it('should return INVALID_DIMENSIONS error for negative height', async () => {
      const result = await client.generate({
        text: 'Test',
        width: 1080,
        height: -100,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_DIMENSIONS');
      }
    });

    it('should generate 16:9 landscape image', async () => {
      const result = await client.generate({
        text: 'Landscape 16:9',
        width: 1920,
        height: 1080,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.width).toBe(1920);
        expect(result.value.height).toBe(1080);
        expect(isPNG(result.value.imageBuffer)).toBe(true);
        await saveOutput('subtitle_landscape.png', result.value.imageBuffer);
      }
    });
  });

  describe('generateBatch', () => {
    it('should generate multiple subtitle images', async () => {
      const result = await client.generateBatch({
        texts: ['字幕1', '字幕2', '字幕3'],
        width: 1080,
        height: 1920,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.images.length).toBe(3);
        for (const [index, image] of result.value.images.entries()) {
          expect(image.format).toBe('png');
          expect(isPNG(image.imageBuffer)).toBe(true);
          await saveOutput(`subtitle_batch_${index + 1}.png`, image.imageBuffer);
        }
      }
    });

    it('should apply consistent style across batch', async () => {
      const result = await client.generateBatch({
        texts: ['Scene 1', 'Scene 2'],
        width: 1080,
        height: 1920,
        style: {
          fontColor: '#00FF00',
          fontSize: 72,
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.images.length).toBe(2);
        // Both images should be valid PNGs
        for (const image of result.value.images) {
          expect(isPNG(image.imageBuffer)).toBe(true);
        }
      }
    });

    it('should return error if any text is empty', async () => {
      const result = await client.generateBatch({
        texts: ['Valid', '', 'Also valid'],
        width: 1080,
        height: 1920,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_TEXT');
      }
    });

    it('should return error for invalid dimensions', async () => {
      const result = await client.generateBatch({
        texts: ['Test'],
        width: -100,
        height: 1920,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_DIMENSIONS');
      }
    });

    it('should handle empty texts array', async () => {
      const result = await client.generateBatch({
        texts: [],
        width: 1080,
        height: 1920,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.images.length).toBe(0);
      }
    });
  });

  describe('listAvailableFonts', () => {
    it('should return a list of available fonts', async () => {
      const fonts = await client.listAvailableFonts();

      expect(Array.isArray(fonts)).toBe(true);
      expect(fonts.length).toBeGreaterThan(0);

      // Check that common fonts or fallback list is returned
      console.log('Available fonts sample:', fonts.slice(0, 10));
    });

    it('should cache font list on subsequent calls', async () => {
      const fonts1 = await client.listAvailableFonts();
      const fonts2 = await client.listAvailableFonts();

      expect(fonts1).toEqual(fonts2);
    });

    it('should return fresh list after clearing cache', async () => {
      const fonts1 = await client.listAvailableFonts();
      client.clearFontCache();
      const fonts2 = await client.listAvailableFonts();

      // Should be the same content (same system fonts)
      expect(fonts1).toEqual(fonts2);
    });
  });

  describe('getDefaultStyle', () => {
    it('should return default style settings', () => {
      const style = client.getDefaultStyle();

      expect(style).toBeDefined();
      expect(style.fontFamily).toBe('Noto Sans CJK JP');
      expect(style.fontSize).toBe(64);
      expect(style.fontColor).toBe('#FFFFFF');
      expect(style.outlineColor).toBe('#000000');
      expect(style.outlineWidth).toBe(3);
      expect(style.alignment).toBe('center');
      expect(style.bold).toBe(true);
    });

    it('should return a copy, not the original object', () => {
      const style1 = client.getDefaultStyle();
      const style2 = client.getDefaultStyle();

      style1.fontSize = 999;

      expect(style2.fontSize).toBe(64);
    });
  });
});

describe('FFmpegSubtitleGeneratorClient Unit Tests', () => {
  describe('parameter validation (no FFmpeg required)', () => {
    let client: FFmpegSubtitleGeneratorClient;

    beforeAll(() => {
      client = new FFmpegSubtitleGeneratorClient();
    });

    it('should return default style without FFmpeg', () => {
      const style = client.getDefaultStyle();
      expect(style.fontFamily).toBe('Noto Sans CJK JP');
    });
  });
});
