import { Readable } from 'node:stream';
import { GcsClient } from '@shared/infrastructure/clients/gcs.client.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Skip integration tests unless INTEGRATION_TEST=true
const runIntegrationTests = process.env.INTEGRATION_TEST === 'true';

describe.skipIf(!runIntegrationTests)('GcsClient Integration', () => {
  let client: GcsClient;
  const testVideoIds: string[] = [];

  beforeAll(() => {
    // Verify required environment variables
    if (!process.env.GOOGLE_CLOUD_PROJECT) {
      throw new Error('GOOGLE_CLOUD_PROJECT is required for integration tests');
    }

    client = new GcsClient();
  });

  afterAll(async () => {
    // Clean up test files
    for (const videoId of testVideoIds) {
      try {
        const gcsUri = `gs://${process.env.VIDEO_TEMP_BUCKET ?? `${process.env.GOOGLE_CLOUD_PROJECT}-video-processor-temp`}/videos/${videoId}/original.mp4`;
        const exists = await client.exists(gcsUri);
        if (exists) {
          // Note: GcsClient doesn't have a delete method, so we leave cleanup to bucket lifecycle policy
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('upload', () => {
    it('should upload file to GCS', async () => {
      const videoId = `test-upload-${Date.now()}`;
      testVideoIds.push(videoId);

      const content = Buffer.from('test video content for upload');

      const result = await client.upload({
        videoId,
        content,
      });

      expect(result.gcsUri).toContain(videoId);
      expect(result.gcsUri).toMatch(/^gs:\/\//);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('uploadFromStream', () => {
    it('should upload file from stream to GCS', async () => {
      const videoId = `test-stream-upload-${Date.now()}`;
      testVideoIds.push(videoId);

      const content = 'test video content for stream upload';
      const stream = Readable.from(Buffer.from(content));

      const result = await client.uploadFromStream({ videoId }, stream);

      expect(result.gcsUri).toContain(videoId);
      expect(result.gcsUri).toMatch(/^gs:\/\//);
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Verify content by downloading
      const downloaded = await client.download(result.gcsUri);
      expect(downloaded.toString()).toBe(content);
    });

    it('should handle larger stream data', async () => {
      const videoId = `test-large-stream-${Date.now()}`;
      testVideoIds.push(videoId);

      // Create a larger content (1MB)
      const size = 1024 * 1024;
      const content = Buffer.alloc(size, 'x');
      const stream = Readable.from(content);

      const result = await client.uploadFromStream({ videoId }, stream);

      expect(result.gcsUri).toContain(videoId);

      // Verify size by downloading
      const downloaded = await client.download(result.gcsUri);
      expect(downloaded.length).toBe(size);
    });
  });

  describe('download', () => {
    it('should download file from GCS', async () => {
      const videoId = `test-download-${Date.now()}`;
      testVideoIds.push(videoId);

      const content = Buffer.from('test video content for download');
      const { gcsUri } = await client.upload({ videoId, content });

      const downloaded = await client.download(gcsUri);

      expect(downloaded.toString()).toBe(content.toString());
    });
  });

  describe('downloadAsStream', () => {
    it('should download file as stream from GCS', async () => {
      const videoId = `test-stream-download-${Date.now()}`;
      testVideoIds.push(videoId);

      const content = Buffer.from('test video content for stream download');
      const { gcsUri } = await client.upload({ videoId, content });

      const stream = client.downloadAsStream(gcsUri);

      // Collect stream data
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const downloaded = Buffer.concat(chunks);

      expect(downloaded.toString()).toBe(content.toString());
    });

    it('should handle larger file download as stream', async () => {
      const videoId = `test-large-stream-download-${Date.now()}`;
      testVideoIds.push(videoId);

      // Create a larger content (1MB)
      const size = 1024 * 1024;
      const content = Buffer.alloc(size, 'y');
      const { gcsUri } = await client.upload({ videoId, content });

      const stream = client.downloadAsStream(gcsUri);

      // Collect stream data
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const downloaded = Buffer.concat(chunks);

      expect(downloaded.length).toBe(size);
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const videoId = `test-exists-${Date.now()}`;
      testVideoIds.push(videoId);

      const content = Buffer.from('test content');
      const { gcsUri } = await client.upload({ videoId, content });

      const exists = await client.exists(gcsUri);

      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const gcsUri = `gs://${process.env.VIDEO_TEMP_BUCKET ?? 'test-bucket'}/videos/non-existent-${Date.now()}/original.mp4`;

      const exists = await client.exists(gcsUri);

      expect(exists).toBe(false);
    });
  });
});
