import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  FileMetadata,
  StorageGateway,
  UploadFileParams,
} from '@shared/domain/gateways/storage.gateway.js';

interface FileInfo {
  name: string;
  mimeType: string;
  size: number;
  parents?: string[];
}

/**
 * Local file system implementation of StorageGateway for testing.
 *
 * Files are stored as:
 *   {baseDir}/{fileId}.dat  - file content
 *   {baseDir}/{fileId}.json - file metadata (name, mimeType, size, parents)
 */
export class LocalStorageClient implements StorageGateway {
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  private getDataPath(fileId: string): string {
    return path.join(this.baseDir, `${fileId}.dat`);
  }

  private getMetaPath(fileId: string): string {
    return path.join(this.baseDir, `${fileId}.json`);
  }

  private generateId(): string {
    return crypto.randomUUID();
  }

  private buildWebViewLink(fileId: string): string {
    return `file://${path.join(this.baseDir, `${fileId}.dat`)}`;
  }

  async getFileMetadata(fileId: string): Promise<FileMetadata> {
    const metaPath = this.getMetaPath(fileId);

    if (!fs.existsSync(metaPath)) {
      throw new Error(`File not found: ${fileId}`);
    }

    const content = await fs.promises.readFile(metaPath, 'utf-8');
    const info: FileInfo = JSON.parse(content);

    return {
      id: fileId,
      name: info.name,
      mimeType: info.mimeType,
      size: info.size,
      webViewLink: this.buildWebViewLink(fileId),
      parents: info.parents,
    };
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    const dataPath = this.getDataPath(fileId);

    if (!fs.existsSync(dataPath)) {
      throw new Error(`File not found: ${fileId}`);
    }

    return fs.promises.readFile(dataPath);
  }

  async downloadFileAsStream(fileId: string): Promise<NodeJS.ReadableStream> {
    const dataPath = this.getDataPath(fileId);

    if (!fs.existsSync(dataPath)) {
      throw new Error(`File not found: ${fileId}`);
    }

    return fs.createReadStream(dataPath);
  }

  async uploadFile(params: UploadFileParams): Promise<FileMetadata> {
    await fs.promises.mkdir(this.baseDir, { recursive: true });

    const fileId = this.generateId();
    const dataPath = this.getDataPath(fileId);
    const metaPath = this.getMetaPath(fileId);

    const info: FileInfo = {
      name: params.name,
      mimeType: params.mimeType,
      size: params.content.length,
      parents: params.parentFolderId ? [params.parentFolderId] : undefined,
    };

    await fs.promises.writeFile(dataPath, params.content);
    await fs.promises.writeFile(metaPath, JSON.stringify(info, null, 2));

    return {
      id: fileId,
      name: info.name,
      mimeType: info.mimeType,
      size: info.size,
      webViewLink: this.buildWebViewLink(fileId),
      parents: info.parents,
    };
  }

  async createFolder(name: string, parentId?: string): Promise<FileMetadata> {
    await fs.promises.mkdir(this.baseDir, { recursive: true });

    const folderId = this.generateId();
    const metaPath = this.getMetaPath(folderId);

    const info: FileInfo = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      size: 0,
      parents: parentId ? [parentId] : undefined,
    };

    await fs.promises.writeFile(metaPath, JSON.stringify(info, null, 2));

    return {
      id: folderId,
      name: info.name,
      mimeType: info.mimeType,
      size: 0,
      webViewLink: this.buildWebViewLink(folderId),
      parents: info.parents,
    };
  }

  async findOrCreateFolder(name: string, parentId?: string): Promise<FileMetadata> {
    await fs.promises.mkdir(this.baseDir, { recursive: true });

    // Search for existing folder
    const files = await fs.promises.readdir(this.baseDir);
    const metaFiles = files.filter((f) => f.endsWith('.json'));

    for (const metaFile of metaFiles) {
      const content = await fs.promises.readFile(path.join(this.baseDir, metaFile), 'utf-8');
      const info: FileInfo = JSON.parse(content);

      if (
        info.name === name &&
        info.mimeType === 'application/vnd.google-apps.folder' &&
        (parentId === undefined || info.parents?.includes(parentId))
      ) {
        const fileId = metaFile.replace('.json', '');
        return {
          id: fileId,
          name: info.name,
          mimeType: info.mimeType,
          size: 0,
          webViewLink: this.buildWebViewLink(fileId),
          parents: info.parents,
        };
      }
    }

    // Create if not found
    return this.createFolder(name, parentId);
  }

  /**
   * Register an existing file with a specific ID.
   * Useful for setting up test fixtures.
   */
  async registerFile(
    fileId: string,
    filePath: string,
    metadata: Omit<FileInfo, 'size'>
  ): Promise<void> {
    await fs.promises.mkdir(this.baseDir, { recursive: true });

    const content = await fs.promises.readFile(filePath);
    const dataPath = this.getDataPath(fileId);
    const metaPath = this.getMetaPath(fileId);

    const info: FileInfo = {
      ...metadata,
      size: content.length,
    };

    await fs.promises.copyFile(filePath, dataPath);
    await fs.promises.writeFile(metaPath, JSON.stringify(info, null, 2));
  }

  /**
   * Clean up all files in the storage directory.
   * Useful for test cleanup.
   */
  async clear(): Promise<void> {
    if (!fs.existsSync(this.baseDir)) {
      return;
    }

    const files = await fs.promises.readdir(this.baseDir);
    await Promise.all(files.map((file) => fs.promises.unlink(path.join(this.baseDir, file))));
  }
}
