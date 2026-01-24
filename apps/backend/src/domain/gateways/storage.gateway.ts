export interface FileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  webViewLink: string;
  parents?: string[];
}

export interface UploadFileParams {
  name: string;
  mimeType: string;
  content: Buffer;
  parentFolderId?: string;
}

export interface StorageGateway {
  /**
   * Get file metadata from Google Drive
   */
  getFileMetadata(fileId: string): Promise<FileMetadata>;

  /**
   * Download file content from Google Drive
   */
  downloadFile(fileId: string): Promise<Buffer>;

  /**
   * Upload file to Google Drive
   */
  uploadFile(params: UploadFileParams): Promise<FileMetadata>;

  /**
   * Create a folder in Google Drive
   */
  createFolder(name: string, parentId?: string): Promise<FileMetadata>;

  /**
   * Find or create a folder by name
   */
  findOrCreateFolder(name: string, parentId?: string): Promise<FileMetadata>;
}
