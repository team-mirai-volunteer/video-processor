import { Readable } from 'node:stream';
import { type drive_v3, google } from 'googleapis';
import type {
  FileMetadata,
  StorageGateway,
  UploadFileParams,
} from '../../domain/gateways/storage.gateway.js';

interface GoogleDriveClientConfig {
  serviceAccountEmail: string;
  privateKey: string;
}

/**
 * Google Drive client implementation using service account authentication.
 *
 * Required environment variables:
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL: The service account email address
 * - GOOGLE_PRIVATE_KEY: The service account private key (with \n replaced by actual newlines)
 */
export class GoogleDriveClient implements StorageGateway {
  private drive: drive_v3.Drive;

  constructor(config: GoogleDriveClientConfig) {
    const auth = new google.auth.JWT({
      email: config.serviceAccountEmail,
      key: config.privateKey,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    this.drive = google.drive({ version: 'v3', auth });
  }

  /**
   * Create a GoogleDriveClient from environment variables.
   * Throws an error if required environment variables are not set.
   */
  static fromEnv(): GoogleDriveClient {
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!serviceAccountEmail) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL environment variable is required');
    }

    if (!privateKey) {
      throw new Error('GOOGLE_PRIVATE_KEY environment variable is required');
    }

    return new GoogleDriveClient({
      serviceAccountEmail,
      privateKey,
    });
  }

  async getFileMetadata(fileId: string): Promise<FileMetadata> {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, webViewLink, parents',
      });

      const file = response.data;

      if (!file.id || !file.name || !file.mimeType) {
        throw new Error(`Invalid file metadata for file: ${fileId}`);
      }

      return {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size ? Number.parseInt(file.size, 10) : 0,
        webViewLink: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
        parents: file.parents ?? undefined,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get file metadata for ${fileId}: ${error.message}`);
      }
      throw error;
    }
  }

  async downloadFile(fileId: string): Promise<Buffer> {
    try {
      const response = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );

      return Buffer.from(response.data as ArrayBuffer);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to download file ${fileId}: ${error.message}`);
      }
      throw error;
    }
  }

  async uploadFile(params: UploadFileParams): Promise<FileMetadata> {
    try {
      const response = await this.drive.files.create({
        requestBody: {
          name: params.name,
          mimeType: params.mimeType,
          parents: params.parentFolderId ? [params.parentFolderId] : undefined,
        },
        media: {
          mimeType: params.mimeType,
          body: Readable.from(params.content),
        },
        fields: 'id, name, mimeType, size, webViewLink, parents',
      });

      const file = response.data;

      if (!file.id || !file.name || !file.mimeType) {
        throw new Error('Failed to upload file: invalid response');
      }

      return {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size ? Number.parseInt(file.size, 10) : params.content.length,
        webViewLink: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
        parents: file.parents ?? undefined,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to upload file ${params.name}: ${error.message}`);
      }
      throw error;
    }
  }

  async createFolder(name: string, parentId?: string): Promise<FileMetadata> {
    try {
      const response = await this.drive.files.create({
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: parentId ? [parentId] : undefined,
        },
        fields: 'id, name, mimeType, size, webViewLink, parents',
      });

      const file = response.data;

      if (!file.id || !file.name || !file.mimeType) {
        throw new Error('Failed to create folder: invalid response');
      }

      return {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: 0,
        webViewLink: file.webViewLink ?? `https://drive.google.com/drive/folders/${file.id}`,
        parents: file.parents ?? undefined,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create folder ${name}: ${error.message}`);
      }
      throw error;
    }
  }

  async findOrCreateFolder(name: string, parentId?: string): Promise<FileMetadata> {
    try {
      // Search for existing folder
      let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      if (parentId) {
        query += ` and '${parentId}' in parents`;
      }

      const searchResponse = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, size, webViewLink, parents)',
      });

      const files = searchResponse.data.files;

      const existingFile = files?.[0];
      if (existingFile?.id && existingFile.name && existingFile.mimeType) {
        return {
          id: existingFile.id,
          name: existingFile.name,
          mimeType: existingFile.mimeType,
          size: 0,
          webViewLink:
            existingFile.webViewLink ?? `https://drive.google.com/drive/folders/${existingFile.id}`,
          parents: existingFile.parents ?? undefined,
        };
      }

      // Create folder if not found
      return this.createFolder(name, parentId);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to find or create folder ${name}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Delete a file or folder. Useful for cleanup in tests.
   */
  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.drive.files.delete({ fileId });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to delete file ${fileId}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * List files in a folder. Useful for debugging and tests.
   */
  async listFiles(folderId?: string): Promise<FileMetadata[]> {
    try {
      let query = 'trashed=false';
      if (folderId) {
        query += ` and '${folderId}' in parents`;
      }

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, size, webViewLink, parents)',
      });

      const files = response.data.files ?? [];

      return files
        .filter(
          (file): file is drive_v3.Schema$File & { id: string; name: string; mimeType: string } =>
            !!(file.id && file.name && file.mimeType)
        )
        .map((file) => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size ? Number.parseInt(file.size, 10) : 0,
          webViewLink: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
          parents: file.parents ?? undefined,
        }));
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to list files: ${error.message}`);
      }
      throw error;
    }
  }
}
