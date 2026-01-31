import * as fs from 'node:fs';
import * as path from 'node:path';
import { type Router as ExpressRouter, Router } from 'express';

const router: ExpressRouter = Router();

/**
 * GET /api/local-files
 * Serve local files for development environment only
 * This endpoint is only available when TEMP_STORAGE_TYPE=local
 */
router.get('/', (req, res) => {
  // Only allow in local development mode
  if (process.env.TEMP_STORAGE_TYPE !== 'local') {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  const filePath = req.query.path as string;
  if (!filePath) {
    res.status(400).json({ error: 'Missing path parameter' });
    return;
  }

  // Security: ensure the path is within the allowed directory
  const baseDir = process.env.LOCAL_TEMP_STORAGE_DIR ?? '/tmp/video-processor-cache';
  const resolvedPath = path.resolve(filePath);
  const resolvedBaseDir = path.resolve(baseDir);

  if (!resolvedPath.startsWith(resolvedBaseDir)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  if (!fs.existsSync(resolvedPath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  // Determine content type based on file extension
  const ext = path.extname(resolvedPath).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };

  const contentType = contentTypes[ext] ?? 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Access-Control-Allow-Origin', '*');

  const fileStream = fs.createReadStream(resolvedPath);
  fileStream.pipe(res);
});

export default router;
