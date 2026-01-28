import type { RefinedTranscription } from '../models/refined-transcription.js';

/**
 * Gateway for RefinedTranscription persistence
 */
export interface RefinedTranscriptionRepositoryGateway {
  /**
   * Save a refined transcription to the database (upsert)
   */
  save(refinedTranscription: RefinedTranscription): Promise<void>;

  /**
   * Find a refined transcription by its ID
   */
  findById(id: string): Promise<RefinedTranscription | null>;

  /**
   * Find a refined transcription by transcription ID
   */
  findByTranscriptionId(transcriptionId: string): Promise<RefinedTranscription | null>;

  /**
   * Delete a refined transcription by transcription ID
   */
  deleteByTranscriptionId(transcriptionId: string): Promise<void>;
}
