import type { Readable } from 'node:stream';

/**
 * File metadata from storage
 */
export interface FileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  parentFolderId?: string;
  createdTime?: Date;
  modifiedTime?: Date;
}

/**
 * Upload options
 */
export interface UploadOptions {
  parentFolderId?: string;
  mimeType?: string;
}

/**
 * Storage gateway interface
 * Defines the contract for file storage operations (e.g., Google Drive)
 */
export interface StorageGateway {
  /**
   * Get file metadata by ID
   */
  getFileMetadata(fileId: string): Promise<FileMetadata>;

  /**
   * Download a file
   */
  downloadFile(fileId: string, destPath: string): Promise<void>;

  /**
   * Upload a file
   */
  uploadFile(
    name: string,
    content: Buffer | Readable,
    options?: UploadOptions
  ): Promise<FileMetadata>;

  /**
   * Create a folder
   */
  createFolder(name: string, parentFolderId?: string): Promise<FileMetadata>;

  /**
   * Check if a file exists
   */
  fileExists(fileId: string): Promise<boolean>;

  /**
   * Delete a file
   */
  deleteFile(fileId: string): Promise<void>;
}
