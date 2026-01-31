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
 * Parameters for stream uploading to temporary storage
 */
export interface TempStorageStreamUploadParams {
  videoId: string;
  contentType?: string;
  /** Custom path within video directory (e.g., 'audio.flac'). Defaults to 'original.mp4' */
  path?: string;
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
   * Upload video to temporary storage from a stream
   * Use this for large files to avoid memory issues
   * @returns GCS URI and expiration date
   */
  uploadFromStream(
    params: TempStorageStreamUploadParams,
    source: NodeJS.ReadableStream
  ): Promise<TempStorageUploadResult>;

  /**
   * Upload video to temporary storage from a stream with progress tracking
   * Use this for large files when progress reporting is needed
   * @param onProgress Callback that receives bytes transferred so far
   * @returns GCS URI and expiration date
   */
  uploadFromStreamWithProgress(
    params: TempStorageStreamUploadParams,
    source: NodeJS.ReadableStream,
    onProgress?: (bytesTransferred: number) => void
  ): Promise<TempStorageUploadResult>;

  /**
   * Download video from temporary storage
   * @param gcsUri GCS URI of the video
   * @returns Video buffer
   */
  download(gcsUri: string): Promise<Buffer>;

  /**
   * Download video as a stream from temporary storage
   * Use this for large files to avoid memory issues
   * @param gcsUri GCS URI of the video
   * @returns Readable stream
   */
  downloadAsStream(gcsUri: string): NodeJS.ReadableStream;

  /**
   * Check if video exists in temporary storage
   * @param gcsUri GCS URI to check
   */
  exists(gcsUri: string): Promise<boolean>;

  /**
   * Generate a signed URL from a GCS URI
   * @param gcsUri GCS URI (gs://bucket/path format)
   * @param expiresInMinutes Expiration time in minutes (default: 60)
   * @returns Signed HTTPS URL for browser access
   */
  getSignedUrl(gcsUri: string, expiresInMinutes?: number): Promise<string>;
}
