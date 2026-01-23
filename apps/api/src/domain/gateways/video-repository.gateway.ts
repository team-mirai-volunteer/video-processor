import type { Video, CreateVideoParams, UpdateVideoParams, VideoFilterOptions } from '../models/video.js';

/**
 * Video repository gateway interface
 * Defines the contract for video data access
 */
export interface VideoRepositoryGateway {
  /**
   * Find a video by ID
   */
  findById(id: string): Promise<Video | null>;

  /**
   * Find a video by Google Drive file ID
   */
  findByGoogleDriveFileId(fileId: string): Promise<Video | null>;

  /**
   * Find all videos with optional filtering and pagination
   */
  findAll(options?: VideoFilterOptions): Promise<{ videos: Video[]; total: number }>;

  /**
   * Find a video with its relations (clips and processing jobs)
   */
  findByIdWithRelations(id: string): Promise<Video & {
    clips: import('../models/clip.js').Clip[];
    processingJobs: import('../models/processing-job.js').ProcessingJob[];
  } | null>;

  /**
   * Create a new video
   */
  create(params: CreateVideoParams): Promise<Video>;

  /**
   * Update an existing video
   */
  update(id: string, params: UpdateVideoParams): Promise<Video>;

  /**
   * Delete a video by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Count videos by status
   */
  countByStatus(status: string): Promise<number>;
}
