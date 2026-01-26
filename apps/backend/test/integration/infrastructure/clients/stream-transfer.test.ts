import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GcsClient } from '../../../../src/infrastructure/clients/gcs.client.js';
import { GoogleDriveClient } from '../../../../src/infrastructure/clients/google-drive.client.js';

// Skip integration tests unless INTEGRATION_TEST=true
const runIntegrationTests = process.env.INTEGRATION_TEST === 'true';

const TEST_ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_TEST_FOLDER_ID;

/**
 * Integration test for stream-based transfer from Google Drive to GCS.
 * This simulates the actual flow used in CacheVideoUseCase.
 */
describe.skipIf(!runIntegrationTests)('Stream Transfer: Google Drive → GCS', () => {
  let driveClient: GoogleDriveClient;
  let gcsClient: GcsClient;
  const createdDriveFileIds: string[] = [];
  const createdGcsVideoIds: string[] = [];

  beforeAll(() => {
    // Verify required environment variables
    const hasCredentialsJson = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const hasIndividualCredentials =
      !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && !!process.env.GOOGLE_PRIVATE_KEY;

    if (!hasCredentialsJson && !hasIndividualCredentials) {
      throw new Error(
        'Either GOOGLE_APPLICATION_CREDENTIALS_JSON or (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY) is required'
      );
    }
    if (!TEST_ROOT_FOLDER_ID) {
      throw new Error('GOOGLE_DRIVE_TEST_FOLDER_ID is required for integration tests');
    }
    if (!process.env.GOOGLE_CLOUD_PROJECT) {
      throw new Error('GOOGLE_CLOUD_PROJECT is required for integration tests');
    }

    driveClient = GoogleDriveClient.fromEnv();
    gcsClient = new GcsClient();
  });

  afterAll(async () => {
    // Clean up Drive files
    for (const fileId of createdDriveFileIds) {
      try {
        await driveClient.deleteFile(fileId);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('should transfer small file from Drive to GCS via stream', async () => {
    // 1. Upload a test file to Google Drive
    const content = Buffer.from('Stream transfer test - small file content - 日本語テスト');
    const fileName = `stream-test-small-${Date.now()}.txt`;

    const driveFile = await driveClient.uploadFile({
      name: fileName,
      mimeType: 'text/plain',
      content,
      parentFolderId: TEST_ROOT_FOLDER_ID,
    });
    createdDriveFileIds.push(driveFile.id);

    // 2. Stream from Drive to GCS (simulating CacheVideoUseCase)
    const videoId = `stream-test-${Date.now()}`;
    createdGcsVideoIds.push(videoId);

    const driveStream = await driveClient.downloadFileAsStream(driveFile.id);
    const { gcsUri } = await gcsClient.uploadFromStream({ videoId }, driveStream);

    // 3. Verify the content in GCS
    const downloaded = await gcsClient.download(gcsUri);
    expect(downloaded.toString()).toBe(content.toString());
  });

  it('should transfer medium file (100KB) from Drive to GCS via stream', async () => {
    // 1. Create medium content (100KB)
    const size = 100 * 1024;
    const content = Buffer.alloc(size, 'M');
    const fileName = `stream-test-medium-${Date.now()}.bin`;

    const driveFile = await driveClient.uploadFile({
      name: fileName,
      mimeType: 'application/octet-stream',
      content,
      parentFolderId: TEST_ROOT_FOLDER_ID,
    });
    createdDriveFileIds.push(driveFile.id);

    // 2. Stream from Drive to GCS
    const videoId = `stream-test-medium-${Date.now()}`;
    createdGcsVideoIds.push(videoId);

    const driveStream = await driveClient.downloadFileAsStream(driveFile.id);
    const { gcsUri } = await gcsClient.uploadFromStream({ videoId }, driveStream);

    // 3. Verify the content
    const downloaded = await gcsClient.download(gcsUri);
    expect(downloaded.length).toBe(size);
    expect(Buffer.compare(downloaded, content)).toBe(0);
  });

  it('should transfer larger file (1MB) from Drive to GCS via stream', async () => {
    // 1. Create larger content (1MB)
    const size = 1024 * 1024;
    const content = Buffer.alloc(size, 'L');
    const fileName = `stream-test-large-${Date.now()}.bin`;

    const driveFile = await driveClient.uploadFile({
      name: fileName,
      mimeType: 'application/octet-stream',
      content,
      parentFolderId: TEST_ROOT_FOLDER_ID,
    });
    createdDriveFileIds.push(driveFile.id);

    // 2. Stream from Drive to GCS
    const videoId = `stream-test-large-${Date.now()}`;
    createdGcsVideoIds.push(videoId);

    const driveStream = await driveClient.downloadFileAsStream(driveFile.id);
    const { gcsUri } = await gcsClient.uploadFromStream({ videoId }, driveStream);

    // 3. Verify the size (full content comparison for 1MB would be slow)
    const downloaded = await gcsClient.download(gcsUri);
    expect(downloaded.length).toBe(size);

    // Spot check: first and last bytes
    expect(downloaded[0]).toBe('L'.charCodeAt(0));
    expect(downloaded[size - 1]).toBe('L'.charCodeAt(0));
  });

  it('should transfer file and verify via stream download', async () => {
    // 1. Upload to Drive
    const content = Buffer.from('Stream-to-stream verification test');
    const fileName = `stream-verify-${Date.now()}.txt`;

    const driveFile = await driveClient.uploadFile({
      name: fileName,
      mimeType: 'text/plain',
      content,
      parentFolderId: TEST_ROOT_FOLDER_ID,
    });
    createdDriveFileIds.push(driveFile.id);

    // 2. Stream from Drive to GCS
    const videoId = `stream-verify-${Date.now()}`;
    createdGcsVideoIds.push(videoId);

    const driveStream = await driveClient.downloadFileAsStream(driveFile.id);
    const { gcsUri } = await gcsClient.uploadFromStream({ videoId }, driveStream);

    // 3. Verify via stream download from GCS
    const gcsStream = gcsClient.downloadAsStream(gcsUri);

    const chunks: Buffer[] = [];
    for await (const chunk of gcsStream) {
      chunks.push(Buffer.from(chunk));
    }
    const downloaded = Buffer.concat(chunks);

    expect(downloaded.toString()).toBe(content.toString());
  });
});
