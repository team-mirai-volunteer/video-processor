import type { ComposeProgressPhase, ComposeStatus } from '@video-processor/shared';
import type { Clip } from '../models/clip.js';

/**
 * Clip with video title for cross-video listing
 */
export interface ClipWithVideo {
  clip: Clip;
  videoTitle: string | null;
}

/**
 * Options for paginated query
 */
export interface FindAllPaginatedOptions {
  page: number;
  limit: number;
}

/**
 * Result of paginated query
 */
export interface FindAllPaginatedResult {
  clips: ClipWithVideo[];
  total: number;
}

export interface ClipRepositoryGateway {
  /**
   * Save a clip (create or update)
   */
  save(clip: Clip): Promise<void>;

  /**
   * Save multiple clips
   */
  saveMany(clips: Clip[]): Promise<void>;

  /**
   * Find a clip by ID
   */
  findById(id: string): Promise<Clip | null>;

  /**
   * Find all clips for a video
   */
  findByVideoId(videoId: string): Promise<Clip[]>;

  /**
   * Find all clips with pagination (cross-video)
   */
  findAllPaginated(options: FindAllPaginatedOptions): Promise<FindAllPaginatedResult>;

  /**
   * Delete a clip by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Update compose status
   */
  updateComposeStatus(clipId: string, status: ComposeStatus, errorMessage?: string): Promise<void>;

  /**
   * Update compose progress
   */
  updateComposeProgress(
    clipId: string,
    phase: ComposeProgressPhase,
    percent: number
  ): Promise<void>;
}
