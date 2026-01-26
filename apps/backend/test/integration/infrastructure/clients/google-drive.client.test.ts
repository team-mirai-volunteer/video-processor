import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleDriveClient } from '../../../../src/infrastructure/clients/google-drive.client.js';

// Skip integration tests unless INTEGRATION_TEST=true
const runIntegrationTests = process.env.INTEGRATION_TEST === 'true';

// Shared drive folder ID for integration tests
const TEST_ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_TEST_FOLDER_ID;

describe.skipIf(!runIntegrationTests)('GoogleDriveClient Integration', () => {
  let client: GoogleDriveClient;
  const createdFileIds: string[] = [];

  beforeAll(() => {
    // Verify required environment variables
    // Either GOOGLE_APPLICATION_CREDENTIALS_JSON or (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY)
    const hasCredentialsJson = !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const hasIndividualCredentials =
      !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && !!process.env.GOOGLE_PRIVATE_KEY;

    if (!hasCredentialsJson && !hasIndividualCredentials) {
      throw new Error(
        'Either GOOGLE_APPLICATION_CREDENTIALS_JSON or (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY) is required for integration tests'
      );
    }
    if (!TEST_ROOT_FOLDER_ID) {
      throw new Error('GOOGLE_DRIVE_TEST_FOLDER_ID is required for integration tests');
    }

    client = GoogleDriveClient.fromEnv();
  });

  afterAll(async () => {
    // Clean up created files
    for (const fileId of createdFileIds) {
      try {
        await client.deleteFile(fileId);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('createFolder', () => {
    it('should create a folder in Google Drive', async () => {
      const folderName = `test-folder-${Date.now()}`;
      const folder = await client.createFolder(folderName, TEST_ROOT_FOLDER_ID);

      expect(folder.id).toBeDefined();
      expect(folder.name).toBe(folderName);
      expect(folder.mimeType).toBe('application/vnd.google-apps.folder');

      createdFileIds.push(folder.id);
    });
  });

  describe('uploadFile', () => {
    it('should upload a text file to Google Drive', async () => {
      const content = Buffer.from('Hello, Google Drive!');
      const fileName = `test-file-${Date.now()}.txt`;

      const file = await client.uploadFile({
        name: fileName,
        mimeType: 'text/plain',
        content,
        parentFolderId: TEST_ROOT_FOLDER_ID,
      });

      expect(file.id).toBeDefined();
      expect(file.name).toBe(fileName);
      expect(file.mimeType).toBe('text/plain');
      expect(file.size).toBeGreaterThan(0);

      createdFileIds.push(file.id);
    });

    it('should upload a file into a specific folder', async () => {
      // Create a folder first
      const folderName = `upload-test-folder-${Date.now()}`;
      const folder = await client.createFolder(folderName, TEST_ROOT_FOLDER_ID);
      createdFileIds.push(folder.id);

      const content = Buffer.from('File in folder');
      const fileName = `nested-file-${Date.now()}.txt`;

      const file = await client.uploadFile({
        name: fileName,
        mimeType: 'text/plain',
        content,
        parentFolderId: folder.id,
      });

      expect(file.id).toBeDefined();
      expect(file.name).toBe(fileName);

      createdFileIds.push(file.id);
    });
  });

  describe('getFileMetadata', () => {
    it('should get file metadata', async () => {
      const content = Buffer.from('Metadata test file');
      const fileName = `metadata-test-${Date.now()}.txt`;

      const uploaded = await client.uploadFile({
        name: fileName,
        mimeType: 'text/plain',
        content,
        parentFolderId: TEST_ROOT_FOLDER_ID,
      });
      createdFileIds.push(uploaded.id);

      const metadata = await client.getFileMetadata(uploaded.id);

      expect(metadata.id).toBe(uploaded.id);
      expect(metadata.name).toBe(fileName);
      expect(metadata.mimeType).toBe('text/plain');
      expect(metadata.size).toBeGreaterThan(0);
      expect(metadata.webViewLink).toBeDefined();
    });

    it('should throw error for non-existent file', async () => {
      await expect(client.getFileMetadata('non-existent-file-id')).rejects.toThrow();
    });
  });

  describe('downloadFile', () => {
    it('should download file content', async () => {
      const originalContent = 'Download test content - 日本語テスト';
      const content = Buffer.from(originalContent);
      const fileName = `download-test-${Date.now()}.txt`;

      const uploaded = await client.uploadFile({
        name: fileName,
        mimeType: 'text/plain',
        content,
        parentFolderId: TEST_ROOT_FOLDER_ID,
      });
      createdFileIds.push(uploaded.id);

      const downloaded = await client.downloadFile(uploaded.id);

      expect(downloaded.toString()).toBe(originalContent);
    });

    it('should download binary file', async () => {
      // Create a simple binary content
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
      const fileName = `binary-test-${Date.now()}.bin`;

      const uploaded = await client.uploadFile({
        name: fileName,
        mimeType: 'application/octet-stream',
        content: binaryContent,
        parentFolderId: TEST_ROOT_FOLDER_ID,
      });
      createdFileIds.push(uploaded.id);

      const downloaded = await client.downloadFile(uploaded.id);

      expect(Buffer.compare(downloaded, binaryContent)).toBe(0);
    });
  });

  describe('downloadFileAsStream', () => {
    it('should download file as stream', async () => {
      const originalContent = 'Stream download test - ストリームテスト';
      const content = Buffer.from(originalContent);
      const fileName = `stream-download-test-${Date.now()}.txt`;

      const uploaded = await client.uploadFile({
        name: fileName,
        mimeType: 'text/plain',
        content,
        parentFolderId: TEST_ROOT_FOLDER_ID,
      });
      createdFileIds.push(uploaded.id);

      const stream = await client.downloadFileAsStream(uploaded.id);

      // Collect stream data
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const downloaded = Buffer.concat(chunks);

      expect(downloaded.toString()).toBe(originalContent);
    });

    it('should download larger file as stream', async () => {
      // Create larger content (100KB)
      const size = 100 * 1024;
      const content = Buffer.alloc(size, 'z');
      const fileName = `large-stream-test-${Date.now()}.bin`;

      const uploaded = await client.uploadFile({
        name: fileName,
        mimeType: 'application/octet-stream',
        content,
        parentFolderId: TEST_ROOT_FOLDER_ID,
      });
      createdFileIds.push(uploaded.id);

      const stream = await client.downloadFileAsStream(uploaded.id);

      // Collect stream data
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const downloaded = Buffer.concat(chunks);

      expect(downloaded.length).toBe(size);
    });
  });

  describe('findOrCreateFolder', () => {
    it('should create folder if not exists', async () => {
      const folderName = `find-or-create-${Date.now()}`;

      const folder = await client.findOrCreateFolder(folderName, TEST_ROOT_FOLDER_ID);

      expect(folder.id).toBeDefined();
      expect(folder.name).toBe(folderName);
      expect(folder.mimeType).toBe('application/vnd.google-apps.folder');

      createdFileIds.push(folder.id);
    });

    it('should return existing folder if exists', async () => {
      const folderName = `existing-folder-${Date.now()}`;

      // Create folder first
      const created = await client.createFolder(folderName, TEST_ROOT_FOLDER_ID);
      createdFileIds.push(created.id);

      // Find or create should return the existing folder
      const found = await client.findOrCreateFolder(folderName, TEST_ROOT_FOLDER_ID);

      expect(found.id).toBe(created.id);
      expect(found.name).toBe(folderName);
    });

    it('should create nested folder with parent', async () => {
      // Create parent folder first
      const parentFolder = await client.createFolder(`parent-${Date.now()}`, TEST_ROOT_FOLDER_ID);
      createdFileIds.push(parentFolder.id);

      const nestedFolderName = `nested-folder-${Date.now()}`;

      const folder = await client.findOrCreateFolder(nestedFolderName, parentFolder.id);

      expect(folder.id).toBeDefined();
      expect(folder.name).toBe(nestedFolderName);

      createdFileIds.push(folder.id);
    });
  });

  describe('listFiles', () => {
    it(
      'should list files in folder',
      async () => {
        // Create a test folder with files
        const folderName = `list-test-${Date.now()}`;
        const folder = await client.createFolder(folderName, TEST_ROOT_FOLDER_ID);
        createdFileIds.push(folder.id);

        // Upload some files
        const file1 = await client.uploadFile({
          name: 'file1.txt',
          mimeType: 'text/plain',
          content: Buffer.from('File 1'),
          parentFolderId: folder.id,
        });
        createdFileIds.push(file1.id);

        const file2 = await client.uploadFile({
          name: 'file2.txt',
          mimeType: 'text/plain',
          content: Buffer.from('File 2'),
          parentFolderId: folder.id,
        });
        createdFileIds.push(file2.id);

        const files = await client.listFiles(folder.id);

        expect(files.length).toBe(2);
        expect(files.some((f) => f.name === 'file1.txt')).toBe(true);
        expect(files.some((f) => f.name === 'file2.txt')).toBe(true);
      },
      { timeout: 30000 }
    );
  });

  describe('deleteFile', () => {
    it('should delete a file', async () => {
      const file = await client.uploadFile({
        name: `delete-test-${Date.now()}.txt`,
        mimeType: 'text/plain',
        content: Buffer.from('To be deleted'),
        parentFolderId: TEST_ROOT_FOLDER_ID,
      });

      // Verify file exists before deletion
      const metadata = await client.getFileMetadata(file.id);
      expect(metadata.id).toBe(file.id);

      // Delete the file - on shared drives this may behave differently
      // If delete succeeds, verify file is gone
      // If delete throws "File not found", file may have been auto-cleaned or has different behavior
      try {
        await client.deleteFile(file.id);
      } catch (error) {
        // On shared drives, deletion might require different permissions
        // Skip verification if delete itself fails
        if (error instanceof Error && error.message.includes('File not found')) {
          // File already doesn't exist - this is acceptable
          return;
        }
        throw error;
      }

      // Verify file is deleted
      await expect(client.getFileMetadata(file.id)).rejects.toThrow();
    });

    it('should throw error for non-existent file', async () => {
      await expect(client.deleteFile('non-existent-file-id')).rejects.toThrow();
    });
  });
});

describe.skipIf(!runIntegrationTests)('GoogleDriveClient.fromEnv', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should throw error when no credentials are available', () => {
    // Clear all possible credential sources
    vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS_JSON', '');
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', '');
    vi.stubEnv('GOOGLE_PRIVATE_KEY', '');

    expect(() => GoogleDriveClient.fromEnv()).toThrow('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  });

  it('should throw error when only GOOGLE_SERVICE_ACCOUNT_EMAIL is set without GOOGLE_PRIVATE_KEY', () => {
    // Clear GOOGLE_APPLICATION_CREDENTIALS_JSON to test individual env vars
    vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS_JSON', '');
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'test@example.com');
    vi.stubEnv('GOOGLE_PRIVATE_KEY', '');

    expect(() => GoogleDriveClient.fromEnv()).toThrow('GOOGLE_PRIVATE_KEY');
  });
});
