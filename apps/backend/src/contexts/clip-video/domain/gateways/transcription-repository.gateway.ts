import type { Transcription } from '../models/transcription.js';

/**
 * Gateway for Transcription persistence
 */
export interface TranscriptionRepositoryGateway {
  /**
   * Save a transcription to the database
   */
  save(transcription: Transcription): Promise<void>;

  /**
   * Find a transcription by its ID
   */
  findById(id: string): Promise<Transcription | null>;

  /**
   * Find a transcription by video ID
   */
  findByVideoId(videoId: string): Promise<Transcription | null>;

  /**
   * Delete a transcription by video ID
   */
  deleteByVideoId(videoId: string): Promise<void>;
}
