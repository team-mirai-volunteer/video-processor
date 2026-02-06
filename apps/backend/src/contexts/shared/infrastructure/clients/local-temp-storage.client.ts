import * as fs from 'node:fs';
import * as path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type {
  TempStorageGateway,
  TempStorageStreamUploadParams,
  TempStorageUploadParams,
  TempStorageUploadResult,
} from '@shared/domain/gateways/temp-storage.gateway.js';

/**
 * Local file system implementation of TempStorageGateway for local development and testing.
 *
 * Files are stored as:
 *   {baseDir}/videos/{videoId}/original.mp4
 *
 * URI format: local://{baseDir}/videos/{videoId}/original.mp4
 */
export class LocalTempStorageClient implements TempStorageGateway {
  private readonly baseDir: string;
  private readonly expirationDays: number;

  constructor(baseDir?: string, expirationDays?: number) {
    this.baseDir = baseDir ?? process.env.LOCAL_TEMP_STORAGE_DIR ?? '/tmp/video-processor-cache';
    this.expirationDays = expirationDays ?? 7;
  }

  /**
   * Upload video to local temporary storage
   */
  async upload(params: TempStorageUploadParams): Promise<TempStorageUploadResult> {
    const videoDir = path.join(this.baseDir, 'videos', params.videoId);
    const filePath = path.join(videoDir, 'original.mp4');

    // Create directory structure
    await fs.promises.mkdir(videoDir, { recursive: true });

    // Write file
    await fs.promises.writeFile(filePath, params.content);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.expirationDays);

    return {
      gcsUri: `local://${filePath}`,
      expiresAt,
    };
  }

  /**
   * Upload video to local temporary storage from a stream
   */
  async uploadFromStream(
    params: TempStorageStreamUploadParams,
    source: NodeJS.ReadableStream
  ): Promise<TempStorageUploadResult> {
    const fileName = params.path ?? 'original.mp4';
    const videoDir = path.join(this.baseDir, 'videos', params.videoId);
    const filePath = path.join(videoDir, fileName);

    // Create directory structure
    await fs.promises.mkdir(videoDir, { recursive: true });

    // Write file from stream
    const writeStream = fs.createWriteStream(filePath);
    await pipeline(source, writeStream);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.expirationDays);

    return {
      gcsUri: `local://${filePath}`,
      expiresAt,
    };
  }

  /**
   * Upload video to local temporary storage from a stream with progress tracking
   */
  async uploadFromStreamWithProgress(
    params: TempStorageStreamUploadParams,
    source: NodeJS.ReadableStream,
    onProgress?: (bytesTransferred: number) => void
  ): Promise<TempStorageUploadResult> {
    const fileName = params.path ?? 'original.mp4';
    const videoDir = path.join(this.baseDir, 'videos', params.videoId);
    const filePath = path.join(videoDir, fileName);

    // Create directory structure
    await fs.promises.mkdir(videoDir, { recursive: true });

    // Create progress tracking transform stream
    let bytesTransferred = 0;
    const progressTracker = new Transform({
      transform(chunk, _encoding, callback) {
        bytesTransferred += chunk.length;
        onProgress?.(bytesTransferred);
        this.push(chunk);
        callback();
      },
    });

    // Write file from stream with progress tracking
    const writeStream = fs.createWriteStream(filePath);
    await pipeline(source, progressTracker, writeStream);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.expirationDays);

    return {
      gcsUri: `local://${filePath}`,
      expiresAt,
    };
  }

  /**
   * Download video from local temporary storage
   */
  async download(gcsUri: string): Promise<Buffer> {
    const filePath = this.parseUri(gcsUri);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${gcsUri}`);
    }

    return fs.promises.readFile(filePath);
  }

  /**
   * Download video as a stream from local temporary storage
   */
  downloadAsStream(gcsUri: string): NodeJS.ReadableStream {
    const filePath = this.parseUri(gcsUri);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${gcsUri}`);
    }

    return fs.createReadStream(filePath);
  }

  /**
   * Get the file size in bytes
   */
  async getFileSize(gcsUri: string): Promise<number> {
    const filePath = this.parseUri(gcsUri);
    const stats = await fs.promises.stat(filePath);
    return stats.size;
  }

  /**
   * Check if video exists in local temporary storage
   */
  async exists(gcsUri: string): Promise<boolean> {
    try {
      const filePath = this.parseUri(gcsUri);
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  /**
   * Parse local URI to file path
   * Supports both local:// URIs and gs:// URIs (for compatibility)
   */
  private parseUri(uri: string): string {
    // Handle local:// URI
    if (uri.startsWith('local://')) {
      return uri.slice('local://'.length);
    }

    // Handle gs:// URI (for backwards compatibility with existing data)
    if (uri.startsWith('gs://')) {
      // Extract the path portion and map it to local storage
      // gs://bucket/videos/{videoId}/original.mp4 -> {baseDir}/videos/{videoId}/original.mp4
      const match = uri.match(/^gs:\/\/[^/]+\/(.+)$/);
      if (match?.[1]) {
        return path.join(this.baseDir, match[1]);
      }
    }

    throw new Error(`Invalid URI: ${uri}`);
  }

  /**
   * Clear all files in the cache directory.
   * Useful for test cleanup.
   */
  async clear(): Promise<void> {
    if (!fs.existsSync(this.baseDir)) {
      return;
    }

    await fs.promises.rm(this.baseDir, { recursive: true, force: true });
  }

  /**
   * Get the base directory for this client.
   * Useful for testing.
   */
  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * Generate a URL for accessing local files
   * For local development, returns a URL through the backend's local file server endpoint
   * @param uri Local URI (local:// format) or GCS URI (gs:// format for compatibility)
   * @param _expiresInMinutes Ignored for local storage (no expiration needed)
   * @returns URL accessible via backend's local file server
   */
  async getSignedUrl(uri: string, _expiresInMinutes?: number): Promise<string> {
    const filePath = this.parseUri(uri);
    // Return URL through backend's local file server endpoint
    // The path is encoded to handle special characters
    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001';
    return `${backendUrl}/api/local-files?path=${encodeURIComponent(filePath)}`;
  }
}
