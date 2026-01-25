import type {
  FileMetadata,
  StorageGateway,
  UploadFileParams,
} from '../../domain/gateways/storage.gateway.js';

/**
 * Mock Google Drive client for E2E tests.
 * Returns pre-configured test data without hitting the real API.
 */
export class MockGoogleDriveClient implements StorageGateway {
  private mockFiles: Map<string, FileMetadata> = new Map([
    [
      'e2e-drive-file-1',
      {
        id: 'e2e-drive-file-1',
        name: 'E2Eテスト動画 - 完了.mp4',
        mimeType: 'video/mp4',
        size: 100000000,
        webViewLink: 'https://drive.google.com/file/d/e2e-drive-file-1/view',
      },
    ],
    [
      'e2e-drive-file-2',
      {
        id: 'e2e-drive-file-2',
        name: 'E2Eテスト動画 - 処理中.mp4',
        mimeType: 'video/mp4',
        size: 50000000,
        webViewLink: 'https://drive.google.com/file/d/e2e-drive-file-2/view',
      },
    ],
    [
      'e2e-drive-file-3',
      {
        id: 'e2e-drive-file-3',
        name: 'E2Eテスト動画 - 未処理.mp4',
        mimeType: 'video/mp4',
        size: 75000000,
        webViewLink: 'https://drive.google.com/file/d/e2e-drive-file-3/view',
      },
    ],
    [
      'e2e-drive-file-4',
      {
        id: 'e2e-drive-file-4',
        name: 'E2Eテスト動画 - エラー.mp4',
        mimeType: 'video/mp4',
        size: 60000000,
        webViewLink: 'https://drive.google.com/file/d/e2e-drive-file-4/view',
      },
    ],
    [
      'e2e-clip-drive-1',
      {
        id: 'e2e-clip-drive-1',
        name: 'クリップ1.mp4',
        mimeType: 'video/mp4',
        size: 5000000,
        webViewLink: 'https://drive.google.com/file/d/e2e-clip-1/view',
      },
    ],
    [
      'e2e-clip-drive-2',
      {
        id: 'e2e-clip-drive-2',
        name: 'クリップ2.mp4',
        mimeType: 'video/mp4',
        size: 10000000,
        webViewLink: 'https://drive.google.com/file/d/e2e-clip-2/view',
      },
    ],
  ]);

  async getFileMetadata(fileId: string): Promise<FileMetadata> {
    const file = this.mockFiles.get(fileId);
    if (file) {
      return file;
    }

    // 新規登録テスト用: 未知のfileIdは新規ファイルとして扱う
    return {
      id: fileId,
      name: `New Video ${fileId}.mp4`,
      mimeType: 'video/mp4',
      size: 50000000,
      webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
    };
  }

  async downloadFile(_fileId: string): Promise<Buffer> {
    // テスト用のダミーデータを返す
    // 実際の動画ファイルは不要（E2Eテストでは動画処理は行わない）
    return Buffer.from('mock video content');
  }

  async uploadFile(params: UploadFileParams): Promise<FileMetadata> {
    const id = `uploaded-${Date.now()}`;
    return {
      id,
      name: params.name,
      mimeType: params.mimeType,
      size: params.content.length,
      webViewLink: `https://drive.google.com/file/d/${id}/view`,
    };
  }

  async createFolder(name: string, _parentId?: string): Promise<FileMetadata> {
    const id = `mock-folder-${Date.now()}`;
    return {
      id,
      name,
      mimeType: 'application/vnd.google-apps.folder',
      size: 0,
      webViewLink: `https://drive.google.com/drive/folders/${id}`,
    };
  }

  async findOrCreateFolder(name: string, parentId?: string): Promise<FileMetadata> {
    return this.createFolder(name, parentId);
  }
}
