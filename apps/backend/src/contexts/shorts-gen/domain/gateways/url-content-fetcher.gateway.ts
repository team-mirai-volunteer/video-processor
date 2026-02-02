import type { Result } from '@shared/domain/types/result.js';

/**
 * URL コンテンツ取得リクエストパラメータ
 */
export interface UrlContentFetchParams {
  /** 取得するURL */
  url: string;
}

/**
 * URL コンテンツ取得結果
 */
export interface UrlContentFetchResult {
  /** 取得したコンテンツ（Markdown形式） */
  content: string;
}

/**
 * URL Content Fetcher Gateway エラー
 */
export type UrlContentFetcherGatewayError =
  | { type: 'INVALID_URL'; message: string }
  | { type: 'FETCH_FAILED'; statusCode: number; message: string }
  | { type: 'NETWORK_ERROR'; message: string }
  | { type: 'TIMEOUT'; message: string };

/**
 * URL Content Fetcher Gateway
 * URLからWebページの内容を取得するインターフェース
 */
export interface UrlContentFetcherGateway {
  /**
   * URLからコンテンツを取得する
   * @param params 取得パラメータ
   * @returns 取得結果またはエラー
   */
  fetchContent(
    params: UrlContentFetchParams
  ): Promise<Result<UrlContentFetchResult, UrlContentFetcherGatewayError>>;
}
