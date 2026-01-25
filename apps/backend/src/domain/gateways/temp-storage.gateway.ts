/**
 * Result of uploading to temporary storage
 */
export interface TempStorageUploadResult {
  gcsUri: string;
  expiresAt: Date;
}

/**
 * Parameters for uploading to temporary storage
 */
export interface TempStorageUploadParams {
  videoId: string;
  content: Buffer;
}

/**
 * Gateway for temporary video storage (GCS)
 * Videos are stored temporarily for reuse during processing
 */
export interface TempStorageGateway {
  /**
   * Upload video to temporary storage
   * @returns GCS URI and expiration date
   */
  upload(params: TempStorageUploadParams): Promise<TempStorageUploadResult>;

  /**
   * Download video from temporary storage
   * @param gcsUri GCS URI of the video
   * @returns Video buffer
   */
  download(gcsUri: string): Promise<Buffer>;

  /**
   * Check if video exists in temporary storage
   * @param gcsUri GCS URI to check
   */
  exists(gcsUri: string): Promise<boolean>;
}
