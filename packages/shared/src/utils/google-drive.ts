/**
 * Google Drive URL patterns
 *
 * Supported formats:
 * - https://drive.google.com/file/d/{fileId}/view
 * - https://drive.google.com/file/d/{fileId}/edit
 * - https://drive.google.com/file/d/{fileId}/preview
 * - https://drive.google.com/open?id={fileId}
 * - https://docs.google.com/file/d/{fileId}/view
 */

const FILE_ID_PATTERNS = [
  // /file/d/{fileId}/... pattern
  /\/file\/d\/([a-zA-Z0-9_-]+)/,
  // ?id={fileId} pattern
  /[?&]id=([a-zA-Z0-9_-]+)/,
  // /folders/{folderId} pattern (for folders)
  /\/folders\/([a-zA-Z0-9_-]+)/,
];

/**
 * Extract Google Drive file ID from a URL
 * @param url - Google Drive URL
 * @returns File ID or null if not found
 */
export function extractFileIdFromUrl(url: string): string | null {
  if (!url) {
    return null;
  }

  try {
    // Validate it's a Google URL
    const parsedUrl = new URL(url);
    const validHosts = ['drive.google.com', 'docs.google.com'];

    if (!validHosts.includes(parsedUrl.hostname)) {
      return null;
    }

    // Try each pattern
    for (const pattern of FILE_ID_PATTERNS) {
      const match = url.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    return null;
  } catch {
    // Invalid URL
    return null;
  }
}

/**
 * Validate if a string is a valid Google Drive file ID
 * File IDs are alphanumeric with hyphens and underscores, typically 25-60 chars
 * @param fileId - Potential file ID
 * @returns true if valid format
 */
export function isValidFileId(fileId: string): boolean {
  if (!fileId) {
    return false;
  }

  // File IDs are alphanumeric with hyphens and underscores
  const FILE_ID_REGEX = /^[a-zA-Z0-9_-]{10,}$/;
  return FILE_ID_REGEX.test(fileId);
}

/**
 * Build a Google Drive file URL from a file ID
 * @param fileId - Google Drive file ID
 * @returns Google Drive view URL
 */
export function buildFileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Build a Google Drive download URL from a file ID
 * @param fileId - Google Drive file ID
 * @returns Google Drive direct download URL
 */
export function buildDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Build a Google Drive folder URL from a folder ID
 * @param folderId - Google Drive folder ID
 * @returns Google Drive folder URL
 */
export function buildFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}
