import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { LocalFileGateway } from '@shared/domain/gateways/local-file.gateway.js';
import { createLogger } from '@shared/infrastructure/logging/logger.js';

const log = createLogger('LocalFileClient');

/**
 * Local file system implementation of LocalFileGateway
 * Handles temporary file operations for video processing
 */
export class LocalFileClient implements LocalFileGateway {
  /**
   * Create a temporary directory with the given prefix
   */
  async createTempDir(prefix: string): Promise<string> {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
    log.debug('Created temp directory', { tempDir });
    return tempDir;
  }

  /**
   * Read a file from the local file system
   */
  async readFile(filePath: string): Promise<Buffer> {
    return fs.promises.readFile(filePath);
  }

  /**
   * Write data to a file on the local file system
   */
  async writeFile(filePath: string, data: Buffer): Promise<void> {
    await fs.promises.writeFile(filePath, data);
  }

  /**
   * Clean up a temporary directory and all its contents
   */
  async cleanup(dirPath: string): Promise<void> {
    try {
      const files = await fs.promises.readdir(dirPath);
      await Promise.all(files.map((file) => fs.promises.unlink(path.join(dirPath, file))));
      await fs.promises.rmdir(dirPath);
      log.debug('Temp directory cleaned up', { dirPath });
    } catch {
      log.debug('Failed to cleanup temp directory (non-critical)', { dirPath });
    }
  }

  /**
   * Join path segments into a single path
   */
  join(...paths: string[]): string {
    return path.join(...paths);
  }

  /**
   * Get the file extension from a path
   */
  extname(filePath: string): string {
    return path.extname(filePath);
  }
}
