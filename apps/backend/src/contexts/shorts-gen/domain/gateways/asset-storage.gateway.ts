/**
 * アセットストレージのアップロードパラメータ
 */
export interface AssetStorageUploadParams {
  /** アセットのパス（例: 'shorts-gen/{projectId}/subtitles/{sceneId}/{index}.png'） */
  path: string;
  /** コンテンツバッファ */
  content: Buffer;
  /** コンテンツタイプ（例: 'image/png'） */
  contentType: string;
}

/**
 * アセットストレージのアップロード結果
 */
export interface AssetStorageUploadResult {
  /** 公開URL */
  url: string;
  /** GCS URI（gs://bucket/path形式） */
  gcsUri: string;
}

/**
 * Asset Storage Gateway
 * ショート動画生成で使用するアセット（画像、音声など）のストレージを管理するインターフェース
 */
export interface AssetStorageGateway {
  /**
   * アセットをアップロードする
   * @param params アップロードパラメータ
   * @returns アップロード結果
   */
  upload(params: AssetStorageUploadParams): Promise<AssetStorageUploadResult>;

  /**
   * アセットをダウンロードする
   * @param gcsUri GCS URI
   * @returns コンテンツバッファ
   */
  download(gcsUri: string): Promise<Buffer>;

  /**
   * アセットを削除する
   * @param gcsUri GCS URI
   */
  delete(gcsUri: string): Promise<void>;

  /**
   * アセットが存在するか確認する
   * @param gcsUri GCS URI
   * @returns 存在すればtrue
   */
  exists(gcsUri: string): Promise<boolean>;
}
