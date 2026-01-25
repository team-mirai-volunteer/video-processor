import type { VideoStatus } from '@video-processor/shared';
import type { Video } from '../models/video.js';

export interface VideoWithClipCount {
  video: Video;
  clipCount: number;
}

export interface FindVideosOptions {
  page: number;
  limit: number;
  status?: VideoStatus;
}

export interface FindVideosResult {
  videos: VideoWithClipCount[];
  total: number;
}

export interface VideoRepositoryGateway {
  /**
   * Save a video (create or update)
   */
  save(video: Video): Promise<void>;

  /**
   * Find a video by ID
   */
  findById(id: string): Promise<Video | null>;

  /**
   * Find a video by Google Drive file ID
   */
  findByGoogleDriveFileId(fileId: string): Promise<Video | null>;

  /**
   * Find videos with pagination and optional filtering
   */
  findMany(options: FindVideosOptions): Promise<FindVideosResult>;

  /**
   * Delete a video by ID (cascades to related data)
   */
  delete(id: string): Promise<void>;
}
