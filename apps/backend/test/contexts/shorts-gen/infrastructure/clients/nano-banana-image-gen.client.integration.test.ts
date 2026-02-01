import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { NanoBananaImageGenClient } from '../../../../../src/contexts/shorts-gen/infrastructure/clients/nano-banana-image-gen.client.js';

const FIXTURES_DIR = path.join(__dirname, '../../fixtures');
const OUTPUT_DIR = path.join(FIXTURES_DIR, 'output/nano-banana');

/**
 * Check if Gemini API key is configured
 */
function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

// Skip integration tests if INTEGRATION_TEST is not set or API key is not available
const runIntegrationTests = process.env.INTEGRATION_TEST === 'true' && isGeminiConfigured();

describe.skipIf(!runIntegrationTests)('NanoBananaImageGenClient Integration', () => {
  let client: NanoBananaImageGenClient;

  beforeAll(async () => {
    client = new NanoBananaImageGenClient();

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  });

  describe('generate', () => {
    it('should generate an image from a simple prompt', async () => {
      const result = await client.generate({
        prompt: 'A cute cat sitting on a windowsill, looking outside at falling snow',
        width: 1024,
        height: 1024,
      });

      if (!result.success) {
        console.error('Image generation failed:', result.error);
      }
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.imageBuffer).toBeInstanceOf(Buffer);
        expect(result.value.imageBuffer.length).toBeGreaterThan(0);
        expect(['png', 'jpeg', 'jpg', 'webp']).toContain(result.value.format);
        expect(result.value.width).toBe(1024);
        expect(result.value.height).toBe(1024);

        // Save image for manual inspection
        const outputPath = path.join(OUTPUT_DIR, `test-image-1x1.${result.value.format}`);
        await fs.promises.writeFile(outputPath, result.value.imageBuffer);
        console.log(`Generated image saved to: ${outputPath}`);
      }
    }, 60000); // 60 second timeout for API call

    it('should generate a vertical (9:16) image for shorts', async () => {
      const result = await client.generate({
        prompt: 'A beautiful sunset over mountains with vibrant orange and purple colors',
        width: 1080,
        height: 1920,
      });

      if (!result.success) {
        console.error('9:16 image generation failed:', result.error);
      }
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.imageBuffer).toBeInstanceOf(Buffer);
        expect(result.value.imageBuffer.length).toBeGreaterThan(0);
        expect(result.value.width).toBe(1080);
        expect(result.value.height).toBe(1920);

        // Save image for manual inspection
        const outputPath = path.join(OUTPUT_DIR, `test-image-9x16.${result.value.format}`);
        await fs.promises.writeFile(outputPath, result.value.imageBuffer);
        console.log(`Generated image saved to: ${outputPath}`);
      }
    }, 60000);

    it('should apply style to image generation', async () => {
      const result = await client.generate({
        prompt: 'A cozy coffee shop interior',
        width: 1024,
        height: 1024,
        style: 'anime',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.imageBuffer).toBeInstanceOf(Buffer);
        expect(result.value.imageBuffer.length).toBeGreaterThan(0);

        // Save image for manual inspection
        const outputPath = path.join(OUTPUT_DIR, `test-image-anime.${result.value.format}`);
        await fs.promises.writeFile(outputPath, result.value.imageBuffer);
        console.log(`Generated image saved to: ${outputPath}`);
      }
    }, 60000);

    it('should handle negative prompt', async () => {
      const result = await client.generate({
        prompt: 'A serene forest landscape',
        negativePrompt: 'people, buildings, cars',
        width: 1024,
        height: 768,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.imageBuffer).toBeInstanceOf(Buffer);
        expect(result.value.imageBuffer.length).toBeGreaterThan(0);

        // Save image for manual inspection
        const outputPath = path.join(OUTPUT_DIR, `test-image-negative.${result.value.format}`);
        await fs.promises.writeFile(outputPath, result.value.imageBuffer);
        console.log(`Generated image saved to: ${outputPath}`);
      }
    }, 60000);

    it('should return INVALID_DIMENSIONS error for unsupported dimensions', async () => {
      const result = await client.generate({
        prompt: 'A test image',
        width: 123,
        height: 456,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_DIMENSIONS');
      }
    });

    it('should generate image with reference image from fixture', async () => {
      // fixture画像を読み込み
      const referenceImagePath = path.join(FIXTURES_DIR, 'input/images/scene1.png');
      const referenceImageBuffer = await fs.promises.readFile(referenceImagePath);

      // 参照画像のスタイルを引き継いで新しい画像を生成
      const result = await client.generate({
        prompt: 'A similar night sky scene with a full moon over mountains',
        width: 1080,
        height: 1920,
        referenceImages: [
          {
            imageBuffer: referenceImageBuffer,
            mimeType: 'image/png',
          },
        ],
      });

      if (!result.success) {
        console.error('Reference image generation failed:', result.error);
      }
      expect(result.success).toBe(true);
      if (result.success) {
        // 出力を保存して目視確認可能に
        const outputPath = path.join(OUTPUT_DIR, `test-reference-single.${result.value.format}`);
        await fs.promises.writeFile(outputPath, result.value.imageBuffer);
        console.log(`Generated image with reference saved to: ${outputPath}`);
      }
    }, 60000);

    it('should generate image with multiple reference images from fixtures', async () => {
      // 複数のfixture画像を読み込み
      const ref1 = await fs.promises.readFile(path.join(FIXTURES_DIR, 'input/images/scene1.png'));
      const ref2 = await fs.promises.readFile(path.join(FIXTURES_DIR, 'input/images/scene2.png'));

      const result = await client.generate({
        prompt: 'A new scene combining the visual style of these reference images',
        width: 1080,
        height: 1920,
        referenceImages: [
          { imageBuffer: ref1, mimeType: 'image/png' },
          { imageBuffer: ref2, mimeType: 'image/png' },
        ],
      });

      if (!result.success) {
        console.error('Multiple reference image generation failed:', result.error);
      }
      expect(result.success).toBe(true);
      if (result.success) {
        const outputPath = path.join(OUTPUT_DIR, `test-reference-multiple.${result.value.format}`);
        await fs.promises.writeFile(outputPath, result.value.imageBuffer);
        console.log(`Generated image with multiple references saved to: ${outputPath}`);
      }
    }, 60000);

    it('should work with empty reference images array', async () => {
      const result = await client.generate({
        prompt: 'A simple test image of a blue circle',
        width: 1024,
        height: 1024,
        referenceImages: [], // 空配列
      });

      if (!result.success) {
        console.error('Empty reference images generation failed:', result.error);
      }
      expect(result.success).toBe(true);
      if (result.success) {
        const outputPath = path.join(OUTPUT_DIR, `test-reference-empty.${result.value.format}`);
        await fs.promises.writeFile(outputPath, result.value.imageBuffer);
        console.log(`Generated image with empty references saved to: ${outputPath}`);
      }
    }, 60000);
  });

  describe('getSupportedDimensions', () => {
    it('should return an array of supported dimensions', () => {
      const dimensions = client.getSupportedDimensions();

      expect(Array.isArray(dimensions)).toBe(true);
      expect(dimensions.length).toBeGreaterThan(0);

      // Check that 9:16 (shorts) ratio is supported
      const has9x16 = dimensions.some((d) => d.width === 1080 && d.height === 1920);
      expect(has9x16).toBe(true);

      // Check that 1:1 ratio is supported
      const has1x1 = dimensions.some((d) => d.width === 1024 && d.height === 1024);
      expect(has1x1).toBe(true);

      // All dimensions should have positive values
      for (const dim of dimensions) {
        expect(dim.width).toBeGreaterThan(0);
        expect(dim.height).toBeGreaterThan(0);
      }
    });
  });

  describe('getSupportedStyles', () => {
    it('should return an array of supported styles', () => {
      const styles = client.getSupportedStyles();

      expect(Array.isArray(styles)).toBe(true);
      expect(styles.length).toBeGreaterThan(0);

      // Check for common styles
      expect(styles).toContain('photorealistic');
      expect(styles).toContain('anime');
      expect(styles).toContain('digital art');

      // All styles should be non-empty strings
      for (const style of styles) {
        expect(typeof style).toBe('string');
        expect(style.length).toBeGreaterThan(0);
      }
    });
  });
});

describe('NanoBananaImageGenClient Unit Tests', () => {
  describe('constructor', () => {
    it('should throw error when API key is not provided', () => {
      const originalEnv = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = '';

      expect(() => new NanoBananaImageGenClient()).toThrow(
        'GEMINI_API_KEY environment variable is required'
      );

      process.env.GEMINI_API_KEY = originalEnv;
    });

    it('should accept API key via constructor config', () => {
      expect(
        () =>
          new NanoBananaImageGenClient({
            apiKey: 'test-api-key',
          })
      ).not.toThrow();
    });

    it('should accept custom base URL via constructor config', () => {
      const client = new NanoBananaImageGenClient({
        apiKey: 'test-api-key',
        baseUrl: 'https://custom-api.example.com',
      });

      expect(client).toBeInstanceOf(NanoBananaImageGenClient);
    });

    it('should accept custom model via constructor config', () => {
      const client = new NanoBananaImageGenClient({
        apiKey: 'test-api-key',
        model: 'gemini-3-pro-image-preview',
      });

      expect(client).toBeInstanceOf(NanoBananaImageGenClient);
    });
  });

  describe('getSupportedDimensions without API', () => {
    it('should return supported dimensions without making API calls', () => {
      const client = new NanoBananaImageGenClient({ apiKey: 'test-key' });
      const dimensions = client.getSupportedDimensions();

      expect(dimensions.length).toBeGreaterThan(0);
      expect(dimensions).toContainEqual({ width: 1024, height: 1024 });
      expect(dimensions).toContainEqual({ width: 1080, height: 1920 });
    });
  });

  describe('getSupportedStyles without API', () => {
    it('should return supported styles without making API calls', () => {
      const client = new NanoBananaImageGenClient({ apiKey: 'test-key' });
      const styles = client.getSupportedStyles();

      expect(styles.length).toBeGreaterThan(0);
      expect(styles).toContain('photorealistic');
    });
  });

  describe('reference images validation', () => {
    it('should return INVALID_PROMPT error when too many reference images are provided', async () => {
      const client = new NanoBananaImageGenClient({ apiKey: 'test-key' });

      // Create 4 dummy reference images (exceeds MAX_REFERENCE_IMAGES of 3)
      const dummyBuffer = Buffer.from('dummy image data');
      const result = await client.generate({
        prompt: 'A test image',
        width: 1024,
        height: 1024,
        referenceImages: [
          { imageBuffer: dummyBuffer, mimeType: 'image/png' },
          { imageBuffer: dummyBuffer, mimeType: 'image/png' },
          { imageBuffer: dummyBuffer, mimeType: 'image/png' },
          { imageBuffer: dummyBuffer, mimeType: 'image/png' },
        ],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_PROMPT');
        if (result.error.type === 'INVALID_PROMPT') {
          expect(result.error.message).toContain('Too many reference images');
        }
      }
    });
  });
});
