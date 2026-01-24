import type { Clip } from '../models/clip.js';

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
}
