import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageClient } from '../../../../src/infrastructure/clients/local-storage.client.js';

describe('LocalStorageClient', () => {
  let client: LocalStorageClient;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'local-storage-test-'));
    client = new LocalStorageClient(tempDir);
  });

  afterEach(async () => {
    await client.clear();
    await fs.promises.rmdir(tempDir);
  });

  describe('uploadFile and downloadFile', () => {
    it('should upload and download a file', async () => {
      const content = Buffer.from('Hello, World!');

      const uploaded = await client.uploadFile({
        name: 'test.txt',
        mimeType: 'text/plain',
        content,
      });

      expect(uploaded.name).toBe('test.txt');
      expect(uploaded.mimeType).toBe('text/plain');
      expect(uploaded.size).toBe(content.length);

      const downloaded = await client.downloadFile(uploaded.id);
      expect(downloaded.toString()).toBe('Hello, World!');
    });
  });

  describe('getFileMetadata', () => {
    it('should return file metadata', async () => {
      const content = Buffer.from('Test content');

      const uploaded = await client.uploadFile({
        name: 'metadata-test.txt',
        mimeType: 'text/plain',
        content,
        parentFolderId: 'parent-folder-id',
      });

      const metadata = await client.getFileMetadata(uploaded.id);

      expect(metadata.id).toBe(uploaded.id);
      expect(metadata.name).toBe('metadata-test.txt');
      expect(metadata.mimeType).toBe('text/plain');
      expect(metadata.size).toBe(content.length);
      expect(metadata.parents).toEqual(['parent-folder-id']);
    });

    it('should throw error for non-existent file', async () => {
      await expect(client.getFileMetadata('non-existent')).rejects.toThrow('File not found');
    });
  });

  describe('createFolder and findOrCreateFolder', () => {
    it('should create a folder', async () => {
      const folder = await client.createFolder('My Folder', 'parent-id');

      expect(folder.name).toBe('My Folder');
      expect(folder.mimeType).toBe('application/vnd.google-apps.folder');
      expect(folder.parents).toEqual(['parent-id']);
    });

    it('should find existing folder', async () => {
      const created = await client.createFolder('Existing Folder');
      const found = await client.findOrCreateFolder('Existing Folder');

      expect(found.id).toBe(created.id);
      expect(found.name).toBe('Existing Folder');
    });

    it('should create folder if not found', async () => {
      const folder = await client.findOrCreateFolder('New Folder');

      expect(folder.name).toBe('New Folder');
      expect(folder.mimeType).toBe('application/vnd.google-apps.folder');
    });
  });

  describe('registerFile', () => {
    it('should register an existing file with a specific ID', async () => {
      // Create a temp file to register
      const sourceFile = path.join(tempDir, 'source.txt');
      await fs.promises.writeFile(sourceFile, 'Source content');

      await client.registerFile('my-custom-id', sourceFile, {
        name: 'registered.txt',
        mimeType: 'text/plain',
        parents: ['some-parent'],
      });

      const metadata = await client.getFileMetadata('my-custom-id');
      expect(metadata.id).toBe('my-custom-id');
      expect(metadata.name).toBe('registered.txt');

      const content = await client.downloadFile('my-custom-id');
      expect(content.toString()).toBe('Source content');
    });
  });
});
