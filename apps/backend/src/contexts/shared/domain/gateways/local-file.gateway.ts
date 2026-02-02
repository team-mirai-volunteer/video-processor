/**
 * Gateway for local file system operations
 * Used for temporary file handling during video processing
 */
export interface LocalFileGateway {
  /**
   * Create a temporary directory with the given prefix
   * @param prefix Prefix for the temp directory name
   * @returns Absolute path to the created temp directory
   */
  createTempDir(prefix: string): Promise<string>;

  /**
   * Read a file from the local file system
   * @param filePath Absolute path to the file
   * @returns File contents as a Buffer
   */
  readFile(filePath: string): Promise<Buffer>;

  /**
   * Write data to a file on the local file system
   * @param filePath Absolute path to the file
   * @param data Data to write
   */
  writeFile(filePath: string, data: Buffer): Promise<void>;

  /**
   * Clean up a temporary directory and all its contents
   * @param dirPath Absolute path to the directory to clean up
   */
  cleanup(dirPath: string): Promise<void>;

  /**
   * Join path segments into a single path
   * @param paths Path segments to join
   * @returns Joined path
   */
  join(...paths: string[]): string;

  /**
   * Get the file extension from a path
   * @param filePath Path to extract extension from
   * @returns Extension including the dot (e.g., '.mp4')
   */
  extname(filePath: string): string;
}
