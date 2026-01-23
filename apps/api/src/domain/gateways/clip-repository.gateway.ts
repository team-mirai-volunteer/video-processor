import type { Clip, CreateClipParams, UpdateClipParams } from '../models/clip.js';

/**
 * Clip repository gateway interface
 * Defines the contract for clip data access
 */
export interface ClipRepositoryGateway {
  /**
   * Find a clip by ID
   */
  findById(id: string): Promise<Clip | null>;

  /**
   * Find all clips for a video
   */
  findByVideoId(videoId: string): Promise<Clip[]>;

  /**
   * Create a new clip
   */
  create(params: CreateClipParams): Promise<Clip>;

  /**
   * Create multiple clips at once
   */
  createMany(params: CreateClipParams[]): Promise<Clip[]>;

  /**
   * Update an existing clip
   */
  update(id: string, params: UpdateClipParams): Promise<Clip>;

  /**
   * Delete a clip by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all clips for a video
   */
  deleteByVideoId(videoId: string): Promise<void>;
}
