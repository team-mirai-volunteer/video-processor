import type { Result } from '@shared/domain/types/result.js';
import { err, ok } from '@shared/domain/types/result.js';
import { createLogger } from '@shared/infrastructure/logging/logger.js';
import type {
  UrlContentFetchParams,
  UrlContentFetchResult,
  UrlContentFetcherGateway,
  UrlContentFetcherGatewayError,
} from '../../domain/gateways/url-content-fetcher.gateway.js';

const log = createLogger('JinaUrlContentFetcherClient');

/**
 * Jina URL Content Fetcher Client configuration
 */
export interface JinaUrlContentFetcherClientConfig {
  /** Base URL for Jina Reader API (default: https://r.jina.ai) */
  baseUrl?: string;
  /** Maximum content length in characters (default: 15000) */
  maxContentLength?: number;
  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
}

/**
 * Default base URL for Jina Reader API
 */
const DEFAULT_BASE_URL = 'https://r.jina.ai';

/**
 * Default maximum content length
 */
const DEFAULT_MAX_CONTENT_LENGTH = 15000;

/**
 * Default timeout in milliseconds
 */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Jina URL Content Fetcher Client
 * Implements the UrlContentFetcherGateway interface using Jina Reader API
 * https://jina.ai/reader/ - URLをMarkdown形式で取得できるAPI
 */
export class JinaUrlContentFetcherClient implements UrlContentFetcherGateway {
  private readonly baseUrl: string;
  private readonly maxContentLength: number;
  private readonly timeoutMs: number;

  constructor(config: JinaUrlContentFetcherClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? process.env.JINA_READER_BASE_URL ?? DEFAULT_BASE_URL;
    this.maxContentLength =
      config.maxContentLength ??
      (process.env.JINA_READER_MAX_CONTENT_LENGTH
        ? Number.parseInt(process.env.JINA_READER_MAX_CONTENT_LENGTH, 10)
        : DEFAULT_MAX_CONTENT_LENGTH);
    this.timeoutMs =
      config.timeoutMs ??
      (process.env.JINA_READER_TIMEOUT_MS
        ? Number.parseInt(process.env.JINA_READER_TIMEOUT_MS, 10)
        : DEFAULT_TIMEOUT_MS);
  }

  /**
   * URLからコンテンツを取得する
   */
  async fetchContent(
    params: UrlContentFetchParams
  ): Promise<Result<UrlContentFetchResult, UrlContentFetcherGatewayError>> {
    // Validate URL
    if (!params.url || params.url.trim().length === 0) {
      return err({
        type: 'INVALID_URL',
        message: 'URL cannot be empty',
      });
    }

    // Basic URL validation
    try {
      new URL(params.url);
    } catch {
      return err({
        type: 'INVALID_URL',
        message: `Invalid URL format: ${params.url}`,
      });
    }

    log.info('Fetching URL content via Jina Reader', { url: params.url });

    try {
      const jinaUrl = `${this.baseUrl}/${params.url}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(jinaUrl, {
          headers: {
            Accept: 'text/plain',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          log.warn('Jina Reader API returned error', {
            url: params.url,
            status: response.status,
          });

          return err({
            type: 'FETCH_FAILED',
            statusCode: response.status,
            message: `Failed to fetch URL via Jina Reader (status: ${response.status})`,
          });
        }

        let text = await response.text();

        // Truncate if content is too long
        if (text.length > this.maxContentLength) {
          log.info('Content truncated due to length limit', {
            url: params.url,
            originalLength: text.length,
            truncatedLength: this.maxContentLength,
          });
          text = `${text.substring(0, this.maxContentLength)}\n\n... (truncated)`;
        }

        log.info('Successfully fetched URL content', {
          url: params.url,
          contentLength: text.length,
        });

        return ok({
          content: text,
        });
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === 'AbortError') {
          log.warn('Request timed out', { url: params.url, timeoutMs: this.timeoutMs });
          return err({
            type: 'TIMEOUT',
            message: `Request timed out after ${this.timeoutMs}ms`,
          });
        }

        throw error;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Network error while fetching URL', new Error(errorMessage), { url: params.url });

      return err({
        type: 'NETWORK_ERROR',
        message: errorMessage,
      });
    }
  }
}
