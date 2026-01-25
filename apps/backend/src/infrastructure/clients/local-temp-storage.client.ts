import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  TempStorageGateway,
  TempStorageUploadParams,
  TempStorageUploadResult,
} from '../../domain/gateways/temp-storage.gateway.js';

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
}
