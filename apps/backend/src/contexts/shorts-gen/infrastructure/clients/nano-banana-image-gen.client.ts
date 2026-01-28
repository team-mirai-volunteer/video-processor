import type { Result } from '@shared/domain/types/result.js';
import { err, ok } from '@shared/domain/types/result.js';
import type {
  ImageGenGateway,
  ImageGenGatewayError,
  ImageGenParams,
  ImageGenResult,
} from '../../domain/gateways/image-gen.gateway.js';

/**
 * Nano Banana API response structure
 */
interface NanoBananaResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inline_data?: {
          mime_type: string;
          data: string;
        };
      }>;
    };
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * Nano Banana API request structure
 */
interface NanoBananaRequest {
  contents: Array<{
    parts: Array<{
      text?: string;
      inline_data?: {
        mime_type: string;
        data: string;
      };
    }>;
  }>;
  generationConfig?: {
    responseModalities?: string[];
    imageConfig?: {
      aspectRatio?: string;
      imageSize?: string;
    };
  };
}

/**
 * Supported aspect ratios and their corresponding dimensions
 */
const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '3:4': { width: 768, height: 1024 },
  '4:3': { width: 1024, height: 768 },
  '2:3': { width: 683, height: 1024 },
  '3:2': { width: 1024, height: 683 },
  '4:5': { width: 820, height: 1024 },
  '5:4': { width: 1024, height: 820 },
  '21:9': { width: 2560, height: 1097 },
};

/**
 * Get aspect ratio string from width and height
 */
function getAspectRatio(width: number, height: number): string | null {
  const ratio = width / height;
  const tolerance = 0.01;

  for (const [aspectRatio, dimensions] of Object.entries(ASPECT_RATIO_DIMENSIONS)) {
    const expectedRatio = dimensions.width / dimensions.height;
    if (Math.abs(ratio - expectedRatio) < tolerance) {
      return aspectRatio;
    }
  }
  return null;
}

/**
 * Nano Banana (Gemini Image) Client
 * Google's AI image generation model available through Gemini API
 */
export class NanoBananaImageGenClient implements ImageGenGateway {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  /**
   * @param apiKey Gemini API key (defaults to NANO_BANANA_API_KEY env var)
   * @param baseUrl API base URL (defaults to NANO_BANANA_API_URL env var or Google's API)
   * @param model Model to use (defaults to gemini-2.5-flash-image)
   */
  constructor(config?: { apiKey?: string; baseUrl?: string; model?: string }) {
    this.apiKey = config?.apiKey ?? process.env.NANO_BANANA_API_KEY ?? '';
    this.baseUrl =
      config?.baseUrl ??
      process.env.NANO_BANANA_API_URL ??
      'https://generativelanguage.googleapis.com/v1beta/models';
    this.model = config?.model ?? 'gemini-2.5-flash-image';

    if (!this.apiKey) {
      throw new Error('NANO_BANANA_API_KEY environment variable is required');
    }
  }

  /**
   * Generate an image from a text prompt
   */
  async generate(params: ImageGenParams): Promise<Result<ImageGenResult, ImageGenGatewayError>> {
    // Validate dimensions
    const aspectRatio = getAspectRatio(params.width, params.height);
    if (!aspectRatio) {
      return err({
        type: 'INVALID_DIMENSIONS',
        message: `Unsupported dimensions: ${params.width}x${params.height}. Supported aspect ratios: ${Object.keys(ASPECT_RATIO_DIMENSIONS).join(', ')}`,
      });
    }

    // Build prompt
    let fullPrompt = params.prompt;
    if (params.negativePrompt) {
      fullPrompt += `\n\nAvoid: ${params.negativePrompt}`;
    }
    if (params.style) {
      fullPrompt = `${params.style} style: ${fullPrompt}`;
    }

    // Determine image size based on dimensions
    let imageSize: string | undefined;
    const maxDimension = Math.max(params.width, params.height);
    if (maxDimension >= 3840) {
      imageSize = '4K';
    } else if (maxDimension >= 1920) {
      imageSize = '2K';
    } else {
      imageSize = '1K';
    }

    // Build request
    const request: NanoBananaRequest = {
      contents: [
        {
          parts: [{ text: fullPrompt }],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio,
          imageSize,
        },
      },
    };

    try {
      const url = `${this.baseUrl}/${this.model}:generateContent`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(request),
      });

      const data = (await response.json()) as NanoBananaResponse;

      // Handle API errors
      if (data.error) {
        return this.handleApiError(data.error);
      }

      if (!response.ok) {
        return err({
          type: 'API_ERROR',
          statusCode: response.status,
          message: `HTTP ${response.status}: ${response.statusText}`,
        });
      }

      // Extract image from response
      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts;

      if (!parts || parts.length === 0) {
        return err({
          type: 'GENERATION_FAILED',
          message: 'No image generated in response',
        });
      }

      // Find image data in parts
      const imagePart = parts.find((part) => part.inline_data);
      if (!imagePart?.inline_data) {
        return err({
          type: 'GENERATION_FAILED',
          message: 'No image data found in response',
        });
      }

      const { mime_type, data: base64Data } = imagePart.inline_data;
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Determine format from mime type
      const format = mime_type.split('/')[1] || 'png';

      return ok({
        imageBuffer,
        format,
        width: params.width,
        height: params.height,
        seed: params.seed,
        revisedPrompt: undefined,
      });
    } catch (error) {
      if (error instanceof Error) {
        // Check for network errors
        if (error.message.includes('fetch')) {
          return err({
            type: 'API_ERROR',
            statusCode: 0,
            message: `Network error: ${error.message}`,
          });
        }
      }

      return err({
        type: 'GENERATION_FAILED',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle API error responses
   */
  private handleApiError(error: {
    code: number;
    message: string;
    status: string;
  }): Result<ImageGenResult, ImageGenGatewayError> {
    // Rate limit
    if (error.code === 429) {
      const retryMatch = error.message.match(/retry after (\d+)/i);
      const retryAfterMs = retryMatch?.[1] ? Number.parseInt(retryMatch[1], 10) * 1000 : undefined;
      return err({
        type: 'RATE_LIMIT_EXCEEDED',
        retryAfterMs,
      });
    }

    // Content policy violation
    if (
      error.code === 400 &&
      (error.message.toLowerCase().includes('safety') ||
        error.message.toLowerCase().includes('policy') ||
        error.message.toLowerCase().includes('blocked'))
    ) {
      return err({
        type: 'CONTENT_POLICY_VIOLATION',
        message: error.message,
      });
    }

    // Invalid prompt
    if (error.code === 400 && error.message.toLowerCase().includes('prompt')) {
      return err({
        type: 'INVALID_PROMPT',
        message: error.message,
      });
    }

    // Generic API error
    return err({
      type: 'API_ERROR',
      statusCode: error.code,
      message: error.message,
    });
  }

  /**
   * Get supported image dimensions
   */
  getSupportedDimensions(): { width: number; height: number }[] {
    return Object.values(ASPECT_RATIO_DIMENSIONS);
  }

  /**
   * Get supported styles
   * Nano Banana supports style through prompt engineering rather than explicit parameters
   */
  getSupportedStyles(): string[] {
    return [
      'photorealistic',
      'anime',
      'digital art',
      'oil painting',
      'watercolor',
      'sketch',
      'cartoon',
      '3D render',
      'pixel art',
      'impressionist',
    ];
  }
}
