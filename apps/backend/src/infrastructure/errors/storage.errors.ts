/**
 * Storage-related errors thrown by infrastructure layer
 */

/**
 * Base error for storage operations
 */
class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error when file download is forbidden due to sharing settings
 * (e.g., "Viewers can't download" is enabled)
 */
export class DownloadForbiddenError extends StorageError {
  readonly fileId: string;

  constructor(fileId: string) {
    super(
      'このファイルはダウンロードが禁止されています。Google Driveの共有設定で「閲覧者とコメント投稿者に、ダウンロード、印刷、コピーのオプションを表示する」を有効にしてください。'
    );
    this.fileId = fileId;
  }
}

/**
 * Error when file access is denied (no permission)
 */
export class AccessDeniedError extends StorageError {
  readonly fileId: string;

  constructor(fileId: string) {
    super(
      'このファイルへのアクセス権限がありません。Google Driveでサービスアカウントにファイルを共有してください。'
    );
    this.fileId = fileId;
  }
}

/**
 * Error when file is not found
 */
export class FileNotFoundError extends StorageError {
  readonly fileId: string;

  constructor(fileId: string) {
    super('指定されたファイルが見つかりません。URLが正しいか確認してください。');
    this.fileId = fileId;
  }
}
