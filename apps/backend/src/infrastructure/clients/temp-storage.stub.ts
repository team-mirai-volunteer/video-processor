import type { TempStorageGateway } from '../../domain/gateways/temp-storage.gateway.js';

/**
 * Stub implementation of TempStorageGateway
 * This will be replaced by GCS implementation from Session A
 */
export class TempStorageStub implements TempStorageGateway {
  async upload(_params: {
    videoId: string;
    content: Buffer;
  }): Promise<{ gcsUri: string; expiresAt: Date }> {
    // Stub: Returns a dummy URI, actual implementation will be in Session A
    const gcsUri = `gs://stub-bucket/videos/${_params.videoId}/original.mp4`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    return { gcsUri, expiresAt };
  }

  async download(_gcsUri: string): Promise<Buffer> {
    // Stub: Returns empty buffer, actual implementation will be in Session A
    throw new Error('TempStorageGateway.download not implemented - waiting for Session A');
  }

  async exists(_gcsUri: string): Promise<boolean> {
    // Stub: Always returns false, actual implementation will be in Session A
    return false;
  }
}
