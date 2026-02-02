import type { Result } from '@shared/domain/types/result.js';
import { err, ok } from '@shared/domain/types/result.js';
import { createLogger } from '@shared/infrastructure/logging/logger.js';
import type {
  TtsGateway,
  TtsGatewayError,
  TtsSynthesizeParams,
  TtsSynthesizeResult,
} from '../../domain/gateways/tts.gateway.js';

const log = createLogger('FishAudioTtsClient');

/**
 * Fish Audio TTS API response content type
 */
type AudioFormat = 'mp3' | 'wav' | 'pcm' | 'opus';

/**
 * Fish Audio TTS API request body
 */
interface FishAudioTtsRequest {
  text: string;
  reference_id?: string;
  format?: AudioFormat;
  mp3_bitrate?: number;
  opus_bitrate?: number;
  latency?: 'normal' | 'balanced';
  streaming?: boolean;
  normalize?: boolean;
  chunk_length?: number;
  max_new_tokens?: number;
  top_p?: number;
  repetition_penalty?: number;
  temperature?: number;
  prosody?: {
    speed?: number;
    volume?: number;
  };
}

/**
 * Fish Audio TTS Client configuration
 */
export interface FishAudioTtsClientConfig {
  apiKey?: string;
  apiUrl?: string;
  defaultVoiceModelId?: string;
  format?: AudioFormat;
  knownVoiceModels?: string[];
  /** Maximum number of retries on rate limit or server errors (default: 3) */
  maxRetries?: number;
  /** Initial retry delay in milliseconds (default: 1000) */
  initialRetryDelayMs?: number;
}

/**
 * Default API URL for Fish Audio
 */
const DEFAULT_API_URL = 'https://api.fish.audio';

/**
 * Default audio format
 */
const DEFAULT_FORMAT: AudioFormat = 'mp3';

/**
 * Default voice model ID (Fish Audio public model)
 */
const DEFAULT_VOICE_MODEL_ID = 'e58b0d7efca34eb38d5c4985e378abcb';

/**
 * Default maximum number of retries
 */
const DEFAULT_MAX_RETRIES = 3;

/**
 * Default initial retry delay in milliseconds
 */
const DEFAULT_INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Fish Audio TTS Client
 * Implements the TtsGateway interface using Fish Audio API
 */
export class FishAudioTtsClient implements TtsGateway {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly defaultVoiceModelId: string;
  private readonly format: AudioFormat;
  private readonly knownVoiceModels: string[];
  private readonly maxRetries: number;
  private readonly initialRetryDelayMs: number;

  constructor(config: FishAudioTtsClientConfig = {}) {
    const apiKey = config.apiKey || process.env.FISH_AUDIO_API_KEY;
    if (!apiKey) {
      throw new Error('FISH_AUDIO_API_KEY environment variable is required');
    }

    this.apiKey = apiKey;
    this.apiUrl = config.apiUrl ?? process.env.FISH_AUDIO_API_URL ?? DEFAULT_API_URL;
    this.defaultVoiceModelId =
      config.defaultVoiceModelId ??
      process.env.FISH_AUDIO_DEFAULT_VOICE_MODEL_ID ??
      DEFAULT_VOICE_MODEL_ID;
    this.format = config.format ?? DEFAULT_FORMAT;
    this.knownVoiceModels = config.knownVoiceModels ?? [];
    this.maxRetries =
      config.maxRetries ??
      (process.env.FISH_AUDIO_MAX_RETRIES
        ? Number.parseInt(process.env.FISH_AUDIO_MAX_RETRIES, 10)
        : DEFAULT_MAX_RETRIES);
    this.initialRetryDelayMs =
      config.initialRetryDelayMs ??
      (process.env.FISH_AUDIO_INITIAL_RETRY_DELAY_MS
        ? Number.parseInt(process.env.FISH_AUDIO_INITIAL_RETRY_DELAY_MS, 10)
        : DEFAULT_INITIAL_RETRY_DELAY_MS);
  }

  /**
   * Synthesize speech from text using Fish Audio TTS API
   * Includes exponential backoff retry logic for rate limits and server errors
   */
  async synthesize(
    params: TtsSynthesizeParams
  ): Promise<Result<TtsSynthesizeResult, TtsGatewayError>> {
    // Validate text
    if (!params.text || params.text.trim().length === 0) {
      return err({
        type: 'INVALID_TEXT',
        message: 'Text cannot be empty',
      });
    }

    const voiceModelId = params.voiceModelId ?? this.defaultVoiceModelId;

    // Build request body
    const requestBody: FishAudioTtsRequest = {
      text: params.text,
      reference_id: voiceModelId,
      format: this.format,
      latency: 'balanced',
      streaming: false,
    };

    // Add speed if specified
    if (params.speed !== undefined && params.speed !== null) {
      requestBody.prosody = {
        speed: params.speed,
      };
    }

    let lastError: TtsGatewayError | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      // Wait before retry (skip on first attempt)
      if (attempt > 0) {
        const delay =
          lastError?.type === 'RATE_LIMIT_EXCEEDED' && lastError.retryAfterMs
            ? lastError.retryAfterMs
            : this.initialRetryDelayMs * 2 ** (attempt - 1);

        log.info(`Retrying synthesis (attempt ${attempt}/${this.maxRetries}) after ${delay}ms`, {
          voiceModelId,
          textLength: params.text.length,
        });
        await this.sleep(delay);
      }

      try {
        const response = await fetch(`${this.apiUrl}/v1/tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        // Handle error responses
        if (!response.ok) {
          const errorResult = await this.handleErrorResponse(response, voiceModelId);

          if (!errorResult.success) {
            lastError = errorResult.error;

            // Check if error is retryable and we have retries left
            if (this.isRetryableError(lastError) && attempt < this.maxRetries) {
              log.warn('Retryable error occurred, will retry', {
                errorType: lastError.type,
                attempt,
                maxRetries: this.maxRetries,
              });
              continue;
            }

            return errorResult;
          }
        }

        // Get audio data as buffer
        const audioBuffer = Buffer.from(await response.arrayBuffer());

        // Calculate duration from audio data
        const durationMs = this.estimateDurationFromBuffer(audioBuffer);

        if (attempt > 0) {
          log.info(`Synthesis succeeded after ${attempt} retries`, { voiceModelId });
        }

        return ok({
          audioBuffer,
          durationMs,
          format: this.format,
          sampleRate: this.getSampleRateForFormat(this.format),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check for rate limit or network errors
        if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
          lastError = {
            type: 'RATE_LIMIT_EXCEEDED',
            retryAfterMs: 60000,
          };
        } else {
          lastError = {
            type: 'SYNTHESIS_FAILED',
            message: errorMessage,
          };
        }

        // Network errors are retryable
        if (attempt < this.maxRetries) {
          log.warn('Network error occurred, will retry', {
            errorMessage,
            attempt,
            maxRetries: this.maxRetries,
          });
          continue;
        }

        return err(lastError);
      }
    }

    // All retries exhausted
    return err(lastError || { type: 'SYNTHESIS_FAILED', message: 'Unknown error after retries' });
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: TtsGatewayError): boolean {
    return (
      error.type === 'RATE_LIMIT_EXCEEDED' ||
      (error.type === 'API_ERROR' && error.statusCode !== undefined && error.statusCode >= 500)
    );
  }

  /**
   * Sleep for the specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * List available voice models
   * Note: Fish Audio doesn't provide a direct API to list all available models.
   * This returns the known/configured voice models.
   */
  async listVoiceModels(): Promise<string[]> {
    // Return known voice models including the default
    const models = new Set([this.defaultVoiceModelId, ...this.knownVoiceModels]);
    return Array.from(models);
  }

  /**
   * Check if a voice model is available
   * Since Fish Audio validates model IDs during synthesis,
   * we can only check against known models or assume availability.
   */
  async isVoiceModelAvailable(modelId: string): Promise<boolean> {
    // Check against known models
    if (modelId === this.defaultVoiceModelId || this.knownVoiceModels.includes(modelId)) {
      return true;
    }

    // For unknown models, we assume they might be valid Fish Audio model IDs
    // The actual validation will happen during synthesis
    return true;
  }

  /**
   * Handle error responses from Fish Audio API
   */
  private async handleErrorResponse(
    response: Response,
    voiceModelId: string
  ): Promise<Result<TtsSynthesizeResult, TtsGatewayError>> {
    const statusCode = response.status;

    // Try to parse error message
    let errorMessage = '';
    try {
      const errorBody = (await response.json()) as { message?: string; error?: string };
      errorMessage = errorBody.message ?? errorBody.error ?? JSON.stringify(errorBody);
    } catch {
      errorMessage = response.statusText;
    }

    // Map status codes to specific error types
    switch (statusCode) {
      case 400:
        // Bad request - could be invalid text or parameters
        return err({
          type: 'INVALID_TEXT',
          message: errorMessage,
        });

      case 401:
      case 403:
        return err({
          type: 'API_ERROR',
          statusCode,
          message: `Authentication failed: ${errorMessage}`,
        });

      case 404:
        // Voice model not found
        return err({
          type: 'VOICE_MODEL_NOT_FOUND',
          modelId: voiceModelId,
        });

      case 429: {
        // Rate limit exceeded
        const retryAfter = response.headers.get('Retry-After');
        return err({
          type: 'RATE_LIMIT_EXCEEDED',
          retryAfterMs: retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : 60000,
        });
      }

      default:
        return err({
          type: 'API_ERROR',
          statusCode,
          message: errorMessage,
        });
    }
  }

  /**
   * Estimate audio duration from buffer
   * For MP3, we estimate based on bitrate (128kbps default)
   */
  private estimateDurationFromBuffer(buffer: Buffer): number {
    const sizeInBits = buffer.length * 8;

    switch (this.format) {
      case 'mp3':
        // Assume 128kbps for MP3
        return Math.round((sizeInBits / 128000) * 1000);

      case 'wav':
        // WAV: 16-bit stereo at 44100Hz = 1411200 bps
        // But Fish Audio likely uses mono 16-bit, so 705600 bps at 44100Hz
        // Or mono 16-bit at 22050Hz = 352800 bps
        return Math.round((sizeInBits / 352800) * 1000);

      case 'opus':
        // Assume ~64kbps for Opus
        return Math.round((sizeInBits / 64000) * 1000);

      case 'pcm':
        // Assume 16-bit mono at 22050Hz = 352800 bps
        return Math.round((sizeInBits / 352800) * 1000);

      default:
        // Fallback: assume 128kbps
        return Math.round((sizeInBits / 128000) * 1000);
    }
  }

  /**
   * Get the sample rate for a given format
   */
  private getSampleRateForFormat(format: AudioFormat): number {
    switch (format) {
      case 'wav':
      case 'pcm':
        return 22050;
      case 'mp3':
        return 44100;
      case 'opus':
        return 48000;
      default:
        return 44100;
    }
  }
}
