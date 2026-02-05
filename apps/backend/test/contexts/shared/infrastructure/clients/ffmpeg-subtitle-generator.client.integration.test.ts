import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { FFmpegSubtitleGeneratorClient } from '../../../../../src/contexts/shared/infrastructure/clients/ffmpeg-subtitle-generator.client.js';

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

const OUTPUT_DIR = path.join(__dirname, '../../fixtures/output/shared-subtitle-generator');

/**
 * Save buffer to output directory for inspection
 */
async function saveOutput(filename: string, buffer: Buffer): Promise<void> {
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_DIR, filename);
  await fs.promises.writeFile(filePath, buffer);
  console.log(`Saved: ${filePath}`);
}

/**
 * Check if buffer is a valid PNG
 */
function isPNG(buffer: Buffer): boolean {
  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return buffer.subarray(0, 8).equals(pngMagic);
}

describe.skipIf(!runIntegrationTests)('FFmpegSubtitleGeneratorClient (shared) Integration', () => {
  let client: FFmpegSubtitleGeneratorClient;

  beforeAll(async () => {
    client = new FFmpegSubtitleGeneratorClient();
    // Create output directory for inspection
    await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  });

  describe('Bold font tests', () => {
    it('should generate a PNG with default bold font (Noto Sans CJK JP Bold)', async () => {
      const result = await client.generate({
        text: '太字のテスト Bold Test',
        width: 1080,
        height: 1920,
        // Uses default style which has bold: true
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(isPNG(result.value.imageBuffer)).toBe(true);
        await saveOutput('subtitle_bold_default.png', result.value.imageBuffer);
      }
    });

    it('should generate a PNG with explicitly bold font', async () => {
      const result = await client.generate({
        text: '政治と金の問題、これは',
        width: 1080,
        height: 1920,
        style: {
          bold: true,
          fontSize: 64,
          outlineWidth: 4,
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(isPNG(result.value.imageBuffer)).toBe(true);
        await saveOutput('subtitle_bold_explicit.png', result.value.imageBuffer);
      }
    });

    it('should generate a PNG with regular (non-bold) font for comparison', async () => {
      const result = await client.generate({
        text: '政治と金の問題、これは',
        width: 1080,
        height: 1920,
        style: {
          bold: false,
          fontSize: 64,
          outlineWidth: 4,
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(isPNG(result.value.imageBuffer)).toBe(true);
        await saveOutput('subtitle_regular.png', result.value.imageBuffer);
      }
    });

    it('should generate a PNG with Black (extra bold) font', async () => {
      // Manually test Black variant
      const result = await client.generate({
        text: '政治と金の問題、これは',
        width: 1080,
        height: 1920,
        style: {
          fontFamily: 'Noto Sans CJK JP',
          bold: true,
          fontSize: 64,
          outlineWidth: 4,
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(isPNG(result.value.imageBuffer)).toBe(true);
        await saveOutput('subtitle_bold_noto.png', result.value.imageBuffer);
      }
    });
  });

  describe('Font comparison', () => {
    it('should generate multiple font weights for comparison', async () => {
      const texts = [
        { name: 'regular', fontFamily: 'Noto Sans CJK JP', bold: false },
        { name: 'bold', fontFamily: 'Noto Sans CJK JP', bold: true },
      ];

      for (const config of texts) {
        const result = await client.generate({
          text: '日本語の字幕テスト ABC',
          width: 1080,
          height: 1920,
          style: {
            fontFamily: config.fontFamily,
            bold: config.bold,
            fontSize: 64,
            outlineWidth: 4,
          },
        });

        expect(result.success).toBe(true);
        if (result.success) {
          await saveOutput(`subtitle_compare_${config.name}.png`, result.value.imageBuffer);
        }
      }
    });
  });
});
