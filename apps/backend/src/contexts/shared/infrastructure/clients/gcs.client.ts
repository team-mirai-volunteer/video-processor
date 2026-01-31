import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Storage } from '@google-cloud/storage';
import type {
  TempStorageGateway,
  TempStorageStreamUploadParams,
  TempStorageUploadParams,
  TempStorageUploadResult,
} from '@shared/domain/gateways/temp-storage.gateway.js';

/**
 * Google Cloud Storage client for temporary video storage
 */
export class GcsClient implements TempStorageGateway {
  private readonly storage: Storage;
  private readonly bucketName: string;
  private readonly expirationDays: number;

  constructor() {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? '';
    this.bucketName = process.env.VIDEO_TEMP_BUCKET ?? `${projectId}-video-processor-temp`;
    this.expirationDays = Number(process.env.VIDEO_TEMP_EXPIRATION_DAYS ?? '7');

    if (!projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required');
    }

    const credentials = this.getCredentials();
    this.storage = new Storage({
      projectId,
      credentials,
    });
  }

  private getCredentials(): { client_email: string; private_key: string } | undefined {
    // Try GOOGLE_APPLICATION_CREDENTIALS_JSON first
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (credentialsJson) {
      try {
        const credentials = JSON.parse(credentialsJson);
        return {
          client_email: credentials.client_email,
          private_key: credentials.private_key,
        };
      } catch {
        throw new Error('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON');
      }
    }

    // Fall back to individual env vars
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (clientEmail && privateKey) {
      return {
        client_email: clientEmail,
        private_key: privateKey,
      };
    }

    return undefined;
  }

  /**
   * Upload video to temporary storage
   */
  async upload(params: TempStorageUploadParams): Promise<TempStorageUploadResult> {
    const gcsPath = `videos/${params.videoId}/original.mp4`;
    const gcsUri = `gs://${this.bucketName}/${gcsPath}`;

    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(gcsPath);

    await file.save(params.content, {
      contentType: 'video/mp4',
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.expirationDays);

    return {
      gcsUri,
      expiresAt,
    };
  }

  /**
   * Upload video to temporary storage from a stream
   */
  async uploadFromStream(
    params: TempStorageStreamUploadParams,
    source: NodeJS.ReadableStream
  ): Promise<TempStorageUploadResult> {
    const fileName = params.path ?? 'original.mp4';
    const gcsPath = `videos/${params.videoId}/${fileName}`;
    const gcsUri = `gs://${this.bucketName}/${gcsPath}`;

    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(gcsPath);
    const writeStream = file.createWriteStream({
      contentType: params.contentType ?? 'video/mp4',
    });

    await pipeline(source, writeStream);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.expirationDays);

    return {
      gcsUri,
      expiresAt,
    };
  }

  /**
   * Upload video to temporary storage from a stream with progress tracking
   */
  async uploadFromStreamWithProgress(
    params: TempStorageStreamUploadParams,
    source: NodeJS.ReadableStream,
    onProgress?: (bytesTransferred: number) => void
  ): Promise<TempStorageUploadResult> {
    const fileName = params.path ?? 'original.mp4';
    const gcsPath = `videos/${params.videoId}/${fileName}`;
    const gcsUri = `gs://${this.bucketName}/${gcsPath}`;

    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(gcsPath);
    const writeStream = file.createWriteStream({
      contentType: params.contentType ?? 'video/mp4',
    });

    let bytesTransferred = 0;
    const progressTracker = new Transform({
      transform(chunk, _encoding, callback) {
        bytesTransferred += chunk.length;
        onProgress?.(bytesTransferred);
        this.push(chunk);
        callback();
      },
    });

    await pipeline(source, progressTracker, writeStream);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.expirationDays);

    return {
      gcsUri,
      expiresAt,
    };
  }

  /**
   * Download video from temporary storage
   */
  async download(gcsUri: string): Promise<Buffer> {
    const { bucketName, filePath } = this.parseGcsUri(gcsUri);
    const bucket = this.storage.bucket(bucketName);
    const file = bucket.file(filePath);

    const [contents] = await file.download();
    return contents;
  }

  /**
   * Download video as a stream from temporary storage
   */
  downloadAsStream(gcsUri: string): NodeJS.ReadableStream {
    const { bucketName, filePath } = this.parseGcsUri(gcsUri);
    const bucket = this.storage.bucket(bucketName);
    const file = bucket.file(filePath);

    return file.createReadStream();
  }

  /**
   * Check if video exists in temporary storage
   */
  async exists(gcsUri: string): Promise<boolean> {
    try {
      const { bucketName, filePath } = this.parseGcsUri(gcsUri);
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(filePath);

      const [exists] = await file.exists();
      return exists;
    } catch {
      return false;
    }
  }

  /**
   * Generate a signed URL from a GCS URI
   * @param gcsUri GCS URI (gs://bucket/path format)
   * @param expiresInMinutes Expiration time in minutes (default: 60)
   * @returns Signed HTTPS URL for browser access
   */
  async getSignedUrl(gcsUri: string, expiresInMinutes = 60): Promise<string> {
    const { bucketName, filePath } = this.parseGcsUri(gcsUri);
    const bucket = this.storage.bucket(bucketName);
    const file = bucket.file(filePath);

    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    });

    return signedUrl;
  }

  /**
   * Parse GCS URI into bucket name and file path
   */
  private parseGcsUri(gcsUri: string): { bucketName: string; filePath: string } {
    const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match || !match[1] || !match[2]) {
      throw new Error(`Invalid GCS URI: ${gcsUri}`);
    }
    return {
      bucketName: match[1],
      filePath: match[2],
    };
  }
}
